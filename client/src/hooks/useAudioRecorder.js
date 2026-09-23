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

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  // Pick best supported MIME type
  const getBestMimeType = () => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  };

  const startRecording = useCallback(
    (localStream, remoteStream) => {
      if (isRecording) return;
      setError(null);

      try {
        // Create an AudioContext to merge both streams
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          throw new Error("AudioContext not supported in this browser.");
        }

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        // Create a destination node — its stream becomes the recorder input
        const dest = ctx.createMediaStreamDestination();
        destRef.current = dest;

        // Connect local audio tracks
        if (localStream) {
          const localAudioTracks = localStream.getAudioTracks();
          if (localAudioTracks.length > 0) {
            const localAudioStream = new MediaStream(localAudioTracks);
            const localSource = ctx.createMediaStreamSource(localAudioStream);
            localSource.connect(dest);
          }
        }

        // Connect remote audio tracks
        if (remoteStream) {
          const remoteAudioTracks = remoteStream.getAudioTracks();
          if (remoteAudioTracks.length > 0) {
            const remoteAudioStream = new MediaStream(remoteAudioTracks);
            const remoteSource = ctx.createMediaStreamSource(remoteAudioStream);
            remoteSource.connect(dest);
          }
        }

        const mimeType = getBestMimeType();
        const recorderOptions = mimeType ? { mimeType } : {};

        const recorder = new MediaRecorder(dest.stream, recorderOptions);
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: mimeType || "audio/webm",
          });
          chunksRef.current = [];

          // Close AudioContext
          audioCtxRef.current?.close().catch(() => {});
          audioCtxRef.current = null;
          destRef.current = null;

          setIsRecording(false);

          if (blob.size > 0) {
            onComplete?.(blob, mimeType || "audio/webm");
          } else {
            setError("Recording produced an empty audio file.");
          }
        };

        recorder.onerror = (e) => {
          console.error("[AudioRecorder] MediaRecorder error:", e.error?.message);
          setError(e.error?.message || "Recording error.");
          setIsRecording(false);
        };

        // Collect data every 5 seconds to avoid huge memory buffers
        recorder.start(5000);
        setIsRecording(true);
        console.log("[AudioRecorder] Started recording. MIME:", mimeType || "(default)");
      } catch (err) {
        console.error("[AudioRecorder] Failed to start:", err.message);
        setError(err.message);
      }
    },
    [isRecording, onComplete]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      console.warn("[AudioRecorder] stopRecording called but recorder not active.");
      return;
    }
    recorder.stop();
    console.log("[AudioRecorder] Stopped recording.");
  }, []);

  // Safety cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return { startRecording, stopRecording, isRecording, error };
};
