const { DeepgramClient } = require('@deepgram/sdk');
const env = require('../../config/env');
const transcriptModel = require('../../models/transcript.model');

/**
 * Live Transcription Service (Deepgram Nova-2) — SDK v5 compatible
 *
 * Architecture:
 *  - One Deepgram live connection per interview room (keyed by interviewId)
 *  - Audio chunks arrive as Buffers via Socket.IO's audio-chunk event
 *  - Deepgram streams back transcript → server emits live-transcript to the room
 *  - Connection is cleaned up when the interview ends or all sockets leave
 *
 * Deepgram SDK v5: `client.listen.v1.connect()` returns a Promise<connection>
 * The connection is an EventEmitter with `.on('open'|'message'|'error'|'close', cb)`
 * Audio is sent via `connection.socket.send(buffer)`.
 */

// Map<interviewId, { connection, io, interviewId, transcript, speakerLabel, ready, keepAliveInterval }>
const activeSessions = new Map();

/**
 * Start a Deepgram live transcription session for an interview room.
 */
const startSession = async (interviewId, io) => {
  if (activeSessions.has(interviewId)) {
    console.log('[LiveTranscript] Session already active for ' + interviewId);
    return false;
  }

  if (!env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY is not configured.');
  }

  const deepgram = new DeepgramClient({ apiKey: env.DEEPGRAM_API_KEY });

  // connect() is async in SDK v5 and returns a promise-like connection
  const connection = await deepgram.listen.v1.connect({
    model: 'nova-2',
    language: 'multi',
    smart_format: true,
    punctuate: true,
    interim_results: true,
    utterance_end_ms: 1500,
    vad_events: false,
  });

  const session = {
    connection,
    io,
    interviewId,
    transcript: [],
    speakerLabel: null,
    ready: false,
    keepAliveInterval: null,
  };

  const openPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Deepgram connection timeout (10s)'));
    }, 10000);

    connection.on('open', () => {
      clearTimeout(timeout);
      session.ready = true;
      console.log('[LiveTranscript] Deepgram connection OPEN for room ' + interviewId);

      // Send keepAlive every 8 seconds to prevent idle timeout (Deepgram closes idle connections after 12s)
      session.keepAliveInterval = setInterval(() => {
        if (session.ready && connection.socket && connection.socket.readyState === 1) {
          try {
            // Send Deepgram keepAlive message as JSON
            connection.socket.send(JSON.stringify({ type: 'KeepAlive' }));
          } catch (_) {}
        }
      }, 8000);

      resolve();
    });

    connection.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[LiveTranscript] Deepgram open error for ' + interviewId + ':', err?.message || err);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });

  // Handle incoming transcript messages
  connection.on('message', (rawData) => {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      // Handle different Deepgram message types
      if (data?.type === 'Results' || data?.type === 'TranscriptResponse') {
        const alt = data?.channel?.alternatives?.[0];
        if (!alt || !alt.transcript) return;
        const text = alt.transcript.trim();
        if (!text) return;
        const isFinal = data.is_final === true;
        const chunk = {
          id: Date.now() + '-' + Math.random().toString(36).substring(7),
          speaker: session.speakerLabel || 'speaker',
          text,
          isFinal,
          timestamp: Date.now(),
        };
        io.to(interviewId).emit('live-transcript', chunk);
        if (isFinal) session.transcript.push(chunk);
      }
    } catch (_) {}
  });

  connection.on('error', (err) => {
    console.error('[LiveTranscript] Deepgram runtime error for ' + interviewId + ':', err?.message || err);
    io.to(interviewId).emit('live-transcript-error', {
      message: 'Transcription error. Live transcript may be interrupted.',
    });
  });

  connection.on('close', () => {
    console.log('[LiveTranscript] Deepgram connection CLOSED for ' + interviewId);
    if (session.keepAliveInterval) clearInterval(session.keepAliveInterval);
    session.ready = false;
    activeSessions.delete(interviewId);
  });

  activeSessions.set(interviewId, session);

  await openPromise;

  console.log('[LiveTranscript] Session started for interview ' + interviewId);
  return true;
};

/**
 * Send an audio chunk to the active Deepgram session.
 * Uses connection.socket.send() — the underlying ReconnectingWebSocket.
 */
const sendAudioChunk = (interviewId, audioBuffer, speakerLabel) => {
  const session = activeSessions.get(interviewId);
  if (!session || !session.ready) return;
  if (speakerLabel) session.speakerLabel = speakerLabel;
  try {
    const sock = session.connection.socket;
    if (sock && sock.readyState === 1) {
      sock.send(audioBuffer);
    }
  } catch (err) {
    console.error('[LiveTranscript] Failed to send chunk for ' + interviewId + ':', err.message);
  }
};

/**
 * Stop and clean up a Deepgram live session.
 */
const stopSession = async (interviewId) => {
  const session = activeSessions.get(interviewId);
  if (!session) return [];

  // Clear keepAlive
  if (session.keepAliveInterval) {
    clearInterval(session.keepAliveInterval);
    session.keepAliveInterval = null;
  }
  session.ready = false;

  try {
    session.connection.close();
  } catch (_) {}

  const finalTranscript = session.transcript.slice();
  activeSessions.delete(interviewId);
  console.log(
    '[LiveTranscript] Session stopped for ' + interviewId + '. ' + finalTranscript.length + ' final segments.'
  );

  // Persist live transcript segments to DB if no audio-based segments exist
  if (finalTranscript.length > 0) {
    try {
      const existingSegments = await transcriptModel.getSegmentsByInterviewId(interviewId);
      if (!existingSegments || existingSegments.length === 0) {
        const baseTs = finalTranscript[0]?.timestamp || Date.now();
        const dbSegments = finalTranscript.map((chunk, idx) => ({
          speaker_type: chunk.speaker || 'unknown',
          text: chunk.text,
          start_time: Math.round((chunk.timestamp - baseTs) / 1000),
          end_time: null,
          sequence_num: idx + 1,
          confidence: 0.9,
        }));
        await transcriptModel.insertSegments(interviewId, dbSegments);
        console.log(
          `[LiveTranscript] Persisted ${dbSegments.length} live transcript segments into DB for ${interviewId}`
        );

        const audioModel = require('../../models/audio.model');
        const existingAudio = await audioModel.getAudioByInterviewId(interviewId);
        if (existingAudio) {
          await audioModel.updateAudioStatus(interviewId, 'completed');
        } else {
          await audioModel.createAudioRecord({
            interview_id: interviewId,
            file_path: 'live_stream_chunks',
            file_name: 'live_audio.webm',
            mime_type: 'audio/webm',
            file_size: 0,
          });
          await audioModel.updateAudioStatus(interviewId, 'completed');
        }
      }
    } catch (saveErr) {
      console.error(
        `[LiveTranscript] Failed to persist live transcript segments for ${interviewId}:`,
        saveErr.message
      );
    }
  }

  return finalTranscript;
};

const isSessionActive = (interviewId) => activeSessions.has(interviewId);
const getTranscript = (interviewId) => {
  const session = activeSessions.get(interviewId);
  return session ? session.transcript.slice() : [];
};

module.exports = { startSession, sendAudioChunk, stopSession, isSessionActive, getTranscript };
