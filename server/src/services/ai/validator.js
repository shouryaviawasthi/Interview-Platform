/**
 * AI Output Validator
 *
 * Validates Groq's JSON response before saving to database.
 * Rejects malformed, incomplete, or out-of-range data.
 */

const SCORE_FIELDS_CANDIDATE = [
  "overallScore",
  "technicalEvaluation.score",
  "problemSolving.score",
  "communication.score",
  "behavioralPerformance.score",
  "jobFit.score",
];

const SCORE_FIELDS_INTERVIEWER = [
  "overallScore",
  "questionQuality.score",
  "followUpQuality.score",
  "interviewStructure.score",
  "candidateEngagement.score",
  "communication.score",
];

const getNestedValue = (obj, path) => {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
};

const isValidScore = (val) =>
  typeof val === "number" && Number.isFinite(val) && val >= 0 && val <= 100;

const clampScore = (val, fallback = 0) => {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.round(Math.max(0, Math.min(100, val)));
};

const ensureArray = (val) => (Array.isArray(val) ? val : []);

/**
 * Validate and normalize the candidate report JSON from Groq.
 * Throws an Error with a descriptive message if validation fails hard.
 * For soft errors (out-of-range scores), it clamps rather than rejects.
 */
const validateCandidateReport = (raw) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Groq response is not an object.");
  }

  const required = ["overallScore", "recommendation", "summary", "technicalEvaluation",
    "problemSolving", "communication", "behavioralPerformance", "jobFit", "finalAssessment"];

  for (const field of required) {
    if (!(field in raw)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate and clamp scores
  const validated = { ...raw };
  validated.overallScore = clampScore(raw.overallScore);
  validated.technicalEvaluation = { ...raw.technicalEvaluation, score: clampScore(raw.technicalEvaluation?.score) };
  validated.problemSolving = { ...raw.problemSolving, score: clampScore(raw.problemSolving?.score) };
  validated.communication = { ...raw.communication, score: clampScore(raw.communication?.score) };
  validated.behavioralPerformance = { ...raw.behavioralPerformance, score: clampScore(raw.behavioralPerformance?.score) };
  validated.jobFit = { ...raw.jobFit, score: clampScore(raw.jobFit?.score) };

  // Validate recommendation value
  const validRecs = ["Strong Candidate", "Good Candidate", "Average Candidate", "Below Average Candidate", "Not Recommended"];
  if (!validRecs.includes(validated.recommendation)) {
    // Attempt to map common LLM variations
    const mapped = validRecs.find(r => r.toLowerCase() === String(validated.recommendation).toLowerCase());
    validated.recommendation = mapped || "Average Candidate";
  }

  // Ensure arrays
  validated.technicalEvaluation.strengths = ensureArray(validated.technicalEvaluation?.strengths);
  validated.technicalEvaluation.weaknesses = ensureArray(validated.technicalEvaluation?.weaknesses);
  validated.technicalEvaluation.evidence = ensureArray(validated.technicalEvaluation?.evidence);
  validated.problemSolving.strengths = ensureArray(validated.problemSolving?.strengths);
  validated.problemSolving.weaknesses = ensureArray(validated.problemSolving?.weaknesses);
  validated.problemSolving.evidence = ensureArray(validated.problemSolving?.evidence);
  validated.communication.strengths = ensureArray(validated.communication?.strengths);
  validated.communication.weaknesses = ensureArray(validated.communication?.weaknesses);
  validated.communication.evidence = ensureArray(validated.communication?.evidence);
  validated.behavioralPerformance.strengths = ensureArray(validated.behavioralPerformance?.strengths);
  validated.behavioralPerformance.weaknesses = ensureArray(validated.behavioralPerformance?.weaknesses);
  validated.behavioralPerformance.evidence = ensureArray(validated.behavioralPerformance?.evidence);
  validated.jobFit.matchingSkills = ensureArray(validated.jobFit?.matchingSkills);
  validated.jobFit.missingSkills = ensureArray(validated.jobFit?.missingSkills);
  validated.jobFit.resumeOnlySkills = ensureArray(validated.jobFit?.resumeOnlySkills);
  validated.jobFit.evidence = ensureArray(validated.jobFit?.evidence);
  validated.questionAnswerAnalysis = ensureArray(validated.questionAnswerAnalysis);
  validated.strongAnswers = ensureArray(validated.strongAnswers);
  validated.weakAnswers = ensureArray(validated.weakAnswers);
  validated.areasForImprovement = ensureArray(validated.areasForImprovement);

  return validated;
};

/**
 * Validate and normalize the interviewer report JSON from Groq.
 */
const validateInterviewerReport = (raw) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Groq response is not an object.");
  }

  const required = ["overallScore", "summary", "questionQuality", "followUpQuality",
    "interviewStructure", "candidateEngagement", "communication", "speakingBalance", "finalAssessment"];

  for (const field of required) {
    if (!(field in raw)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const validated = { ...raw };
  validated.overallScore = clampScore(raw.overallScore);
  validated.questionQuality = { ...raw.questionQuality, score: clampScore(raw.questionQuality?.score) };
  validated.followUpQuality = { ...raw.followUpQuality, score: clampScore(raw.followUpQuality?.score) };
  validated.interviewStructure = { ...raw.interviewStructure, score: clampScore(raw.interviewStructure?.score) };
  validated.candidateEngagement = { ...raw.candidateEngagement, score: clampScore(raw.candidateEngagement?.score) };
  validated.communication = { ...raw.communication, score: clampScore(raw.communication?.score) };

  // Speaking balance
  if (validated.speakingBalance) {
    validated.speakingBalance.interviewerPercentage = clampScore(validated.speakingBalance?.interviewerPercentage);
    validated.speakingBalance.candidatePercentage = clampScore(validated.speakingBalance?.candidatePercentage);
    if (!validated.speakingBalance.assessment) {
      validated.speakingBalance.assessment = "";
    }
  }

  // Ensure arrays
  ["strengths", "weaknesses", "evidence"].forEach(k => {
    validated.questionQuality[k] = ensureArray(validated.questionQuality?.[k]);
    validated.followUpQuality[k] = ensureArray(validated.followUpQuality?.[k]);
    validated.interviewStructure[k] = ensureArray(validated.interviewStructure?.[k]);
    validated.candidateEngagement[k] = ensureArray(validated.candidateEngagement?.[k]);
    validated.communication[k] = ensureArray(validated.communication?.[k]);
  });
  validated.strongQuestions = ensureArray(validated.strongQuestions);
  validated.weakQuestions = ensureArray(validated.weakQuestions);
  validated.areasForImprovement = ensureArray(validated.areasForImprovement);

  return validated;
};

module.exports = { validateCandidateReport, validateInterviewerReport };
