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
  // Step 1: compute deterministic metrics
  const metrics = computeMetrics(segments, interviewDurationSecs);

  // Step 2: build prompts (entirely different from candidate prompts)
  const systemPrompt = INTERVIEWER_SYSTEM_PROMPT;
  const userPrompt = buildInterviewerUserPrompt({
    jobDescription,
    transcriptSegments: segments,
    metrics,
    interviewMeta,
  });

  // Step 3: call Groq
  const rawResponse = await groqService.generateStructuredResponse({
    systemPrompt,
    userPrompt,
    maxTokens: 4096,
    temperature: 0.2,
  });

  // Step 4: validate and normalize
  const validated = validateInterviewerReport(rawResponse);

  return {
    report: validated,
    overallScore: validated.overallScore,
  };
};

module.exports = { analyzeInterviewerPerformance };
