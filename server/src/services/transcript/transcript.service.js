const { toFile } = require("groq-sdk");
const groq = require("../ai/groq.client");
const env = require("../../config/env");
const logger = require("../../config/logger");
const ApiError = require("../../utils/ApiError");
const transcriptModel = require("../../models/transcript.model");

// Groq's audio.transcriptions endpoint bills a minimum of 10s per
// request regardless of actual chunk length, and 25MB is the free-tier
// cap — a several-second webm/opus chunk is a few hundred KB, so this
// is generous headroom rather than a limit we expect to hit.
const MAX_CHUNK_BYTES = 20 * 1024 * 1024;

/**
 * Guess a sensible filename/extension for the Groq upload based on the
 * browser-reported mimetype, since Groq infers format from the filename
 * extension rather than the multipart Content-Type.
 */
const extensionForMimeType = (mimeType = "") => {
  if (mimeType.includes("webm")) return "chunk.webm";
  if (mimeType.includes("ogg")) return "chunk.ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "chunk.m4a";
  if (mimeType.includes("wav")) return "chunk.wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "chunk.mp3";
  return "chunk.webm";
};

/**
 * Transcribe one audio chunk with Groq Whisper and persist it as a
 * transcript row. Returns null (rather than throwing) for chunks that
 * transcribed to silence/nothing, so callers can skip broadcasting them.
 */
const transcribeChunk = async ({
  interviewId,
  speaker,
  timeOffsetSeconds,
  audioBuffer,
  mimeType,
}) => {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw ApiError.badRequest("No audio data received");
  }
  if (audioBuffer.length > MAX_CHUNK_BYTES) {
    throw ApiError.badRequest("Audio chunk is too large");
  }

  let transcriptionText;
  try {
    const file = await toFile(audioBuffer, extensionForMimeType(mimeType));
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: env.GROQ_STT_MODEL,
      response_format: "json",
      temperature: 0,
    });
    transcriptionText = (transcription.text || "").trim();
  } catch (err) {
    logger.error("Groq transcription failed", err);
    const status = err?.status;
    if (status === 401) {
      throw new ApiError("Groq API key is missing or invalid", 500);
    }
    if (status === 429) {
      throw new ApiError("Speech-to-text is rate limited right now, please try again shortly", 429);
    }
    throw ApiError.badGateway("Speech-to-text is temporarily unavailable");
  }

  // Silence / non-speech chunks transcribe to an empty string — skip
  // storing those rather than cluttering the transcript.
  if (!transcriptionText) {
    return null;
  }

  const row = await transcriptModel.addTranscriptChunk({
    interview_id: interviewId,
    speaker,
    time_offset_seconds: Math.max(0, Number(timeOffsetSeconds) || 0),
    transcript_text: transcriptionText,
  });

  return row;
};

const getInterviewTranscript = async (interviewId) => {
  return transcriptModel.getTranscriptByInterviewId(interviewId);
};

/**
 * Build a single speaker-labelled script from the stored transcript rows,
 * ready to hand to the analysis LLM as plain text.
 */
const buildTranscriptScript = (transcriptRows) => {
  if (!transcriptRows || transcriptRows.length === 0) return "";

  return transcriptRows
    .map((row) => {
      const minutes = Math.floor(row.time_offset_seconds / 60);
      const seconds = Math.floor(row.time_offset_seconds % 60)
        .toString()
        .padStart(2, "0");
      const label = row.speaker === "interviewer" ? "Interviewer" : "Candidate";
      return `[${minutes}:${seconds}] ${label}: ${row.transcript_text}`;
    })
    .join("\n");
};

module.exports = {
  transcribeChunk,
  getInterviewTranscript,
  buildTranscriptScript,
};
