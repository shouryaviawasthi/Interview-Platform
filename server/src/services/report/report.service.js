const reportModel = require("../../models/report.model");
const interviewModel = require("../../models/interview.model");
const transcriptModel = require("../../models/transcript.model");
const resumeModel = require("../../models/resume.model");
const { findUserById } = require("../../models/user.model");
const candidateAnalysis = require("../ai/candidateAnalysis.service");
const interviewerAnalysis = require("../ai/interviewerAnalysis.service");
const env = require("../../config/env");

/**
 * Compute interview duration in seconds from interview row.
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
 * Main report generation function.
 * Called fire-and-forget from the controller or transcription service.
 * Handles both candidate and interviewer reports and analytics.
 *
 * @param {string} interviewId
 * @param {string} requestedBy - type: 'candidate' | 'interviewer' | 'both'
 * @param {Object} options - { force: boolean }
 */
const generateReports = async (interviewId, requestedBy = "both", options = {}) => {
  console.log(`[Reports] Starting generation for interview ${interviewId}`);

  try {
    // 1. Fetch all required data
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      console.error(`[Reports] Interview ${interviewId} not found.`);
      return;
    }

    const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);
    const resume = await resumeModel.getResumeByInterviewId(interviewId);
    const interviewer = await findUserById(interview.interviewer_id);

    const interviewDurationSecs = getDurationSeconds(interview);
    const model = env.GROQ_MODEL || "llama-3.1-70b-versatile";

    // 2. Generate analytics in parallel / pre-step
    try {
      const analyticsService = require("../analytics/analytics.service");
      await analyticsService.generateInterviewAnalytics(interviewId);
    } catch (analyticsErr) {
      console.error(`[Reports] Analytics generation error for ${interviewId}:`, analyticsErr.message);
    }

    // 3. Generate candidate report
    if (requestedBy === "both" || requestedBy === "candidate") {
      await generateCandidateReport({
        interviewId,
        interview,
        segments,
        resume,
        interviewDurationSecs,
        model,
        options,
      });
    }

    // 4. Generate interviewer report
    if (requestedBy === "both" || requestedBy === "interviewer") {
      await generateInterviewerReport({
        interviewId,
        interview,
        interviewer,
        segments,
        interviewDurationSecs,
        model,
        options,
      });
    }

    console.log(`[Reports] Generation complete for interview ${interviewId}`);
  } catch (err) {
    console.error(`[Reports] Unexpected error for interview ${interviewId}:`, err.message);
  }
};

const generateCandidateReport = async ({
  interviewId, interview, segments, resume, interviewDurationSecs, model, options = {},
}) => {
  const existing = await reportModel.getCandidateReport(interviewId);

  const isZeroScore = existing?.overall_score === 0 || existing?.overall_score === "0.00" || existing?.overall_score === "0";
  const forceRegenerate = options.force || (isZeroScore && segments.length > 0);

  if (existing?.status === "completed" && !forceRegenerate) {
    console.log(`[Reports] Candidate report already completed for ${interviewId} — skipping.`);
    return;
  }
  if (existing?.status === "processing" && !options.force) {
    console.log(`[Reports] Candidate report already processing for ${interviewId} — skipping.`);
    return;
  }

  // Defer if no transcript segments available yet
  if (!segments || segments.length === 0) {
    console.log(`[Reports] No transcript segments available for ${interviewId} — deferring candidate report.`);
    return;
  }

  // Mark processing
  await reportModel.upsertCandidateReport({
    interview_id: interviewId,
    status: "processing",
    llm_model: model,
  });

  try {
    const { report, overallScore, recommendation } = await candidateAnalysis.analyzeCandidatePerformance({
      segments,
      jobDescription: interview.job_description,
      resumeText: resume?.resume_text || null,
      interviewDurationSecs,
      interviewMeta: { candidateName: interview.candidate_name, interviewId },
    });

    await reportModel.upsertCandidateReport({
      interview_id: interviewId,
      status: "completed",
      report_json: report,
      overall_score: overallScore,
      recommendation,
      llm_model: model,
      error_message: null,
    });

    console.log(`[Reports] Candidate report completed. Score: ${overallScore}, Rec: ${recommendation}`);
  } catch (err) {
    console.error(`[Reports] Candidate report failed:`, err.message);
    await reportModel.upsertCandidateReport({
      interview_id: interviewId,
      status: "failed",
      llm_model: model,
      error_message: err.message,
    });
  }
};

const generateInterviewerReport = async ({
  interviewId, interview, interviewer, segments, interviewDurationSecs, model, options = {},
}) => {
  const existing = await reportModel.getInterviewerReport(interviewId);

  const isZeroScore = existing?.overall_score === 0 || existing?.overall_score === "0.00" || existing?.overall_score === "0";
  const forceRegenerate = options.force || (isZeroScore && segments.length > 0);

  if (existing?.status === "completed" && !forceRegenerate) {
    console.log(`[Reports] Interviewer report already completed for ${interviewId} — skipping.`);
    return;
  }
  if (existing?.status === "processing" && !options.force) {
    console.log(`[Reports] Interviewer report already processing for ${interviewId} — skipping.`);
    return;
  }

  // Defer if no transcript segments available yet
  if (!segments || segments.length === 0) {
    console.log(`[Reports] No transcript segments available for ${interviewId} — deferring interviewer report.`);
    return;
  }

  // Mark processing
  await reportModel.upsertInterviewerReport({
    interview_id: interviewId,
    status: "processing",
    llm_model: model,
  });

  try {
    const { report, overallScore } = await interviewerAnalysis.analyzeInterviewerPerformance({
      segments,
      jobDescription: interview.job_description,
      interviewDurationSecs,
      interviewMeta: {
        interviewerName: interviewer?.name || "Interviewer",
        interviewId,
      },
    });

    await reportModel.upsertInterviewerReport({
      interview_id: interviewId,
      status: "completed",
      report_json: report,
      overall_score: overallScore,
      llm_model: model,
      error_message: null,
    });

    console.log(`[Reports] Interviewer report completed. Score: ${overallScore}`);
  } catch (err) {
    console.error(`[Reports] Interviewer report failed:`, err.message);
    await reportModel.upsertInterviewerReport({
      interview_id: interviewId,
      status: "failed",
      llm_model: model,
      error_message: err.message,
    });
  }
};

module.exports = { generateReports };
