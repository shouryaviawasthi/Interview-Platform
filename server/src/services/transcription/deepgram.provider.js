const fs = require("fs");
const { DeepgramClient } = require("@deepgram/sdk");
const env = require("../../config/env");

/**
 * Deepgram Provider — wraps the Deepgram SDK.
 *
 * Sends an audio file to Deepgram Nova-3 Multilingual with:
 *  - diarize: true      (speaker identification)
 *  - model: nova-3
 *  - language: multi    (English, Hindi, Hinglish, Indian English, code-switching)
 *  - utterances: true   (utterance-level segments)
 *  - punctuate: true
 *  - paragraphs: false  (we handle segmentation ourselves via utterances)
 *
 * Returns an array of normalized segments:
 *  [{
 *    rawSpeaker: "speaker_0",  // Deepgram speaker label
 *    text: "...",
 *    startTime: 12.3,
 *    endTime: 18.7,
 *    confidence: 0.94,
 *    language: "en"
 *  }]
 */
const transcribeAudioFile = async (filePath, mimeType = "audio/webm") => {
  if (!env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not configured on the server.");
  }

  const deepgram = new DeepgramClient({ apiKey: env.DEEPGRAM_API_KEY });

  // Stream local file to Deepgram
  const response = await deepgram.listen.v1.media.transcribeFile(
    fs.createReadStream(filePath),
    {
      model: "nova-3",
      language: "multi",
      diarize: true,
      utterances: true,
      punctuate: true,
      smart_format: true,
    }
  );

  const result = response;
  const channel = result?.results?.channels?.[0];
  if (!channel) {
    throw new Error("Deepgram returned no transcript channels.");
  }

  // Prefer utterances (diarized segments) over plain words
  const utterances = result?.results?.utterances;

  if (utterances && utterances.length > 0) {
    return utterances.map((u) => ({
      rawSpeaker: `speaker_${u.speaker}`,
      text: u.transcript,
      startTime: u.start,
      endTime: u.end,
      confidence: u.confidence ?? null,
      language: u.channel?.detected_language ?? channel.detected_language ?? null,
    }));
  }

  // Fallback: build segments from the alternative words (no diarization available)
  const words = channel.alternatives?.[0]?.words ?? [];
  if (words.length === 0) {
    throw new Error("Deepgram returned an empty transcript.");
  }

  // Group consecutive words by speaker
  const segments = [];
  let currentSpeaker = words[0]?.speaker ?? 0;
  let currentWords = [];
  let segStart = words[0]?.start ?? 0;

  for (const word of words) {
    const spk = word.speaker ?? 0;
    if (spk !== currentSpeaker) {
      segments.push({
        rawSpeaker: `speaker_${currentSpeaker}`,
        text: currentWords.join(" "),
        startTime: segStart,
        endTime: currentWords.length > 0 ? word.start : segStart,
        confidence: null,
        language: null,
      });
      currentSpeaker = spk;
      currentWords = [word.punctuated_word ?? word.word];
      segStart = word.start;
    } else {
      currentWords.push(word.punctuated_word ?? word.word);
    }
  }

  // Push final segment
  if (currentWords.length > 0) {
    const lastWord = words[words.length - 1];
    segments.push({
      rawSpeaker: `speaker_${currentSpeaker}`,
      text: currentWords.join(" "),
      startTime: segStart,
      endTime: lastWord?.end ?? segStart,
      confidence: null,
      language: null,
    });
  }

  return segments;
};

module.exports = { transcribeAudioFile };
