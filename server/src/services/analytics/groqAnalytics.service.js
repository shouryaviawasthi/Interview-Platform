const groqService = require("../ai/groq.service");

const ANALYTICS_SYSTEM_PROMPT = `You are an expert technical interview analytics engine.
Your mission is to perform rigorous semantic analysis on a completed interview transcript.

CORE PRINCIPLES:
1. EVIDENCE BASED: Every claim, topic, milestone, and evaluation MUST cite exact timestamps from the transcript.
2. NO ARITHMETIC HALLUCINATIONS: Do not calculate durations or percentages yourself; use the provided transcript start/end timestamps.
3. LANGUAGE FAIRNESS: Do NOT penalize the candidate for speaking Hindi, Hinglish, or switching languages. Treat technical depth and reasoning quality as the primary evaluation criteria.
4. NO INVENTED EVIDENCE: If an answer was not provided or a topic was not discussed, do NOT invent it.
5. NO AUTOMATED HIRING DECISIONS: Do not output "Hire" or "Reject". Provide objective analytics only.

You MUST respond with a single valid JSON object adhering strictly to the required schema.`;

const buildAnalyticsUserPrompt = ({ jobDescription, transcriptSegments, deterministicMetrics, interviewMeta }) => {
  const formattedTranscript = transcriptSegments
    .map((s, idx) => {
      const spk = (s.speaker || s.speaker_type || "unknown").toUpperCase();
      const st = s.start_time != null ? Number(s.start_time).toFixed(1) : "0.0";
      const et = s.end_time != null ? Number(s.end_time).toFixed(1) : "0.0";
      const txt = s.text || s.transcript_text || "";
      return `[${st}s - ${et}s] ${spk} (seq ${idx + 1}): ${txt}`;
    })
    .join("\n");

  return `INTERVIEW CONTEXT:
Candidate Name: ${interviewMeta?.candidateName || "Candidate"}
Job Description / Role Requirements:
${jobDescription || "Standard Software Engineering / Technical Role"}

PRE-COMPUTED DETERMINISTIC METRICS:
Total Duration: ${deterministicMetrics?.duration?.formatted || "N/A"} (${deterministicMetrics?.duration?.totalSeconds || 0} seconds)
Speaking Time: Interviewer ${deterministicMetrics?.speakingTime?.interviewerFormatted || "0m"} (${deterministicMetrics?.speakingPercentage?.interviewer || 0}%), Candidate ${deterministicMetrics?.speakingTime?.candidateFormatted || "0m"} (${deterministicMetrics?.speakingPercentage?.candidate || 0}%)
Total Turns: ${deterministicMetrics?.turns?.total || 0}

TRANSCRIPT WITH EXACT TIMESTAMPS:
${formattedTranscript}

TASK:
Analyze the conversation semantically and return a JSON object with this EXACT structure:
{
  "questions": {
    "total": <number of distinct questions asked by interviewer>,
    "technical": <number of technical questions>,
    "behavioral": <number of behavioral / cultural questions>,
    "followUps": <number of follow-up questions drilling into previous answers>,
    "repeated": <number of repeated questions>,
    "unanswered": <number of questions left unanswered>
  },
  "questionAnswerMappings": [
    {
      "question": "<Interviewer question text>",
      "answerSnippet": "<Candidate answer summary / snippet>",
      "startTime": <number, timestamp in seconds when question started>,
      "endTime": <number, timestamp in seconds when answer concluded>,
      "category": "technical" | "behavioral" | "follow-up" | "introductory",
      "evaluation": "<Brief 1-2 sentence evidence-linked evaluation of candidate response>"
    }
  ],
  "topics": [
    {
      "topic": "<Technical or domain topic name, e.g. Java, PostgreSQL, System Architecture>",
      "startTime": <number, timestamp in seconds>,
      "endTime": <number, timestamp in seconds>,
      "durationMinutes": <number, approximate minutes based on timestamps>,
      "summary": "<Brief summary of what was discussed>"
    }
  ],
  "timeline": [
    {
      "milestone": "<e.g. Introduction & Background, Deep Dive into Projects, Core Technical Q&A, System Design, Behavioral, Candidate Q&A, Wrap Up>",
      "startTime": <number, timestamp in seconds>,
      "endTime": <number, timestamp in seconds>,
      "description": "<What occurred during this phase>"
    }
  ],
  "candidateInsights": {
    "strongestTechnicalArea": {
      "area": "<Topic name>",
      "explanation": "<Why this was strong with evidence>",
      "startTime": <number>,
      "endTime": <number>
    },
    "weakestTechnicalArea": {
      "area": "<Topic name or N/A>",
      "explanation": "<Specific gap observed>",
      "startTime": <number or null>,
      "endTime": <number or null>
    },
    "mostDifficultQuestion": {
      "question": "<Question text>",
      "challenge": "<Why it was challenging for the candidate>",
      "startTime": <number or null>
    },
    "bestAnswer": {
      "topic": "<Topic>",
      "highlight": "<What made the answer outstanding>",
      "startTime": <number>,
      "endTime": <number>
    },
    "followUpRecommendations": [
      "<Suggested area or topic to probe further in subsequent rounds>"
    ]
  },
  "interviewerInsights": {
    "strongestSection": {
      "section": "<Section name>",
      "highlight": "<Why interviewer conduct was strong here>",
      "startTime": <number>,
      "endTime": <number>
    },
    "bestFollowUpQuestion": {
      "question": "<Question text>",
      "effectiveReason": "<Why this follow-up was insightful>",
      "startTime": <number>
    },
    "unexploredAreas": [
      "<Areas in resume or job requirements that the interviewer did not touch upon>"
    ]
  }
}`;
};

/**
 * Generate semantic analytics using Groq LLM.
 * Returns null if Groq fails or returns unparseable structure.
 */
const generateSemanticAnalytics = async ({ jobDescription, transcriptSegments, deterministicMetrics, interviewMeta }) => {
  try {
    const userPrompt = buildAnalyticsUserPrompt({
      jobDescription,
      transcriptSegments,
      deterministicMetrics,
      interviewMeta,
    });

    const response = await groqService.generateStructuredResponse({
      systemPrompt: ANALYTICS_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.2,
    });

    return response;
  } catch (error) {
    console.error("[GroqAnalytics] Semantic analysis failed:", error.message);
    return null;
  }
};

module.exports = {
  generateSemanticAnalytics,
};
