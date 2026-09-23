import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../socket/socket';

/**
 * useLiveTranscript
 *
 * Captures microphone audio in ~4-second chunks via MediaRecorder,
 * sends each chunk to the server via Socket.IO (audio-chunk event),
 * and listens for live-transcript events back from the server.
 *
 * The server pipes the audio to Deepgram Nova-2 live streaming,
 * then broadcasts transcript chunks back to the room.
 *
 * @param {Object} opts
 * @param {string} opts.interviewId    - The interview room ID
 * @param {string} opts.speakerRole    - 'interviewer' or 'candidate'
 * @param {boolean} opts.enabled       - Whether to start/stop sending
 * @param {MediaStream|null} opts.stream - Local microphone stream
 */
const useLiveTranscript = ({ interviewId, speakerRole, enabled, stream }) => {
  const [chunks, setChunks] = useState([]);        // { id, speaker, text, isFinal, timestamp }
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const socketRef = useRef(null);
  const enabledRef = useRef(enabled);
  const chunkIntervalMs = 4000; // send chunk every 4 seconds

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // ── Listen for transcript chunks from server ───────────────────────
  useEffect(() => {
    if (!interviewId) return;
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const handleChunk = (chunk) => {
      setChunks((prev) => {
        // If interim result, replace previous interim for same id base
        if (!chunk.isFinal) {
          const withoutPrev = prev.filter((c) => c.isFinal || c.interimKey !== chunk.speaker);
          return [...withoutPrev, { ...chunk, interimKey: chunk.speaker }];
        }
        // Final result: remove any interim for that speaker, add final
        return [
          ...prev.filter((c) => c.interimKey !== chunk.speaker),
          chunk,
        ];
      });
    };

    const handleError = ({ message }) => {
      setError(message);
      console.warn('[LiveTranscript] Error from server:', message);
    };

    const handleStarted = () => {
      setIsActive(true);
      setError(null);
      console.log('[LiveTranscript] Live session started by server');
    };

    const handleStopped = () => {
      setIsActive(false);
      console.log('[LiveTranscript] Live session stopped by server');
    };

    socket.on('live-transcript', handleChunk);
    socket.on('live-transcript-error', handleError);
    socket.on('live-transcript-started', handleStarted);
    socket.on('live-transcript-stopped', handleStopped);

    return () => {
      socket.off('live-transcript', handleChunk);
      socket.off('live-transcript-error', handleError);
      socket.off('live-transcript-started', handleStarted);
      socket.off('live-transcript-stopped', handleStopped);
    };
  }, [interviewId]);

  // ── Start sending audio chunks when enabled + stream available ─────
  useEffect(() => {
    if (!enabled || !stream || !interviewId || !socketRef.current) return;
    if (recorderRef.current) return; // already recording

    const socket = socketRef.current;

    // Request server to open Deepgram connection
    socket.emit('start-live-transcript', { interviewId });

    // Get only the audio track
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const audioStream = new MediaStream([audioTrack]);

    // Determine best supported mime type
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ].find((t) => MediaRecorder.isTypeSupported(t)) || '';

    let recorder;
    try {
      recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
    } catch (e) {
      console.error('[LiveTranscript] MediaRecorder init failed:', e.message);
      setError('Could not start audio capture for transcription.');
      return;
    }

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size < 100) return; // skip tiny/silent chunks
      if (!enabledRef.current) return;
      event.data.arrayBuffer().then((buffer) => {
        socket.emit('audio-chunk', {
          interviewId,
          chunk: buffer,
          speaker: speakerRole,
        });
      });
    };

    recorder.onerror = (e) => {
      console.error('[LiveTranscript] MediaRecorder error:', e.error?.message);
      setError('Audio capture error during transcription.');
    };

    recorder.start(chunkIntervalMs); // fires ondataavailable every 4 seconds
    recorderRef.current = recorder;
    console.log('[LiveTranscript] MediaRecorder started, sending chunks every', chunkIntervalMs, 'ms');

    return () => {
      // Cleanup: stop recorder and tell server to close Deepgram session
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorderRef.current = null;
      socket.emit('stop-live-transcript', { interviewId });
    };
  }, [enabled, stream, interviewId, speakerRole]);

  const clearTranscript = useCallback(() => setChunks([]), []);

  // Final-only segments (no interim duplicates)
  const finalChunks = chunks.filter((c) => c.isFinal);

  return {
    chunks,          // all chunks including interim
    finalChunks,     // only finalized chunks
    isActive,
    error,
    clearTranscript,
  };
};

export default useLiveTranscript;
