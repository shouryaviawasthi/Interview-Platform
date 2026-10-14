const reportModel = require("../../models/report.model");
const interviewModel = require("../../models/interview.model");
const transcriptModel = require("../../models/transcript.model");
const resumeModel = require("../../models/resume.model");
const { findUserById } = require("../../models/user.model");
const candidateAnalysis = require("../ai/candidateAnalysis.service");
const interviewerAnalysis = require("../ai/interviewerAnalysis.service");
const env = require("../../config/env");

/**
 * Retry function with exponential backoff for AI analysis calls
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise} - Result of successful function call
 */
const retryWithBackoff = async (fn, maxAttempts = 3, operationName = 'operation') => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Reports] ${operationName} attempt ${attempt}/${maxAttempts}`);
      const result = await fn();
      
      if (attempt > 1) {
        console.log(`[Reports] ${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[Reports] ${operationName} attempt ${attempt} failed:`, error.message);
      
      // Don't retry on validation errors that indicate structural issues
      if (error.message.includes('Missing required field') || 
          error.message.includes('not an object') ||
          error.message.includes('No transcript segments available')) {
        console.log(`[Reports] Not retrying ${operationName} due to structural error`);
        throw error;
      }
      
      if (attempt < maxAttempts) {
        // Exponential backoff: 2^attempt seconds (2, 4, 8, ...)
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Reports] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxAttempts} attempts. Last error: ${lastError.message}`);
};

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

const hasBothAssignedSpeakers = (segments) => {
  const speakers = new Set(
    segments
      .map((segment) => segment.speaker || segment.speaker_type)
      .filter((speaker) => speaker === "interviewer" || speaker === "candidate")
  );
  return speakers.has("interviewer") && speakers.has("candidate");
};

