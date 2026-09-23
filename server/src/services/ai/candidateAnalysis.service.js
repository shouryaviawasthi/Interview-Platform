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
  // Step 1: compute deterministic metrics
  const metrics = computeMetrics(segments, interviewDurationSecs);

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
  const rawResponse = await groqService.generateStructuredResponse({
    systemPrompt,
    userPrompt,
    maxTokens: 4096,
    temperature: 0.2,
  });

  // Step 4: validate and normalize
  const validated = validateCandidateReport(rawResponse);

  return {
    report: validated,
    overallScore: validated.overallScore,
    recommendation: validated.recommendation,
  };
};

module.exports = { analyzeCandidatePerformance };
