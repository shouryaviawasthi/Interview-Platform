const groqService = require("./groq.service");
const { CANDIDATE_SYSTEM_PROMPT, buildCandidateUserPrompt } = require("./prompts/candidate.prompt");
const { validateCandidateReport } = require("./validator");
const { computeMetrics } = require("./metrics");

/**
 * Candidate Analysis Service
 *
 * Prepares context, calls Groq, validates response, returns structured report.
 *
 * @param {Object} opts
 * @param {Array}       opts.segments               - Transcript segments from DB
 * @param {string}      opts.jobDescription         - From interviews.job_description
 * @param {string|null} opts.resumeText             - From resumes.resume_text (nullable)
 * @param {number|null} opts.interviewDurationSecs  - From interviews duration
 * @param {Object}      opts.interviewMeta          - { candidateName, interviewId }
 * @returns {Object} { report: <validated JSON>, overallScore: number, recommendation: string }
 */
const analyzeCandidatePerformance = async ({
  segments,
  jobDescription,
  resumeText,
  interviewDurationSecs,
  interviewMeta,
}) => {
  console.log(`[CandidateAnalysis] Starting analysis for interview ${interviewMeta.interviewId}`);
  
  // Validate input data before proceeding
  if (!segments || segments.length === 0) {
    throw new Error("No transcript segments available for analysis");
  }

  // Step 1: compute deterministic metrics
  const metrics = computeMetrics(segments, interviewDurationSecs);
  console.log(`[CandidateAnalysis] Computed metrics:`, {
    totalWords: metrics.totalWords,
    candidateWords: metrics.candidateWords,
    interviewerWords: metrics.interviewerWords,
    speakingTimeRatio: metrics.speakingTimeRatio
  });

  // Step 2: build prompts
  const systemPrompt = CANDIDATE_SYSTEM_PROMPT;
  const userPrompt = buildCandidateUserPrompt({
    jobDescription,
    resumeText,
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
    console.error(`[CandidateAnalysis] Groq API call failed:`, error.message);
    throw new Error(`AI analysis failed: ${error.message}`);
  }

  // Step 4: validate and normalize
  let validated;
  try {
    validated = validateCandidateReport(rawResponse);
    console.log(`[CandidateAnalysis] Validation successful. Overall score: ${validated.overallScore}`);
  } catch (validationError) {
    console.error(`[CandidateAnalysis] Validation failed:`, validationError.message);
    throw new Error(`AI response validation failed: ${validationError.message}`);
  }

  // Step 5: Check for zero score issues when substantial content exists
  const hasSubstantialContent = metrics.candidateWords > 50 && segments.length > 5;
  if (validated.overallScore === 0 && hasSubstantialContent) {
    console.warn(`[CandidateAnalysis] Zero score detected with substantial content (${metrics.candidateWords} words, ${segments.length} segments)`);
    throw new Error("AI analysis produced zero score despite substantial interview content - retry needed");
  }

  // Step 6: Validate critical score fields are not all zero
  const criticalScores = [
    validated.technicalEvaluation?.score,
    validated.problemSolving?.score,
    validated.communication?.score,
    validated.behavioralPerformance?.score,
    validated.jobFit?.score
  ];
  
  const allScoresZero = criticalScores.every(score => score === 0);
  if (allScoresZero && hasSubstantialContent) {
    console.warn(`[CandidateAnalysis] All section scores are zero with substantial content`);
    throw new Error("AI analysis produced all zero section scores despite substantial interview content - retry needed");
  }

  // Step 7: Validate recommendation matches score
  const scoreToRecommendationMap = {
    "Not Recommended": [0, 40],
    "Below Average Candidate": [40, 55],
    "Average Candidate": [55, 70],
    "Good Candidate": [70, 85],
    "Strong Candidate": [85, 100]
  };
  
  const expectedRec = Object.entries(scoreToRecommendationMap).find(([rec, [min, max]]) => 
    validated.overallScore >= min && validated.overallScore < max
  );
  
  if (expectedRec && expectedRec[0] !== validated.recommendation) {
    console.warn(`[CandidateAnalysis] Score-recommendation mismatch: score=${validated.overallScore}, recommendation=${validated.recommendation}, expected=${expectedRec[0]}`);
    // Fix the recommendation to match the score
    validated.recommendation = expectedRec[0];
  }

  return {
    report: validated,
    overallScore: validated.overallScore,
    recommendation: validated.recommendation,
  };
};

module.exports = { analyzeCandidatePerformance };
