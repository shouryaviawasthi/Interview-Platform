import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useAudioRecorder
 *
 * Records MIXED audio (local mic + remote audio) into a single MediaRecorder.
 * The recording is audio-only — no video tracks are captured.
 *
 * Usage:
 *   const { startRecording, stopRecording, isRecording, error } = useAudioRecorder();
 *
 *   startRecording(localStream, remoteStream)
 *   stopRecording()  →  calls onComplete(blob, mimeType) when finalized
 *
 * Architecture:
 *   localStream  (from useLocalMedia)
 *       +
 *   remoteStream (from useWebRTC)
 *       ↓
 *   AudioContext.createMediaStreamSource  x2
 *       ↓
 *   AudioContext.destination
 *       ↓
 *   MediaRecorder (audio/webm preferred)
 *       ↓
 *   Blob on stop
 *
 * NOTE: We use an AudioContext merge rather than directly passing tracks,
 * because MediaStream tracks from different sources cannot be trivially mixed
 * without an AudioContext destination stream.
 */
export const useAudioRecorder = ({ onComplete } = {}) => {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const destRef = useRef(null);
  const connectedTrackIdsRef = useRef(new Set());
  const isRecordingRef = useRef(false);
  const discardRecordingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const latestStreamsRef = useRef({ local: null, remote: null });
  onCompleteRef.current = onComplete;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  // Pick best supported MIME type
  const getBestMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  };

  const connectStreams = useCallback((...streams) => {
    const ctx = audioCtxRef.current;
    const destination = destRef.current;
    if (!ctx || !destination) return;

    streams.filter(Boolean).forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        if (connectedTrackIdsRef.current.has(track.id)) return;

        try {
          const source = ctx.createMediaStreamSource(new MediaStream([track]));
          source.connect(destination);
          connectedTrackIdsRef.current.add(track.id);
        } catch (err) {
          console.error("[AudioRecorder] Could not add an audio track:", err);
          setError(err.message || "Could not add an interview audio track to the recording.");
        }
      });
    });
  }, []);

  const startRecording = useCallback(async (localStream, remoteStream) => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    discardRecordingRef.current = false;
    setError(null);

    try {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("AudioContext is not supported in this browser.");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Audio recording is not supported in this browser.");
      }

      const ctx = new AudioContextConstructor();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") {
        throw new Error("Audio recording is blocked. Tap the page and start the interview again.");
      }

      const destination = ctx.createMediaStreamDestination();
      destRef.current = destination;
      connectedTrackIdsRef.current.clear();
      connectStreams(
        latestStreamsRef.current.local || localStream,
        latestStreamsRef.current.remote || remoteStream
      );

      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        isRecordingRef.current = false;
        setIsRecording(false);
        connectedTrackIdsRef.current.clear();

        audioCtxRef.current?.close().catch((closeError) => {
          console.warn("[AudioRecorder] Could not close AudioContext:", closeError);
        });
        audioCtxRef.current = null;
        destRef.current = null;

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
        } else if (blob.size > 0) {
          onCompleteRef.current?.(blob, mimeType || recorder.mimeType || "audio/webm");
        } else {
          setError("Recording produced an empty audio file.");
        }
      };

      recorder.onerror = (event) => {
        const message = event.error?.message || "Recording error.";
        console.error("[AudioRecorder] MediaRecorder error:", message);
        setError(message);
        isRecordingRef.current = false;
        setIsRecording(false);
      };

      recorder.start(5000);
      setIsRecording(true);
      console.log("[AudioRecorder] Started recording. MIME:", mimeType || "(default)");
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecording(false);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      destRef.current = null;
      console.error("[AudioRecorder] Failed to start:", err);
      setError(err.message || "Could not start audio recording.");
    }
  }, [connectStreams]);

  const updateStreams = useCallback((localStream, remoteStream) => {
    latestStreamsRef.current = { local: localStream, remote: remoteStream };
    if (isRecordingRef.current) connectStreams(localStream, remoteStream);
  }, [connectStreams]);

  const stopRecording = useCallback(({ discard = false } = {}) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      console.warn("[AudioRecorder] stopRecording called but recorder not active.");
      return;
    }
    discardRecordingRef.current = discard;
    recorder.stop();
    console.log("[AudioRecorder] Stopped recording.");
  }, []);

  // Safety cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return { startRecording, updateStreams, stopRecording, isRecording, error };
};
