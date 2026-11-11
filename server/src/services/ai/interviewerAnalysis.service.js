const groqService = require("./groq.service");
const { INTERVIEWER_SYSTEM_PROMPT, buildInterviewerUserPrompt } = require("./prompts/interviewer.prompt");
const { validateInterviewerReport } = require("./validator");
const { computeMetrics } = require("./metrics");

/**
 * Interviewer Analysis Service
 *
 * Completely separate from candidate analysis.
 * Evaluates the interviewer's conduct — not the candidate.
 *
 * @param {Object} opts
 * @param {Array}       opts.segments               - Transcript segments from DB
 * @param {string}      opts.jobDescription         - From interviews.job_description
 * @param {number|null} opts.interviewDurationSecs  - From interviews duration
 * @param {Object}      opts.interviewMeta          - { interviewerName, interviewId }
 * @returns {Object} { report: <validated JSON>, overallScore: number }
 */
const analyzeInterviewerPerformance = async ({
  segments,
  jobDescription,
  interviewDurationSecs,
  interviewMeta,
}) => {
  console.log(`[InterviewerAnalysis] Starting analysis for interview ${interviewMeta.interviewId}`);
  
  // Validate input data before proceeding
  if (!segments || segments.length === 0) {
    throw new Error("No transcript segments available for interviewer analysis");
  }

  // Step 1: compute deterministic metrics
  const metrics = computeMetrics(segments, interviewDurationSecs);
  console.log(`[InterviewerAnalysis] Computed metrics:`, {
    totalWords: metrics.totalWords,
    candidateWords: metrics.candidateWords,
    interviewerWords: metrics.interviewerWords,
    speakingTimeRatio: metrics.speakingTimeRatio
  });

  // Step 2: build prompts (entirely different from candidate prompts)
  const systemPrompt = INTERVIEWER_SYSTEM_PROMPT;
  const userPrompt = buildInterviewerUserPrompt({
    jobDescription,
    transcriptSegments: segments,
    metrics,
    interviewMeta,
  });

  // Step 3: call Groq
  let rawResponse;
  try {
    rawResponse = await groqService.generateStructuredResponse({
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.2,
    });
  } catch (error) {
    console.error(`[InterviewerAnalysis] Groq API call failed:`, error.message);
    throw new Error(`AI interviewer analysis failed: ${error.message}`);
  }

  // Step 4: validate and normalize
  let validated;
  try {
    validated = validateInterviewerReport(rawResponse);
    console.log(`[InterviewerAnalysis] Validation successful. Overall score: ${validated.overallScore}`);
  } catch (validationError) {
    console.error(`[InterviewerAnalysis] Validation failed:`, validationError.message);
    throw new Error(`AI interviewer response validation failed: ${validationError.message}`);
  }

  // Step 5: Check for zero score issues when substantial content exists
  const hasSubstantialContent = metrics.interviewerWords > 50 && segments.length > 5;
  if (validated.overallScore === 0 && hasSubstantialContent) {
    console.warn(`[InterviewerAnalysis] Zero score detected with substantial content (${metrics.interviewerWords} interviewer words, ${segments.length} segments)`);
    throw new Error("AI interviewer analysis produced zero score despite substantial interview content - retry needed");
  }

  // Step 6: Validate critical score fields are not all zero
  const criticalScores = [
    validated.questionQuality?.score,
    validated.followUpQuality?.score,
    validated.interviewStructure?.score,
    validated.candidateEngagement?.score,
    validated.communication?.score
  ];
  
  const allScoresZero = criticalScores.every(score => score === 0);
  if (allScoresZero && hasSubstantialContent) {
    console.warn(`[InterviewerAnalysis] All section scores are zero with substantial content`);
    throw new Error("AI interviewer analysis produced all zero section scores despite substantial interview content - retry needed");
  }

  return {
    report: validated,
    overallScore: validated.overallScore,
  };
};

module.exports = { analyzeInterviewerPerformance };
