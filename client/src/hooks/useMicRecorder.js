import { useCallback, useEffect, useRef, useState } from "react";
import { CHUNK_DURATION_MS } from "../lib/config";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
};

/**
 * Captures microphone audio as a sequence of short, independently
 * decodable chunks, by repeatedly stopping and restarting a
 * MediaRecorder on the same stream — rather than using MediaRecorder's
 * built-in timeslice, whose *continuation* blobs aren't valid standalone
 * audio files (only the first carries the container header). Each
 * completed chunk is handed to onChunk(blob, mimeType, elapsedSeconds)
 * for upload/transcription. There's a small (<50ms) gap between chunks
 * from the restart — an accepted tradeoff for chunks that reliably
 * decode on their own anywhere.
 */
export const useMicRecorder = ({ onChunk, chunkDurationMs = CHUNK_DURATION_MS } = {}) => {
  const [status, setStatus] = useState("idle"); // idle | requesting | recording | muted | error
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunkBufferRef = useRef([]);
  const restartTimerRef = useRef(null);
  const capturingRef = useRef(false);
  const mutedRef = useRef(false);
  const mimeTypeRef = useRef("");
  const captureStartRef = useRef(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const clearTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const recordOneChunk = useCallback(() => {
    if (!capturingRef.current || !streamRef.current) return;

    try {
      const recorder = new MediaRecorder(streamRef.current, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined);
      chunkBufferRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunkBufferRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunkBufferRef.current, { type: mimeTypeRef.current || "audio/webm" });
        chunkBufferRef.current = [];

        // Discard near-empty chunks and anything recorded while muted —
        // muting disables the audio track (captures silence) rather than
        // tearing the recorder down, so this is what actually stops
        // audio from being sent while muted.
        if (blob.size > 500 && !mutedRef.current && onChunkRef.current) {
          const elapsedSeconds = captureStartRef.current ? (Date.now() - captureStartRef.current) / 1000 : 0;
          onChunkRef.current(blob, mimeTypeRef.current, elapsedSeconds);
        }

        if (capturingRef.current) {
          recordOneChunk();
        }
      };

      recorderRef.current = recorder;
      recorder.start();

      restartTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, chunkDurationMs);
    } catch (err) {
      setError(err?.message || "Recording failed unexpectedly.");
      setStatus("error");
      capturingRef.current = false;
    }
  }, [chunkDurationMs]);

  const start = useCallback(async () => {
    if (capturingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser doesn't support microphone capture.");
      setStatus("error");
      return;
    }

    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeTypeRef.current = pickMimeType();
      capturingRef.current = true;
      mutedRef.current = false;
      captureStartRef.current = Date.now();
      setStatus("recording");
      recordOneChunk();
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone access was denied. Allow microphone access and try again."
          : err?.message || "Couldn't access the microphone."
      );
      setStatus("error");
    }
  }, [recordOneChunk]);

  const stop = useCallback(() => {
    capturingRef.current = false;
    clearTimer();
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.onstop = null; // don't restart or flush a final partial chunk
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStatus("idle");
  }, []);

  const setMuted = useCallback((value) => {
    mutedRef.current = value;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !value;
    });
    setStatus((prev) => (prev === "error" ? prev : value ? "muted" : "recording"));
  }, []);

  // Always release the mic when the component unmounts.
  useEffect(() => stop, [stop]);

  return { status, error, start, stop, setMuted, isLive: status === "recording" };
};
