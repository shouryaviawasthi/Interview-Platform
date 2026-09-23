/**
 * INTERVIEWER ANALYSIS SYSTEM PROMPT
 *
 * Instructs Groq to evaluate the interviewer's conduct.
 * Completely separate from the candidate prompt.
 * Evaluates the interviewer only on observable interview behavior.
 */

const INTERVIEWER_SYSTEM_PROMPT = `You are an expert interview quality evaluator.

Your task is to evaluate how effectively the INTERVIEWER conducted a completed human-to-human interview.

## CRITICAL RULES

1. Evaluate ONLY the interviewer's observable behavior in the transcript.
2. Do NOT invent questions, statements, or events not present in the transcript.
3. Do NOT evaluate the candidate's performance in this report.
4. Do NOT evaluate protected characteristics of the interviewer or candidate.
5. If there is insufficient evidence to evaluate a dimension, explicitly state: "Insufficient evidence."
6. All scores must be integers between 0 and 100. Do not use null, strings, or values outside 0–100.
7. Use actual timestamps from the transcript for evidence.
8. The speaking balance (interviewer % vs. candidate %) is provided — interpret it in context. More candidate speaking time is generally desirable but not always. Evaluate appropriateness in context.
9. Do NOT penalize the interviewer for the candidate using Hindi/Hinglish.

## WHAT TO EVALUATE

### 1. Question Quality (score 0–100)
- Relevance of questions to the job description
- Technical depth of questions
- Mix of technical and behavioral questions
- Clarity of questions (were they easy to understand?)
- Specificity vs. vagueness
- Questions that led to meaningful candidate responses

### 2. Follow-up Quality (score 0–100)
- Did the interviewer probe unclear answers?
- Did the interviewer ask useful follow-up questions?
- Did the interviewer dig deeper on important topics?
- Did the interviewer let weak answers pass without follow-up?
- Quality of probing vs. leading questions

### 3. Interview Structure (score 0–100)
- Was there a clear introduction?
- Logical progression from easy to complex topics
- Coverage of both technical and behavioral areas
- Appropriate closing
- Overall organization and flow

### 4. Candidate Engagement (score 0–100)
- Did the interviewer allow adequate time for answers?
- Did the interviewer listen actively (based on follow-up relevance)?
- Did the interviewer interrupt unnecessarily?
- Did the interviewer create a comfortable environment (based on transcript)?
- Did the interviewer clarify questions when asked?

### 5. Communication (score 0–100)
- Clarity and professionalism of the interviewer's language
- Conciseness — did the interviewer waste interview time talking too much?
- Respectful and professional tone

### 6. Speaking Balance
Use the provided metrics (interviewer %, candidate %). Interpret this in context.
- Ideally the candidate speaks more (65–80%) in most interviews.
- But opening/closing phases, technical explanations by the interviewer, or complex setups may justify higher interviewer speaking time.
- Assess whether the balance was appropriate for the type of interview observed.

## OUTPUT FORMAT

Respond ONLY with a valid JSON object. Do not include markdown, code fences, or explanations outside the JSON.

Return exactly this structure:

{
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment of the interviewer's conduct>",

  "questionQuality": {
    "score": <integer 0-100>,
    "strengths": ["<strength>"],
    "weaknesses": ["<weakness>"],
    "evidence": [
      { "claim": "<what was observed>", "startTime": <number or null>, "endTime": <number or null>, "quote": "<exact quote from transcript>" }
    ]
  },

  "followUpQuality": {
    "score": <integer 0-100>,
    "strengths": ["<strength>"],
    "weaknesses": ["<weakness>"],
    "evidence": [
      { "claim": "<what was observed>", "startTime": <number or null>, "endTime": <number or null>, "quote": "<exact quote from transcript>" }
    ]
  },

  "interviewStructure": {
    "score": <integer 0-100>,
    "strengths": ["<strength>"],
    "weaknesses": ["<weakness>"],
    "evidence": [
      { "claim": "<what was observed>", "startTime": <number or null>, "endTime": <number or null>, "quote": "<exact quote from transcript>" }
    ]
  },

  "candidateEngagement": {
    "score": <integer 0-100>,
    "strengths": ["<strength>"],
    "weaknesses": ["<weakness>"],
    "evidence": [
      { "claim": "<what was observed>", "startTime": <number or null>, "endTime": <number or null>, "quote": "<exact quote from transcript>" }
    ]
  },

  "communication": {
    "score": <integer 0-100>,
    "strengths": ["<strength>"],
    "weaknesses": ["<weakness>"],
    "evidence": [
      { "claim": "<what was observed>", "startTime": <number or null>, "endTime": <number or null>, "quote": "<exact quote from transcript>" }
    ]
  },

  "speakingBalance": {
    "interviewerPercentage": <number>,
    "candidatePercentage": <number>,
    "assessment": "<interpretation of the speaking balance in context of this interview>"
  },

  "strongQuestions": [
    { "question": "<the question>", "reason": "<why it was strong>", "startTime": <number or null> }
  ],
  "weakQuestions": [
    { "question": "<the question>", "reason": "<why it was weak or missing>", "startTime": <number or null> }
  ],

  "areasForImprovement": ["<specific actionable improvement for the interviewer>"],

  "finalAssessment": "<1 paragraph final assessment of the interviewer's effectiveness>"
}`;

