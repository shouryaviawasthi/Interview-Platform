const audioModel = require("../../models/audio.model");
const transcriptModel = require("../../models/transcript.model");
const interviewModel = require("../../models/interview.model");
const deepgramProvider = require("./deepgram.provider");

/**
 * Transcription Service
 *
 * Orchestrates: audio record → Deepgram → segment normalization → DB storage.
 *
 * IMPORTANT:
 *  - This runs asynchronously AFTER the interview is marked completed.
 *  - A failed transcription never rolls back the interview status.
 *  - Idempotency: checks audio.status before starting — skips if already
 *    'processing' or 'completed'.
 */

/**
 * Kick off transcription for an interview audio file.
 * This is intentionally fire-and-forget from the caller's perspective.
 * The caller should NOT await this function.
 *
 * @param {string} interviewId
 */
const processAudio = async (interviewId) => {
  console.log(`[Transcription] Starting for interview ${interviewId}`);

  try {
    // 1. Fetch the audio record
    const audio = await audioModel.getAudioByInterviewId(interviewId);
    if (!audio) {
      console.error(`[Transcription] No audio record found for interview ${interviewId}`);
      return;
    }

    // 2. Idempotency guard — do not re-process
    if (audio.status === "processing" || audio.status === "completed") {
      console.log(`[Transcription] Skipping — already ${audio.status} for interview ${interviewId}`);
      return;
    }

    // 3. Mark as processing
    await audioModel.updateAudioStatus(interviewId, "processing");

    // 4. Call Deepgram
    const rawSegments = await deepgramProvider.transcribeAudioFile(
      audio.file_path,
      audio.mime_type || "audio/webm"
    );

    if (!rawSegments || rawSegments.length === 0) {
      await audioModel.updateAudioStatus(interviewId, "failed", "Deepgram returned no segments.");
      console.warn(`[Transcription] Empty transcript for interview ${interviewId}`);
      return;
    }

    // 5. Identify unique speakers from Deepgram output
    const speakerSet = [...new Set(rawSegments.map((s) => s.rawSpeaker))].sort();

    // 6. Store segments with rawSpeaker in the `speaker` column (existing) and
    //    speaker_type = 'unknown' initially. The interviewer will assign roles via UI.
    const segments = rawSegments.map((seg, idx) => ({
      speaker_type: "unknown",
      text: seg.text,
      start_time: seg.startTime,
      end_time: seg.endTime,
      sequence_num: idx + 1,
      confidence: seg.confidence,
      language: seg.language,
      // rawSpeaker stored in existing `speaker` column for later assignment
      _rawSpeaker: seg.rawSpeaker,
    }));

    // Delete any stale segments from previous attempts
    await transcriptModel.deleteSegmentsByInterviewId(interviewId);

    // Insert all segments (using the `speaker` column for the raw Deepgram label)
    await insertSegmentsWithRaw(interviewId, segments);

    // 7. Mark completed + store speaker set metadata
    await audioModel.updateAudioStatus(interviewId, "completed");

    // Store the speaker set in speaker_map as an unresolved mapping
    // e.g. { "speaker_0": null, "speaker_1": null } — null means "unassigned"
    const unresolved = {};
    for (const spk of speakerSet) {
      unresolved[spk] = null;
    }
    await audioModel.saveSpeakerMap(interviewId, unresolved);

    console.log(`[Transcription] Completed for interview ${interviewId}. ${rawSegments.length} segments, ${speakerSet.length} speakers detected.`);

    // Auto-trigger reports & analytics generation now that transcript is ready
    try {
      const { generateReports } = require("../report/report.service");
      generateReports(interviewId, "both", { force: true });
      console.log(`[Transcription] Auto-triggered report generation for ${interviewId}`);
    } catch (reportErr) {
      console.error(`[Transcription] Failed to trigger report generation for ${interviewId}:`, reportErr.message);
    }

  } catch (err) {
    console.error(`[Transcription] Failed for interview ${interviewId}:`, err.message);
    try {
      await audioModel.updateAudioStatus(interviewId, "failed", err.message);
    } catch (dbErr) {
      console.error("[Transcription] Could not update status to failed:", dbErr.message);
    }
  }
};

/**
 * Insert segments, storing the raw Deepgram speaker label in the `speaker` column
 * so the assignment UI can display which utterances belong to which raw speaker.
 */
const insertSegmentsWithRaw = async (interviewId, segments) => {
  const { pool } = require("../../config/db");

  if (!segments || segments.length === 0) return;

  const values = [];
  const placeholders = segments.map((seg, i) => {
    const base = i * 8;
    values.push(
      interviewId,
      seg._rawSpeaker,      // stored in existing `speaker` column
      seg.speaker_type,     // stored in new `speaker_type` column
      seg.text,
      seg.start_time ?? null,
      seg.end_time ?? null,
      seg.sequence_num,
      seg.confidence ?? null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  const query = `
    INSERT INTO transcripts
      (interview_id, speaker, speaker_type, transcript_text, start_time, end_time, sequence_num, confidence)
    VALUES ${placeholders.join(", ")}
  `;
  await pool.query(query, values);
};

/**
 * Apply a speaker map to all transcript segments for an interview.
 * speakerMap: { "speaker_0": "interviewer", "speaker_1": "candidate" }
 *
 * This is called after the interviewer confirms speaker roles in the UI.
 */
const applySpeakerMap = async (interviewId, speakerMap) => {
  // Validate: all values must be 'interviewer' or 'candidate'
  const validRoles = ["interviewer", "candidate"];
  for (const [raw, role] of Object.entries(speakerMap)) {
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid speaker role "${role}". Must be interviewer or candidate.`);
    }
  }

  // Update each raw speaker group
  const { pool } = require("../../config/db");
  for (const [rawSpeaker, speakerType] of Object.entries(speakerMap)) {
    await pool.query(
      `UPDATE transcripts
       SET speaker_type = $3
       WHERE interview_id = $1 AND speaker = $2`,
      [interviewId, rawSpeaker, speakerType]
    );
  }

  // Persist the resolved map
  await audioModel.saveSpeakerMap(interviewId, speakerMap);
};

/**
 * Retry failed transcription.
 * Only allowed when status is 'failed'.
 */
const retryTranscription = async (interviewId) => {
  const audio = await audioModel.getAudioByInterviewId(interviewId);
  if (!audio) {
    const err = new Error("No audio record found for this interview.");
    err.statusCode = 404;
    throw err;
  }
  if (audio.status === "processing") {
    const err = new Error("Transcription is already in progress.");
    err.statusCode = 409;
    throw err;
  }
  if (audio.status === "completed") {
    const err = new Error("Transcription is already completed.");
    err.statusCode = 409;
    throw err;
  }
  // Reset status to uploaded so processAudio() will run again
  await audioModel.updateAudioStatus(interviewId, "uploaded", null);
  // Fire-and-forget
  processAudio(interviewId);
};

module.exports = {
  processAudio,
  applySpeakerMap,
  retryTranscription,
};
