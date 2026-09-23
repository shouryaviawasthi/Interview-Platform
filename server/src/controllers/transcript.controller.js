const path = require("path");
const audioModel = require("../models/audio.model");
const transcriptModel = require("../models/transcript.model");
const interviewModel = require("../models/interview.model");
const transcriptionService = require("../services/transcription/transcription.service");

/**
 * POST /api/interviews/:id/audio
 * Upload audio file after interview completion.
 * Triggers background transcription immediately after storing metadata.
 */
const uploadAudio = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No audio file uploaded." });
    }

    // Verify interview exists and belongs to interviewer
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }
    if (interview.status !== "completed" && interview.status !== "live") {
      return res.status(409).json({
        success: false,
        message: "Audio can only be uploaded for completed or live interviews.",
      });
    }

    // Check if audio was already uploaded — prevent duplicate uploads
    const existing = await audioModel.getAudioByInterviewId(interviewId);
    if (existing && existing.status === "completed") {
      return res.status(409).json({
        success: false,
        message: "Transcription already completed for this interview.",
      });
    }
    if (existing && existing.status === "processing") {
      return res.status(409).json({
        success: false,
        message: "Transcription is already in progress.",
      });
    }

    // Store audio metadata
    const audioRecord = await audioModel.createAudioRecord({
      interview_id: interviewId,
      file_path: req.file.path,
      file_name: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
    });

    // Fire-and-forget: transcription runs in background
    // Interview completion is NOT blocked by this
    transcriptionService.processAudio(interviewId);

    res.status(201).json({
      success: true,
      audio: {
        id: audioRecord.id,
        status: audioRecord.status,
        fileName: audioRecord.file_name,
      },
      message: "Audio uploaded. Transcription started in background.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/:id/transcript
 * Get transcript segments + status for an interview.
 * Only the interviewer who owns the interview can access this.
 */
const getTranscript = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    // Verify ownership
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }

    const isOwner = interview.interviewer_id === req.user.id;
    const isCandidate = req.user.role === "candidate" && interview.candidate_email === req.user.email;

    if (!isOwner && !isCandidate) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Fetch audio processing status
    const audio = await audioModel.getAudioByInterviewId(interviewId);
    const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);

    res.status(200).json({
      success: true,
      transcript: {
        interviewId,
        status: audio?.status ?? "not_started",
        speakerMap: audio?.speaker_map ?? null,
        segments,
        processedAt: audio?.processed_at ?? null,
        errorMessage: audio?.error_message ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/transcript/retry
 * Retry a failed transcription.
 */
const retryTranscript = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await transcriptionService.retryTranscription(interviewId);

    res.status(200).json({
      success: true,
      message: "Transcription retry started.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/transcript/assign-speakers
 * Assign interviewer/candidate roles to Deepgram speaker labels.
 * Body: { speakerMap: { "speaker_0": "interviewer", "speaker_1": "candidate" } }
 */
const assignSpeakers = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;
    const { speakerMap } = req.body;

    if (!speakerMap || typeof speakerMap !== "object") {
      return res.status(400).json({ success: false, message: "speakerMap is required." });
    }

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await transcriptionService.applySpeakerMap(interviewId, speakerMap);

    res.status(200).json({
      success: true,
      message: "Speaker assignment saved.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAudio,
  getTranscript,
  retryTranscript,
  assignSpeakers,
};