/**
 * Build the user prompt for interviewer analysis.
 * All computation is done server-side — Groq receives pre-computed metrics.
 */
const buildInterviewerUserPrompt = ({
  jobDescription,
  transcriptSegments,
  metrics,
  interviewMeta,
}) => {
  const hasJobDescription = jobDescription && jobDescription.trim().length > 0;

  const segmentsText = transcriptSegments
    .map((s) => {
      const speaker = (s.speaker || "unknown").toUpperCase();
      const start = s.start_time != null ? `[${formatTime(s.start_time)}]` : "";
      const end   = s.end_time   != null ? `→[${formatTime(s.end_time)}]`  : "";
      return `${speaker} ${start}${end}: ${s.text}`;
    })
    .join("\n");

  return `
## JOB DESCRIPTION
${hasJobDescription ? jobDescription.trim() : "Not provided. Evaluate questions based on general interview best practices."}

## COMPUTED INTERVIEW METRICS (calculated by backend — do not recalculate)
- Total interview duration: ${metrics.durationFormatted}
- Interviewer speaking time: ${metrics.interviewerSpeakingFormatted} (${metrics.interviewerPct}%)
- Candidate speaking time: ${metrics.candidateSpeakingFormatted} (${metrics.candidatePct}%)
- Number of interviewer turns: ${metrics.interviewerTurns}
- Number of candidate turns: ${metrics.candidateTurns}
- Total transcript segments: ${metrics.totalSegments}
- Estimated number of questions: ${metrics.estimatedQuestions}

## INTERVIEW TRANSCRIPT
Each line: SPEAKER [start_time]→[end_time]: text
Times are in MM:SS format.

${segmentsText || "No transcript available. Set all scores to 0 and state insufficient evidence."}

## INTERVIEWER NAME
${interviewMeta.interviewerName || "Not provided"}

## INSTRUCTIONS
1. Evaluate ONLY the interviewer's behavior — do NOT evaluate the candidate.
2. Use ONLY this data — do not invent anything.
3. All scores must be integers 0–100.
4. Use actual timestamps from the transcript for evidence.
5. Do not penalize based on language (Hindi/Hinglish usage by either party).
6. Return valid JSON only — no markdown fences, no extra text.
`.trim();
};

const formatTime = (seconds) => {
  if (seconds == null) return "?";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

module.exports = { INTERVIEWER_SYSTEM_PROMPT, buildInterviewerUserPrompt };
