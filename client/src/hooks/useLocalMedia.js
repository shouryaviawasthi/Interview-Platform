import { useEffect, useRef, useState, useCallback } from "react";
import { acquireLocalMedia, takePreparedMedia } from "../lib/localMedia";

export const useLocalMedia = ({ enabled, streamKey }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | requesting | ready | denied
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setError(null);
      return undefined;
    }

    let cancelled = false;

    const useStream = (mediaStream, message = null) => {
      if (cancelled) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCamOn(mediaStream.getVideoTracks().some((track) => track.enabled));
      setMicOn(mediaStream.getAudioTracks().some((track) => track.enabled));
      setError(message);
      setStatus("ready");
    };

    const start = async () => {
      setStatus("requesting");
      setError(null);

      try {
        const preparedStream = streamKey ? takePreparedMedia(streamKey) : null;
        if (preparedStream) {
          useStream(preparedStream.stream, preparedStream.warning);
          return;
        }
        const { stream: mediaStream, warning } = await acquireLocalMedia();
        useStream(mediaStream, warning);
      } catch (mediaError) {
        if (cancelled) return;
        setStatus("denied");
        setError(mediaError.message || "Couldn't access the camera or microphone.");
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    };
  }, [enabled, streamKey, attempt]);

  // The <video> element is conditionally rendered only when status === "ready".
  // srcObject must be set AFTER that re-render mounts the element.
  useEffect(() => {
    if (status === "ready" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  const toggleCam = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  const toggleMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()?.[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  return { videoRef, localStream: stream, camOn, micOn, status, error, toggleCam, toggleMic, retry };
};
