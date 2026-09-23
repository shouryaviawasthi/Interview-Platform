const groq = require("./groq.client");
const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");

/**
 * One structured-output call produces BOTH the candidate-facing and
 * interviewer-facing reports from the same underlying analysis. Doing it
 * in a single call (rather than two separate prompts) keeps the two
 * reports consistent with each other — they're two views onto one
 * evaluation, not two independent opinions that could contradict.
 *
 * strict: true is only supported on a handful of models (see
 * console.groq.com/docs/structured-outputs) — openai/gpt-oss-120b/20b
 * are among them, which is why that's the default GROQ_LLM_MODEL.
 */
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Holistic performance score from 0-100.",
    },
    recommendation: {
      type: "string",
      enum: ["Hire", "Maybe", "Reject"],
      description: "The interviewer-facing hiring recommendation.",
    },
    competencyScores: {
      type: "array",
      description: "3-6 competencies relevant to the job description, each scored 0-100.",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          score: { type: "number" },
          justification: { type: "string", description: "One sentence, grounded in what was actually said." },
        },
        required: ["skill", "score", "justification"],
        additionalProperties: false,
      },
    },
    candidateReport: {
      type: "object",
      description: "Shown directly to the candidate. Encouraging, specific, growth-oriented. Never mention hire/reject decisions here.",
      properties: {
        overallSummary: { type: "string", description: "2-4 sentences, warm but honest." },
        overallRating: { type: "string", enum: ["Excellent", "Good", "Fair", "Needs Improvement"] },
        strengths: { type: "array", items: { type: "string" }, description: "3-5 specific, genuine strengths." },
        areasToImprove: { type: "array", items: { type: "string" }, description: "3-5 constructive, actionable growth areas." },
        tips: { type: "array", items: { type: "string" }, description: "2-4 actionable tips for future interviews." },
      },
      required: ["overallSummary", "overallRating", "strengths", "areasToImprove", "tips"],
      additionalProperties: false,
    },
    interviewerReport: {
      type: "object",
      description: "Shown only to the interviewer. Direct, detailed, evidence-based hiring evaluation.",
      properties: {
        overallSummary: { type: "string", description: "3-5 sentences summarizing the candidate's performance." },
        strengths: { type: "array", items: { type: "string" } },
        concerns: { type: "array", items: { type: "string" }, description: "Weaknesses or gaps observed." },
        communicationNotes: { type: "string" },
        technicalNotes: { type: "string", description: "Technical/role-specific accuracy notes; if not a technical role, note relevant domain knowledge instead." },
        resumeAlignment: { type: "string", description: "How well interview answers matched the resume and job description. Say so plainly if no resume was provided." },
        suggestedFollowUpQuestions: { type: "array", items: { type: "string" }, description: "2-4 questions a next-round interviewer could ask." },
        redFlags: { type: "array", items: { type: "string" }, description: "Serious concerns only; empty array if none." },
      },
      required: [
        "overallSummary",
        "strengths",
        "concerns",
        "communicationNotes",
        "technicalNotes",
        "resumeAlignment",
        "suggestedFollowUpQuestions",
        "redFlags",
      ],
      additionalProperties: false,
    },
  },
  required: ["overallScore", "recommendation", "competencyScores", "candidateReport", "interviewerReport"],
  additionalProperties: false,
};

const buildSystemPrompt = () => `You are an experienced, fair technical/behavioral interview evaluator.
You will be given a job description, a candidate's resume (optional), and a timestamped transcript of a live interview between an "Interviewer" and a "Candidate".

Ground every judgment ONLY in what actually appears in the transcript. Do not invent claims, numbers, or experience the candidate did not state. If the transcript is short or sparse, say so honestly rather than inventing depth — a short transcript should generally not receive extreme scores in either direction unless the content strongly warrants it.

Write the candidateReport as if the candidate will read it directly: constructive, specific, and encouraging, even when performance was weak — focus on growth. NEVER mention hiring decisions, rejection, or the word "reject" anywhere inside candidateReport.

Write the interviewerReport as a direct, professional hiring evaluation for the interviewer's eyes only: be specific and evidence-based, referencing what was actually said.

Choose competencyScores relevant to the specific job description given (e.g. don't score "React" for a sales role).

Respond only with the structured JSON — no extra commentary.`;

const buildUserPrompt = ({ jobDescription, resumeText, candidateName, transcriptScript }) => {
  const parts = [
    `Job description:\n${jobDescription || "(not provided)"}`,
    `Candidate name: ${candidateName || "(not provided)"}`,
    `Candidate resume text:\n${resumeText ? resumeText.slice(0, 12000) : "(no resume was uploaded for this interview)"}`,
    `Interview transcript:\n${transcriptScript}`,
  ];
  return parts.join("\n\n---\n\n");
};

/**
 * Calls Groq once and returns the parsed, schema-validated analysis
 * object. Throws ApiError on any failure — callers decide whether/how
 * to retry.
 */
const generateAnalysis = async ({ jobDescription, resumeText, candidateName, transcriptScript }) => {
  let response;
  try {
    response = await groq.chat.completions.create({
      model: env.GROQ_LLM_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt({ jobDescription, resumeText, candidateName, transcriptScript }) },
      ],
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interview_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    });
  } catch (err) {
    const status = err?.status;
    if (status === 401) throw new ApiError("Groq API key is missing or invalid", 500);
    if (status === 429) throw new ApiError("AI analysis is rate limited right now, please try again shortly", 429);
    throw ApiError.badGateway("AI analysis is temporarily unavailable");
  }

  const raw = response?.choices?.[0]?.message?.content;
  if (!raw) {
    throw ApiError.badGateway("AI analysis returned an empty response");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_err) {
    throw ApiError.badGateway("AI analysis returned malformed JSON");
  }

  return { analysis: parsed, modelUsed: env.GROQ_LLM_MODEL };
};

module.exports = { generateAnalysis };
