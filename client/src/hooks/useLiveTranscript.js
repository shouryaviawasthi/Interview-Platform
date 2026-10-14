import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket/socket';

const TARGET_SAMPLE_RATE = 16000;
const AUDIO_CHUNK_SECONDS = 1;

/**
 * Captures microphone audio as mono 16-bit PCM and streams ordered one-second
 * chunks to Deepgram. PCM avoids relying on independently timed WebM fragments.
 */
const useLiveTranscript = ({ interviewId, enabled, stream }) => {
  const [chunks, setChunks] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const activeCaptureRef = useRef(null);

  useEffect(() => {
    if (!interviewId) return undefined;
    const socket = getSocket();
    socketRef.current = socket;

    const handleChunk = (chunk) => {
      setChunks((previous) => {
        if (!chunk.isFinal) {
          const withoutPreviousInterim = previous.filter(
            (item) => item.isFinal || item.interimKey !== chunk.speaker
          );
          return [...withoutPreviousInterim, { ...chunk, interimKey: chunk.speaker }];
        }
        return [...previous.filter((item) => item.interimKey !== chunk.speaker), chunk];
      });
    };

    const handleError = ({ message }) => {
      setError(message);
      console.warn('[LiveTranscript] Error from server:', message);
    };

    const handleStopped = () => setIsActive(false);

    socket.on('live-transcript', handleChunk);
    socket.on('live-transcript-error', handleError);
    socket.on('live-transcript-stopped', handleStopped);

    return () => {
      socket.off('live-transcript', handleChunk);
      socket.off('live-transcript-error', handleError);
      socket.off('live-transcript-stopped', handleStopped);
      socketRef.current = null;
    };
  }, [interviewId]);

  useEffect(() => {
    if (!enabled || !stream || !interviewId || !socketRef.current) return undefined;
    if (activeCaptureRef.current) return undefined;

    const socket = socketRef.current;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      setError('No microphone audio track is available for transcription.');
      return undefined;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      setError('This browser does not support live audio transcription.');
      return undefined;
    }

    let audioContext;
    let source;
    let processor;
    let silentGain;
    let cleanedUp = false;
    let serverReady = false;
    let stopRequested = false;
    let pendingOffset = 0;
    let pendingSamples;
    let queuedAudio = [];
    let sendQueue = Promise.resolve();

    const capture = {
      stop: () => {},
    };
    activeCaptureRef.current = capture;

    const stopServerSession = () => {
      if (stopRequested || !serverReady) return;
      stopRequested = true;
      sendQueue = sendQueue.then(() => new Promise((resolve) => {
        socket.timeout(10000).emit('stop-live-transcript', { interviewId }, (timeoutError, result) => {
          if (timeoutError || !result?.success) {
            setError('Could not finish sending the final audio to transcription.');
            console.error('[LiveTranscript] Server did not acknowledge stream finalization.');
          }
          setIsActive(false);
          resolve();
        });
      }));
    };

    const sendPcm = (samples) => {
      const pcm = new ArrayBuffer(samples.length * 2);
      const dataView = new DataView(pcm);
      for (let index = 0; index < samples.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, samples[index]));
        dataView.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      }
      queuedAudio.push(pcm);
      if (serverReady) flushQueuedAudio();
    };

    const flushQueuedAudio = () => {
      const batches = queuedAudio;
      queuedAudio = [];
      for (const chunk of batches) {
        sendQueue = sendQueue.then(() => new Promise((resolve, reject) => {
          socket.timeout(15000).emit('audio-chunk', { interviewId, chunk }, (timeoutError, result) => {
            if (timeoutError) return reject(timeoutError);
            if (!result?.success) {
              return reject(new Error(result?.message || 'Server rejected an audio chunk.'));
            }
            resolve();
          });
        })).catch((sendError) => {
          setError('Audio could not be delivered for transcription. Check the connection and retry.');
          console.error('[LiveTranscript] Audio chunk delivery failed:', sendError.message);
        });
      }
    };

    const flushPartialSamples = () => {
      if (pendingOffset === 0) return;
      sendPcm(pendingSamples.slice(0, pendingOffset));
      pendingOffset = 0;
    };

    const cleanupCapture = () => {
      if (processor) processor.onaudioprocess = null;
      try {
        source?.disconnect();
        processor?.disconnect();
        silentGain?.disconnect();
      } catch (disconnectError) {
        console.warn('[LiveTranscript] Could not disconnect audio capture nodes:', disconnectError.message);
      }
      flushPartialSamples();
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch((closeError) => {
          console.warn('[LiveTranscript] Could not close audio context:', closeError.message);
        });
      }
      if (activeCaptureRef.current === capture) activeCaptureRef.current = null;
      if (serverReady) {
        sendQueue.finally(stopServerSession);
      }
    };

    capture.stop = () => {
      cleanedUp = true;
      cleanupCapture();
    };

    const startCapture = async () => {
      try {
        audioContext = new AudioContextConstructor({ sampleRate: TARGET_SAMPLE_RATE });
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (cleanedUp) return;
        if (audioContext.state !== 'running') {
          throw new Error('The browser audio context is suspended; allow microphone audio and retry.');
        }

        pendingSamples = new Float32Array(
          Math.max(1, Math.round(audioContext.sampleRate * AUDIO_CHUNK_SECONDS))
        );
        source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        silentGain = audioContext.createGain();
        silentGain.gain.value = 0;

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          let inputOffset = 0;
          while (inputOffset < input.length) {
            const copyLength = Math.min(
              input.length - inputOffset,
              pendingSamples.length - pendingOffset
            );
            pendingSamples.set(input.subarray(inputOffset, inputOffset + copyLength), pendingOffset);
            inputOffset += copyLength;
            pendingOffset += copyLength;

            if (pendingOffset === pendingSamples.length) {
              sendPcm(pendingSamples);
              pendingSamples = new Float32Array(
                Math.max(1, Math.round(audioContext.sampleRate * AUDIO_CHUNK_SECONDS))
              );
              pendingOffset = 0;
            }
          }
        };

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioContext.destination);

        socket.timeout(15000).emit(
          'start-live-transcript',
          { interviewId, sampleRate: audioContext.sampleRate },
          (timeoutError, result) => {
            if (timeoutError || !result?.success) {
              const message = result?.message || 'Could not connect to the live transcription service.';
              setError(message);
              console.error('[LiveTranscript] Could not start stream:', message);
              cleanedUp = true;
              cleanupCapture();
              return;
            }
            serverReady = true;
            setIsActive(true);
            setError(null);
            flushQueuedAudio();
            if (cleanedUp) sendQueue.finally(stopServerSession);
          }
        );
      } catch (captureError) {
        if (!cleanedUp) {
          setError(captureError.message || 'Could not start microphone audio capture.');
        }
        console.error('[LiveTranscript] Audio capture initialization failed:', captureError);
        cleanedUp = true;
        cleanupCapture();
      }
    };

    startCapture();
    return () => capture.stop();
  }, [enabled, stream, interviewId]);

  const clearTranscript = useCallback(() => setChunks([]), []);
  const finalChunks = chunks.filter((chunk) => chunk.isFinal);

  return {
    chunks,
    finalChunks,
    isActive,
    error,
    clearTranscript,
  };
};

export default useLiveTranscript;
