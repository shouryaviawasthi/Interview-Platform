/**
 * Deterministic Interview Analytics Calculator
 *
 * Computes all mathematical, timing, pause, turn-taking, filler-word,
 * and language statistics using pure backend algorithms.
 * Groq LLM must NEVER perform arithmetic or basic counts.
 */

const formatTime = (totalSeconds) => {
  if (totalSeconds == null || isNaN(totalSeconds)) return "00:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// Common English and Hindi/Hinglish conversational markers
const FILLER_PATTERNS = [
  { word: "um", regex: /\bum+\b/gi, language: "en" },
  { word: "uh", regex: /\buh+\b/gi, language: "en" },
  { word: "like", regex: /\blike\b/gi, language: "en" },
  { word: "you know", regex: /\byou know\b/gi, language: "en" },
  { word: "actually", regex: /\bactually\b/gi, language: "en" },
  { word: "basically", regex: /\bbasically\b/gi, language: "en" },
  { word: "i mean", regex: /\bi mean\b/gi, language: "en" },
  { word: "sort of", regex: /\bsort of\b/gi, language: "en" },
  { word: "kind of", regex: /\bkind of\b/gi, language: "en" },
  { word: "matlab", regex: /\bmatlab\b/gi, language: "hi" },
  { word: "haan", regex: /\bhaan+\b/gi, language: "hi" },
  { word: "toh", regex: /\btoh\b/gi, language: "hi" },
  { word: "sahi", regex: /\bsahi\b/gi, language: "hi" },
  { word: "yaani", regex: /\byaani\b/gi, language: "hi" },
  { word: "hmm", regex: /\bhmm+\b/gi, language: "neutral" },
];

// Hindi script (Devanagari) regex and Latin-script Hindi common indicator tokens
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const HINDI_LATIN_KEYWORDS = new Set([
  "kya", "hai", "hain", "kaise", "mein", "aur", "nahi", "tha", "the", "thi",
  "kar", "karna", "raha", "rahe", "rahi", "hoga", "hogi", "accha", "theek",
  "samajh", "bhi", "yeh", "woh", "unka", "mera", "meri", "hum", "aap", "tum"
]);

/**
 * Identify language distribution for a set of segments.
 */
const analyzeLanguageDistribution = (segments) => {
  let englishTokens = 0;
  let hindiTokens = 0;
  let totalTokens = 0;

  for (const seg of segments) {
    const text = seg.text || seg.transcript_text || "";
    if (!text.trim()) continue;

    // Check if segment has Devanagari script
    if (DEVANAGARI_REGEX.test(text)) {
      const words = text.trim().split(/\s+/);
      hindiTokens += words.length;
      totalTokens += words.length;
      continue;
    }

    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
    for (const w of words) {
      if (!w) continue;
      totalTokens++;
      if (HINDI_LATIN_KEYWORDS.has(w)) {
        hindiTokens++;
      } else {
        englishTokens++;
      }
    }
  }

  if (totalTokens === 0) {
    return { englishPct: 100, hindiPct: 0, mixedPct: 0, primaryLanguage: "English" };
  }

  const rawHindiPct = Math.round((hindiTokens / totalTokens) * 100);
  const rawEnglishPct = Math.round((englishTokens / totalTokens) * 100);

  let primaryLanguage = "English";
  let mixedPct = 0;

  if (rawHindiPct > 65) {
    primaryLanguage = "Hindi";
  } else if (rawHindiPct >= 15) {
    primaryLanguage = "Hinglish (Code-Switching)";
    mixedPct = rawHindiPct;
  }

  return {
    englishPct: Math.max(0, 100 - rawHindiPct),
    hindiPct: rawHindiPct,
    mixedPct,
    primaryLanguage,
    totalWords: totalTokens,
  };
};

/**
 * Count filler words and phrases per speaker.
 */
const analyzeFillerWords = (segments) => {
  const getSpeaker = (s) => (s.speaker || s.speaker_type || "unknown").toLowerCase();

  const candidateFillers = {};
  const interviewerFillers = {};
  let candidateTotalFillers = 0;
  let interviewerTotalFillers = 0;
  let candidateTotalWords = 0;
  let interviewerTotalWords = 0;
  const fillerOccurrences = [];

  for (const seg of segments) {
    const spk = getSpeaker(seg);
    const text = seg.text || seg.transcript_text || "";
    if (!text.trim()) continue;

    const wordCount = text.trim().split(/\s+/).length;
    if (spk === "candidate") candidateTotalWords += wordCount;
    if (spk === "interviewer") interviewerTotalWords += wordCount;

    for (const { word, regex } of FILLER_PATTERNS) {
      const matches = text.match(regex);
      if (matches) {
        const count = matches.length;
        if (spk === "candidate") {
          candidateFillers[word] = (candidateFillers[word] || 0) + count;
          candidateTotalFillers += count;
        } else if (spk === "interviewer") {
          interviewerFillers[word] = (interviewerFillers[word] || 0) + count;
          interviewerTotalFillers += count;
        }

        fillerOccurrences.push({
          word,
          speaker: spk,
          startTime: seg.start_time,
          endTime: seg.end_time,
          snippet: text.slice(0, 100),
        });
      }
    }
  }

  const candidateFreqPer100Words = candidateTotalWords > 0
    ? parseFloat(((candidateTotalFillers / candidateTotalWords) * 100).toFixed(1))
    : 0;

  const interviewerFreqPer100Words = interviewerTotalWords > 0
    ? parseFloat(((interviewerTotalFillers / interviewerTotalWords) * 100).toFixed(1))
    : 0;

  return {
    candidate: {
      totalCount: candidateTotalFillers,
      breakdown: candidateFillers,
      frequencyPer100Words: candidateFreqPer100Words,
      totalWords: candidateTotalWords,
    },
    interviewer: {
      totalCount: interviewerTotalFillers,
      breakdown: interviewerFillers,
      frequencyPer100Words: interviewerFreqPer100Words,
      totalWords: interviewerTotalWords,
    },
    sampleOccurrences: fillerOccurrences.slice(0, 15),
  };
};

/**
 * Group contiguous segments by speaker into conversational turns.
 */
const buildConversationalTurns = (segments) => {
  const getSpeaker = (s) => (s.speaker || s.speaker_type || "unknown").toLowerCase();
  const turns = [];

  let currentTurn = null;

  for (const seg of segments) {
    const spk = getSpeaker(seg);
    const start = seg.start_time != null ? parseFloat(seg.start_time) : 0;
    const end = seg.end_time != null ? parseFloat(seg.end_time) : start;
    const text = (seg.text || seg.transcript_text || "").trim();

    if (!currentTurn) {
      currentTurn = {
        speaker: spk,
        startTime: start,
        endTime: end,
        duration: Math.max(0, end - start),
        textParts: [text],
        segmentCount: 1,
      };
    } else if (currentTurn.speaker === spk) {
      // Same speaker continues turn
      currentTurn.endTime = Math.max(currentTurn.endTime, end);
      currentTurn.duration = Math.max(0, currentTurn.endTime - currentTurn.startTime);
      currentTurn.textParts.push(text);
      currentTurn.segmentCount++;
    } else {
      // Speaker changed -> finalize previous turn and begin new one
      currentTurn.text = currentTurn.textParts.join(" ");
      delete currentTurn.textParts;
      turns.push(currentTurn);

      currentTurn = {
        speaker: spk,
        startTime: start,
        endTime: end,
        duration: Math.max(0, end - start),
        textParts: [text],
        segmentCount: 1,
      };
    }
  }

  if (currentTurn) {
    currentTurn.text = currentTurn.textParts.join(" ");
    delete currentTurn.textParts;
    turns.push(currentTurn);
  }

  return turns;
};

/**
 * Detect conversational pauses and question-response latency.
 */
const analyzePausesAndLatency = (turns, segments) => {
  const pauses = [];
  const responseDelays = [];

  // Analyze pauses between contiguous segments
  for (let i = 0; i < segments.length - 1; i++) {
    const curr = segments[i];
    const next = segments[i + 1];

    if (curr.end_time != null && next.start_time != null) {
      const gap = parseFloat(next.start_time) - parseFloat(curr.end_time);
      if (gap >= 2.0) { // Gap of 2 seconds or more
        const spkBefore = curr.speaker || curr.speaker_type || "unknown";
        const spkAfter = next.speaker || next.speaker_type || "unknown";

        pauses.push({
          startTime: parseFloat(curr.end_time),
          endTime: parseFloat(next.start_time),
          duration: parseFloat(gap.toFixed(1)),
          speakerBefore: spkBefore,
          speakerAfter: spkAfter,
          type: gap >= 4.0 ? "extended response delay" : "long conversational pause",
        });
      }
    }
  }

  // Analyze response delays between turns (specifically Interviewer -> Candidate transitions)
  for (let i = 0; i < turns.length - 1; i++) {
    const currTurn = turns[i];
    const nextTurn = turns[i + 1];

    if (currTurn.speaker === "interviewer" && nextTurn.speaker === "candidate") {
      const delay = Math.max(0, nextTurn.startTime - currTurn.endTime);
      responseDelays.push({
        interviewerTurnEnd: currTurn.endTime,
        candidateTurnStart: nextTurn.startTime,
        delaySeconds: parseFloat(delay.toFixed(1)),
        questionSnippet: currTurn.text.slice(0, 100),
        answerSnippet: nextTurn.text.slice(0, 100),
      });
    }
  }

  const totalDelays = responseDelays.length;
  const avgResponseDelay = totalDelays > 0
    ? parseFloat((responseDelays.reduce((sum, r) => sum + r.delaySeconds, 0) / totalDelays).toFixed(1))
    : 0;

  return {
    longPauses: pauses.sort((a, b) => b.duration - a.duration).slice(0, 15),
    responseDelays: responseDelays.slice(0, 15),
    avgResponseDelay,
    totalPauseEvents: pauses.length,
  };
};

/**
 * Main Deterministic Analytics Calculator
 *
 * @param {Array} segments - Transcript segments from DB
 * @param {number|null} interviewDurationSeconds - Recorded interview duration in seconds
 * @returns {Object} Deterministic metrics object
 */
const calculateDeterministicAnalytics = (segments = [], interviewDurationSeconds = null) => {
  const getSpeaker = (s) => (s.speaker || s.speaker_type || "unknown").toLowerCase();

  let interviewerSecs = 0;
  let candidateSecs = 0;

  const candidateSegments = [];
  const interviewerSegments = [];

  for (const seg of segments) {
    const spk = getSpeaker(seg);
    const dur =
      seg.start_time != null && seg.end_time != null
        ? Math.max(0, parseFloat(seg.end_time) - parseFloat(seg.start_time))
        : 0;

    if (spk === "interviewer") {
      interviewerSecs += dur;
      interviewerSegments.push(seg);
    } else if (spk === "candidate") {
      candidateSecs += dur;
      candidateSegments.push(seg);
    }
  }

  const totalSpeakingSecs = interviewerSecs + candidateSecs;
  const totalDuration = interviewDurationSeconds || Math.round(totalSpeakingSecs) || 0;
  const silenceSecs = Math.max(0, totalDuration - totalSpeakingSecs);

  const interviewerPct = totalSpeakingSecs > 0
    ? parseFloat(((interviewerSecs / totalSpeakingSecs) * 100).toFixed(1))
    : 0;
  const candidatePct = totalSpeakingSecs > 0
    ? parseFloat(((candidateSecs / totalSpeakingSecs) * 100).toFixed(1))
    : 0;

  // Turn taking analytics
  const turns = buildConversationalTurns(segments);
  const interviewerTurns = turns.filter((t) => t.speaker === "interviewer");
  const candidateTurns = turns.filter((t) => t.speaker === "candidate");

  const avgInterviewerTurnDur = interviewerTurns.length > 0
    ? parseFloat((interviewerTurns.reduce((acc, t) => acc + t.duration, 0) / interviewerTurns.length).toFixed(1))
    : 0;

  const avgCandidateTurnDur = candidateTurns.length > 0
    ? parseFloat((candidateTurns.reduce((acc, t) => acc + t.duration, 0) / candidateTurns.length).toFixed(1))
    : 0;

  let longestTurn = { duration: 0, speaker: "none", startTime: 0, endTime: 0 };
  let shortestTurn = { duration: Infinity, speaker: "none", startTime: 0, endTime: 0 };

  for (const t of turns) {
    if (t.duration > longestTurn.duration) {
      longestTurn = {
        duration: parseFloat(t.duration.toFixed(1)),
        speaker: t.speaker,
        startTime: t.startTime,
        endTime: t.endTime,
        snippet: t.text.slice(0, 100),
      };
    }
    if (t.duration > 0 && t.duration < shortestTurn.duration) {
      shortestTurn = {
        duration: parseFloat(t.duration.toFixed(1)),
        speaker: t.speaker,
        startTime: t.startTime,
        endTime: t.endTime,
        snippet: t.text.slice(0, 100),
      };
    }
  }

  if (shortestTurn.duration === Infinity) {
    shortestTurn = { duration: 0, speaker: "none", startTime: 0, endTime: 0 };
  }

  // Filler words
  const fillerStats = analyzeFillerWords(segments);

  // Language stats
  const candidateLanguageStats = analyzeLanguageDistribution(candidateSegments);
  const interviewerLanguageStats = analyzeLanguageDistribution(interviewerSegments);

  // Pauses and Latency
  const pausesAndLatency = analyzePausesAndLatency(turns, segments);

  return {
    duration: {
      totalSeconds: Math.round(totalDuration),
      formatted: formatTime(totalDuration),
      speakingSeconds: Math.round(totalSpeakingSecs),
      silenceSeconds: Math.round(silenceSecs),
    },
    speakingTime: {
      interviewer: Math.round(interviewerSecs),
      interviewerFormatted: formatTime(interviewerSecs),
      candidate: Math.round(candidateSecs),
      candidateFormatted: formatTime(candidateSecs),
    },
    speakingPercentage: {
      interviewer: interviewerPct,
      candidate: candidatePct,
    },
    turns: {
      total: turns.length,
      interviewer: interviewerTurns.length,
      candidate: candidateTurns.length,
      avgInterviewerDuration: avgInterviewerTurnDur,
      avgCandidateDuration: avgCandidateTurnDur,
      longestTurn,
      shortestTurn,
      list: turns.slice(0, 30), // Sample for visualizer
    },
    pausesAndLatency,
    fillers: fillerStats,
    languages: {
      candidate: candidateLanguageStats,
      interviewer: interviewerLanguageStats,
    },
    totalSegments: segments.length,
  };
};

module.exports = {
  calculateDeterministicAnalytics,
  formatTime,
  buildConversationalTurns,
  analyzeFillerWords,
  analyzeLanguageDistribution,
};
