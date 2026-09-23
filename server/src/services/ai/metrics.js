/**
 * Deterministic Interview Metrics Calculator
 *
 * Computes all basic metrics from the transcript using pure arithmetic.
 * Groq must NEVER perform these calculations.
 */

const formatTime = (totalSeconds) => {
  if (totalSeconds == null || isNaN(totalSeconds)) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
};

/**
 * Count question-like interviewer utterances (heuristic: ends with "?").
 */
const countEstimatedQuestions = (segments) => {
  return segments.filter(
    (s) =>
      (s.speaker === "interviewer" || s.speaker_type === "interviewer") &&
      s.text && s.text.trim().endsWith("?")
  ).length;
};

/**
 * Calculate all deterministic metrics from transcript segments.
 *
 * @param {Array}   segments         - From transcripts table
 * @param {number|null} interviewDurationSeconds - From interviews.started_at / ended_at
 * @returns {Object} metrics
 */
const computeMetrics = (segments, interviewDurationSeconds) => {
  // Normalize speaker field (model returns 'speaker' as alias for speaker_type in some queries)
  const getSpeaker = (s) => s.speaker || s.speaker_type || "unknown";

  let interviewerSecs = 0;
  let candidateSecs = 0;
  let interviewerTurns = 0;
  let candidateTurns = 0;

  for (const seg of segments) {
    const spk = getSpeaker(seg);
    const dur =
      seg.start_time != null && seg.end_time != null
        ? Math.max(0, (seg.end_time - seg.start_time))
        : 0;

    if (spk === "interviewer") {
      interviewerSecs += dur;
      interviewerTurns++;
    } else if (spk === "candidate") {
      candidateSecs += dur;
      candidateTurns++;
    }
  }

  const totalSpeakingSecs = interviewerSecs + candidateSecs;
  const durationSecs = interviewDurationSeconds || totalSpeakingSecs || 0;

  const interviewerPct =
    totalSpeakingSecs > 0
      ? Math.round((interviewerSecs / totalSpeakingSecs) * 100)
      : 0;
  const candidatePct =
    totalSpeakingSecs > 0
      ? Math.round((candidateSecs / totalSpeakingSecs) * 100)
      : 0;

  return {
    durationSeconds: durationSecs,
    durationFormatted: formatTime(durationSecs),

    interviewerSpeakingSeconds: Math.round(interviewerSecs),
    interviewerSpeakingFormatted: formatTime(Math.round(interviewerSecs)),
    interviewerPct,
    interviewerTurns,

    candidateSpeakingSeconds: Math.round(candidateSecs),
    candidateSpeakingFormatted: formatTime(Math.round(candidateSecs)),
    candidatePct,
    candidateTurns,

    totalSegments: segments.length,
    estimatedQuestions: countEstimatedQuestions(segments),
  };
};

module.exports = { computeMetrics, formatTime };
