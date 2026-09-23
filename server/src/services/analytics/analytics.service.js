const analyticsModel = require("../../models/analytics.model");
const interviewModel = require("../../models/interview.model");
const transcriptModel = require("../../models/transcript.model");
const { calculateDeterministicAnalytics } = require("./analyticsCalculator.service");
const { generateSemanticAnalytics } = require("./groqAnalytics.service");
const env = require("../../config/env");

/**
 * Helper to compute interview duration in seconds.
 */
const getDurationSeconds = (interview) => {
  if (interview.started_at && interview.ended_at) {
    return Math.round(
      (new Date(interview.ended_at) - new Date(interview.started_at)) / 1000
    );
  }
  return null;
};

/**
 * Main Analytics Generation Service
 *
 * Combines deterministic mathematical metrics with Groq semantic analysis.
 * Resilient against Groq outages: saves deterministic analytics even if Groq fails.
 *
 * @param {string} interviewId
 * @returns {Promise<Object>}
 */
const generateInterviewAnalytics = async (interviewId) => {
  console.log(`[Analytics] Starting analytics generation for interview ${interviewId}`);

  try {
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      console.error(`[Analytics] Interview ${interviewId} not found.`);
      return;
    }

    const existing = await analyticsModel.getAnalyticsByInterviewId(interviewId);
    if (existing?.status === "completed") {
      console.log(`[Analytics] Analytics already completed for ${interviewId} — skipping.`);
      return existing;
    }

    // Set processing status
    await analyticsModel.setAnalyticsStatus(interviewId, "processing");

    const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);
    const durationSeconds = getDurationSeconds(interview);

    // 1. Calculate deterministic metrics (timing, turns, pauses, fillers, languages)
    const deterministicMetrics = calculateDeterministicAnalytics(segments, durationSeconds);

    // 2. Run semantic AI analysis via Groq if available
    let semanticAnalytics = null;
    if (env.GROQ_API_KEY && segments.length > 0) {
      semanticAnalytics = await generateSemanticAnalytics({
        jobDescription: interview.job_description,
        transcriptSegments: segments,
        deterministicMetrics,
        interviewMeta: {
          candidateName: interview.candidate_name,
          interviewId,
        },
      });
    }

    // 3. Construct unified analytics object
    const finalAnalyticsJson = {
      duration: deterministicMetrics.duration,
      speakingTime: deterministicMetrics.speakingTime,
      speakingPercentage: deterministicMetrics.speakingPercentage,
      turns: deterministicMetrics.turns,
      pausesAndLatency: deterministicMetrics.pausesAndLatency,
      fillers: deterministicMetrics.fillers,
      languages: deterministicMetrics.languages,
      questions: semanticAnalytics?.questions || {
        total: Math.max(deterministicMetrics.turns.interviewer, 1),
        technical: 0,
        behavioral: 0,
        followUps: 0,
        repeated: 0,
        unanswered: 0,
      },
      questionAnswerMappings: semanticAnalytics?.questionAnswerMappings || [],
      topics: semanticAnalytics?.topics || [],
      timeline: semanticAnalytics?.timeline || [],
      candidateInsights: semanticAnalytics?.candidateInsights || null,
      interviewerInsights: semanticAnalytics?.interviewerInsights || null,
    };

    // 4. Save to Database
    const saved = await analyticsModel.upsertAnalytics({
      interview_id: interviewId,
      status: "completed",
      total_duration: deterministicMetrics.duration.totalSeconds,
      interviewer_speaking_time: deterministicMetrics.speakingTime.interviewer,
      candidate_speaking_time: deterministicMetrics.speakingTime.candidate,
      interviewer_speaking_percentage: deterministicMetrics.speakingPercentage.interviewer,
      candidate_speaking_percentage: deterministicMetrics.speakingPercentage.candidate,
      silence_duration: deterministicMetrics.duration.silenceSeconds,
      interviewer_turn_count: deterministicMetrics.turns.interviewer,
      candidate_turn_count: deterministicMetrics.turns.candidate,
      total_turns: deterministicMetrics.turns.total,
      average_interviewer_turn_duration: deterministicMetrics.turns.avgInterviewerDuration,
      average_candidate_turn_duration: deterministicMetrics.turns.avgCandidateDuration,
      longest_turn_duration: deterministicMetrics.turns.longestTurn?.duration || 0,
      question_count: finalAnalyticsJson.questions.total,
      follow_up_count: finalAnalyticsJson.questions.followUps,
      candidate_filler_count: deterministicMetrics.fillers.candidate.totalCount,
      interviewer_filler_count: deterministicMetrics.fillers.interviewer.totalCount,
      candidate_language_stats: deterministicMetrics.languages.candidate,
      interviewer_language_stats: deterministicMetrics.languages.interviewer,
      analytics_json: finalAnalyticsJson,
      error_message: null,
    });

    console.log(`[Analytics] Analytics generation successfully completed for ${interviewId}`);
    return saved;
  } catch (error) {
    console.error(`[Analytics] Analytics generation failed for ${interviewId}:`, error.message);
    await analyticsModel.setAnalyticsStatus(interviewId, "failed", error.message);
  }
};

module.exports = {
  generateInterviewAnalytics,
};
