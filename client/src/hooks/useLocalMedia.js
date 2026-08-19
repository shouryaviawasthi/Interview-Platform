import { useEffect, useRef, useState, useCallback } from "react";

export const useLocalMedia = ({ enabled }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | requesting | ready | denied

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const start = async () => {
      setStatus("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled]);

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

  return { videoRef, camOn, micOn, status, toggleCam, toggleMic };
};
