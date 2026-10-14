const { DeepgramClient } = require('@deepgram/sdk');
const env = require('../../config/env');
const transcriptModel = require('../../models/transcript.model');

/**
 * Live Transcription Service (Deepgram Nova-3) — SDK v5 compatible
 *
 * Architecture:
 *  - One Deepgram live connection per participant role in an interview
 *  - Audio chunks arrive as Buffers via Socket.IO's audio-chunk event
 *  - Deepgram streams back transcript → server emits live-transcript to the room
 *  - Connection is cleaned up when the interview ends or all sockets leave
 *
 * Deepgram SDK v5: `client.listen.v1.connect()` creates the connection;
 * `connection.connect()` opens its WebSocket.
 */

// Map<interviewId, { io, speakers: Map<role, { connection, transcript, ready, stopped }> }>
const activeSessions = new Map();

/**
 * Start a participant-specific Deepgram stream so the authenticated room role
 * can be attached to each transcript segment without guessing diarization IDs.
 */
const startSession = async (interviewId, io, speakerRole, sampleRate) => {
  if (!['interviewer', 'candidate'].includes(speakerRole)) {
    throw new Error('A valid interview participant role is required for transcription.');
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000) {
    throw new Error('A valid microphone sample rate between 8000 and 48000 Hz is required.');
  }
  if (!env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY is not configured.');
  }

  let interviewSession = activeSessions.get(interviewId);
  if (!interviewSession) {
    interviewSession = { io, speakers: new Map(), startedAt: Date.now() };
    activeSessions.set(interviewId, interviewSession);
  }
  if (interviewSession.speakers.has(speakerRole)) {
    console.log(`[LiveTranscript] ${speakerRole} stream already active for ${interviewId}`);
    return false;
  }

  const deepgram = new DeepgramClient({ apiKey: env.DEEPGRAM_API_KEY });

  // connect() is async in SDK v5 and returns a promise-like connection
  const connection = await deepgram.listen.v1.connect({
    model: 'nova-3',
    language: 'multi',
    encoding: 'linear16',
    sample_rate: sampleRate,
    channels: 1,
    diarize: false,
    filler_words: true,
    numerals: false,
    smart_format: false,
    punctuate: false,
    queryParams: { filler_words: "true" },
    interim_results: true,
    utterance_end_ms: 1500,
    vad_events: false,
  });

  const session = {
    connection,
    role: speakerRole,
    interviewId,
    transcript: [],
    ready: false,
    stopped: false,
    stopping: false,
    stopPromise: null,
    resolveFinalize: null,
    persisted: false,
    keepAliveInterval: null,
  };
  interviewSession.speakers.set(speakerRole, session);

  let rejectOpen;
  let openSettled = false;
  let openTimeout;
  const openPromise = new Promise((resolve, reject) => {
    rejectOpen = reject;
    openTimeout = setTimeout(() => {
      openSettled = true;
      reject(new Error('Deepgram connection timeout (10s)'));
    }, 10000);

    connection.on('open', () => {
      if (openSettled) return;
      openSettled = true;
      clearTimeout(openTimeout);
      session.ready = true;
      console.log('[LiveTranscript] Deepgram connection OPEN for room ' + interviewId);

      // Send keepAlive every 8 seconds to prevent idle timeout (Deepgram closes idle connections after 12s)
      session.keepAliveInterval = setInterval(() => {
        if (session.ready && connection.socket && connection.socket.readyState === 1) {
          try {
            connection.sendKeepAlive({ type: 'KeepAlive' });
          } catch (_) {}
        }
      }, 8000);

      resolve();
    });
  });

  // Handle incoming transcript messages
  connection.on('message', (rawData) => {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      // Handle different Deepgram message types
      if (data?.type === 'Results' || data?.type === 'TranscriptResponse') {
        if (data.from_finalize === true) session.resolveFinalize?.();
        const alt = data?.channel?.alternatives?.[0];
        if (!alt) return;
        const isFinal = data.is_final === true;
        const words = alt.words || [];
        const rawText = words
          .map((word) => word.word)
          .filter((word) => typeof word === 'string' && word.length > 0)
          .join(' ') || alt.transcript || '';
        if (!rawText.trim()) return;
        const chunks = [{ speaker: speakerRole, text: rawText }];

        for (const transcriptChunk of chunks) {
          const chunk = {
            id: Date.now() + '-' + Math.random().toString(36).substring(7),
            ...transcriptChunk,
            isFinal,
            timestamp: Date.now(),
          };
          interviewSession.io.to(interviewId).emit('live-transcript', chunk);
          if (isFinal) session.transcript.push(chunk);
        }
      }
    } catch (_) {}
  });

  connection.on('error', (err) => {
    if (!openSettled) {
      openSettled = true;
      clearTimeout(openTimeout);
      rejectOpen(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    console.error('[LiveTranscript] Deepgram runtime error for ' + interviewId + ':', err?.message || err);
    interviewSession.io.to(interviewId).emit('live-transcript-error', {
      message: 'Transcription error. Live transcript may be interrupted.',
    });
  });

  connection.on('close', () => {
    console.log('[LiveTranscript] Deepgram connection CLOSED for ' + interviewId);
    session.resolveFinalize?.();
    if (session.keepAliveInterval) clearInterval(session.keepAliveInterval);
    session.ready = false;
    session.stopped = true;
    if (!openSettled) {
      openSettled = true;
      clearTimeout(openTimeout);
      rejectOpen(new Error('Deepgram connection closed before opening.'));
    }
  });

  try {
    connection.connect();
    await openPromise;
  } catch (error) {
    clearTimeout(openTimeout);
    session.ready = false;
    interviewSession.speakers.delete(speakerRole);
    if (interviewSession.speakers.size === 0) activeSessions.delete(interviewId);
    connection.close();
    throw error;
  }

  console.log(`[LiveTranscript] ${speakerRole} stream started for interview ${interviewId}`);
  return true;
};

/**
 * Send an audio chunk to the active Deepgram session.
 */
const sendAudioChunk = (interviewId, speakerRole, audioBuffer) => {
  const session = activeSessions.get(interviewId)?.speakers.get(speakerRole);
  if (!session || !session.ready || session.stopping) return false;
  try {
    session.connection.sendMedia(audioBuffer);
    return true;
  } catch (err) {
    console.error('[LiveTranscript] Failed to send chunk for ' + interviewId + ':', err.message);
    return false;
  }
};

/**
 * Stop and clean up a Deepgram live session.
 */
const persistSpeakerTranscript = async (interviewId, interviewSession, session) => {
  if (session.persisted || session.transcript.length === 0) return;
  const existingSegments = await transcriptModel.getSegmentsByInterviewId(interviewId);
  const sequenceStart = existingSegments.length;
  const transcript = session.transcript.slice().sort((left, right) => left.timestamp - right.timestamp);
  const dbSegments = transcript.map((chunk, idx) => ({
    speaker: session.role,
    speaker_type: session.role,
    text: chunk.text,
    start_time: Math.max(0, Math.round((chunk.timestamp - interviewSession.startedAt) / 1000)),
    end_time: null,
    sequence_num: sequenceStart + idx + 1,
    confidence: 0.9,
  }));
  await transcriptModel.insertSegments(interviewId, dbSegments);
  session.persisted = true;

  const audioModel = require('../../models/audio.model');
  const existingAudio = await audioModel.getAudioByInterviewId(interviewId);
  if (existingAudio?.file_path === 'live_stream_chunks') {
    await audioModel.updateAudioStatus(interviewId, 'completed');
  } else if (!existingAudio) {
    await audioModel.createAudioRecord({
      interview_id: interviewId,
      file_path: 'live_stream_chunks',
      file_name: 'live_audio.webm',
      mime_type: 'audio/webm',
      file_size: 0,
    });
    await audioModel.updateAudioStatus(interviewId, 'completed');
  }
  await audioModel.saveSpeakerMap(interviewId, { [session.role]: session.role });

  console.log(`[LiveTranscript] Persisted ${dbSegments.length} ${session.role} transcript segments for ${interviewId}`);
};

/**
 * Stop one participant stream or all streams when the interview ends.
 */
const stopSession = async (interviewId, speakerRole = null) => {
  const interviewSession = activeSessions.get(interviewId);
  if (!interviewSession) {
    if (!speakerRole) await processUploadedAudio(interviewId);
    return [];
  }
  const sessions = speakerRole
    ? [interviewSession.speakers.get(speakerRole)].filter(Boolean)
    : [...interviewSession.speakers.values()];
  const finalTranscript = [];

  for (const session of sessions) {
    if (!session.stopPromise) {
      session.stopping = true;
      session.stopPromise = (async () => {
        if (session.keepAliveInterval) {
          clearInterval(session.keepAliveInterval);
          session.keepAliveInterval = null;
        }
        if (session.ready && !session.stopped) {
          try {
            await new Promise((resolve) => {
              const timeout = setTimeout(resolve, 5000);
              session.resolveFinalize = () => {
                clearTimeout(timeout);
                session.resolveFinalize = null;
                resolve();
              };
              session.connection.sendFinalize({ type: 'Finalize' });
            });
          } catch (error) {
            console.error(`[LiveTranscript] Failed to finalize ${session.role} stream:`, error.message);
          }
        }
        session.ready = false;
        session.stopped = true;
        try {
          session.connection.close();
        } catch (error) {
          console.error(`[LiveTranscript] Failed to close ${session.role} stream:`, error.message);
        }
        try {
          await persistSpeakerTranscript(interviewId, interviewSession, session);
        } catch (saveErr) {
          console.error(`[LiveTranscript] Failed to persist ${session.role} transcript for ${interviewId}:`, saveErr.message);
        }
      })();
    }
    await session.stopPromise;
    finalTranscript.push(...session.transcript);
    if (speakerRole) interviewSession.speakers.delete(session.role);
  }

  const allStreamsStopped = !speakerRole || interviewSession.speakers.size === 0;
  if (allStreamsStopped) {
    activeSessions.delete(interviewId);
    await processUploadedAudio(interviewId);
  }
  console.log(`[LiveTranscript] Stopped ${speakerRole || 'all'} stream(s) for ${interviewId}; ${finalTranscript.length} final segments.`);
  return finalTranscript;
};

const processUploadedAudio = async (interviewId) => {
  const audioModel = require('../../models/audio.model');
  const audio = await audioModel.getAudioByInterviewId(interviewId);
  if (!audio || audio.status !== 'uploaded' || audio.file_path === 'live_stream_chunks') return;
  const { processAudio } = require('./transcription.service');
  await processAudio(interviewId);
};

const isSessionActive = (interviewId) => activeSessions.has(interviewId);
const getTranscript = (interviewId) => {
  const session = activeSessions.get(interviewId);
  return session
    ? [...session.speakers.values()].flatMap((speakerSession) => speakerSession.transcript)
    : [];
};

module.exports = { startSession, sendAudioChunk, stopSession, isSessionActive, getTranscript };