const SPEAKER_ASSIGNMENT_MESSAGE =
  "Assign the detected transcript speakers to the interviewer and candidate on the Transcript page before generating reports.";

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
  console.log(`[Reports] Starting generation for interview ${interviewId}, requestedBy: ${requestedBy}`);

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
    const model = env.GROQ_MODEL || "openai/gpt-oss-120b";

    console.log(`[Reports] Data loaded - segments: ${segments.length}, duration: ${interviewDurationSecs}s, model: ${model}`);

    if (segments.length > 0 && !hasBothAssignedSpeakers(segments)) {
      console.log(`[Reports] Deferring analysis for ${interviewId} until transcript speakers are assigned.`);
      if (requestedBy === "both" || requestedBy === "candidate") {
        await reportModel.upsertCandidateReport({
          interview_id: interviewId,
          status: "not_started",
          report_json: null,
          overall_score: null,
          recommendation: null,
          llm_model: model,
          error_message: SPEAKER_ASSIGNMENT_MESSAGE,
        });
      }
      if (requestedBy === "both" || requestedBy === "interviewer") {
        await reportModel.upsertInterviewerReport({
          interview_id: interviewId,
          status: "not_started",
          report_json: null,
          overall_score: null,
          llm_model: model,
          error_message: SPEAKER_ASSIGNMENT_MESSAGE,
        });
      }
      return;
    }

    const analyticsJob = (async () => {
      try {
        const analyticsService = require("../analytics/analytics.service");
        await analyticsService.generateInterviewAnalytics(interviewId, { force: options.force });
        console.log(`[Reports] Analytics generation completed for ${interviewId}`);
      } catch (analyticsErr) {
        console.error(`[Reports] Analytics generation error for ${interviewId}:`, analyticsErr.message);
      }
    })();

    // Start both independent evaluations without waiting for analytics or each other.
    const reportJobs = [];

    if (requestedBy === "both" || requestedBy === "candidate") {
      reportJobs.push(generateCandidateReport({
        interviewId,
        interview,
        segments,
        resume,
        interviewDurationSecs,
        model,
        options,
      }));
    }

    if (requestedBy === "both" || requestedBy === "interviewer") {
      reportJobs.push(generateInterviewerReport({
        interviewId,
        interview,
        interviewer,
        segments,
        interviewDurationSecs,
        model,
        options,
      }));
    }

    const results = await Promise.allSettled([analyticsJob, ...reportJobs]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`[Reports] Independent report generation failed for ${interviewId}:`, result.reason?.message || result.reason);
      }
    }

    console.log(`[Reports] Independent report generation finished for interview ${interviewId}`);
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

  console.log(`[Reports] Starting candidate report generation for ${interviewId}. Existing score: ${existing?.overall_score}, Force: ${options.force}, Zero score retry: ${isZeroScore}`);

  // Mark processing
  await reportModel.upsertCandidateReport({
    interview_id: interviewId,
    status: "processing",
    llm_model: model,
  });

  try {
    const analysisResult = await retryWithBackoff(
      async () => {
        return await candidateAnalysis.analyzeCandidatePerformance({
          segments,
          jobDescription: interview.job_description,
          resumeText: resume?.resume_text || null,
          interviewDurationSecs,
          interviewMeta: { candidateName: interview.candidate_name, interviewId },
        });
      },
      3, // maxAttempts
      `Candidate analysis for interview ${interviewId}`
    );

    const { report, overallScore, recommendation } = analysisResult;

    // Additional validation after successful analysis
    if (overallScore === 0 && segments.length > 5) {
      console.warn(`[Reports] AI produced zero score despite ${segments.length} transcript segments for interview ${interviewId}`);
    }

    await reportModel.upsertCandidateReport({
      interview_id: interviewId,
      status: "completed",
      report_json: report,
      overall_score: overallScore,
      recommendation,
      llm_model: model,
      error_message: null,
    });

    console.log(`[Reports] Candidate report completed successfully. Score: ${overallScore}, Recommendation: ${recommendation}`);
  } catch (err) {
    console.error(`[Reports] Candidate report failed after retries for interview ${interviewId}:`, {
      error: err.message,
      segmentCount: segments.length,
      hasResume: !!resume?.resume_text,
      duration: interviewDurationSecs
    });
    
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

  console.log(`[Reports] Starting interviewer report generation for ${interviewId}. Existing score: ${existing?.overall_score}, Force: ${options.force}, Zero score retry: ${isZeroScore}`);

  // Mark processing
  await reportModel.upsertInterviewerReport({
    interview_id: interviewId,
    status: "processing",
    llm_model: model,
  });

  try {
    const analysisResult = await retryWithBackoff(
      async () => {
        return await interviewerAnalysis.analyzeInterviewerPerformance({
          segments,
          jobDescription: interview.job_description,
          interviewDurationSecs,
          interviewMeta: {
            interviewerName: interviewer?.name || "Interviewer",
            interviewId,
          },
        });
      },
      3, // maxAttempts  
      `Interviewer analysis for interview ${interviewId}`
    );

    const { report, overallScore } = analysisResult;

    // Additional validation after successful analysis
    if (overallScore === 0 && segments.length > 5) {
      console.warn(`[Reports] AI produced zero interviewer score despite ${segments.length} transcript segments for interview ${interviewId}`);
    }

    await reportModel.upsertInterviewerReport({
      interview_id: interviewId,
      status: "completed",
      report_json: report,
      overall_score: overallScore,
      llm_model: model,
      error_message: null,
    });

    console.log(`[Reports] Interviewer report completed successfully. Score: ${overallScore}`);
  } catch (err) {
    console.error(`[Reports] Interviewer report failed after retries for interview ${interviewId}:`, {
      error: err.message,
      segmentCount: segments.length,
      interviewerName: interviewer?.name,
      duration: interviewDurationSecs
    });
    
    await reportModel.upsertInterviewerReport({
      interview_id: interviewId,
      status: "failed",
      llm_model: model,
      error_message: err.message,
    });
  }
};

module.exports = { generateReports, hasBothAssignedSpeakers };
