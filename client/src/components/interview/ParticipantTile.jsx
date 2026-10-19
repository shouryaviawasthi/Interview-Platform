import { useRef, useEffect, useState } from "react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from "react-icons/fi";

const ParticipantTile = ({
  name,
  role,
  isSelf = false,
  videoRef,
  remoteStream,
  camOn = true,
  micOn = true,
  mediaStatus = "ready",
}) => {
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const hasRemoteVideo = remoteStream?.getVideoTracks().some((track) => track.readyState === "live");
  const hasRemoteAudio = remoteStream?.getAudioTracks().some((track) => track.readyState === "live");

  useEffect(() => {
    if (isSelf || !remoteStream) return;
    const mediaElement = hasRemoteVideo ? remoteVideoRef.current : remoteAudioRef.current;
    if (!mediaElement) return;

    mediaElement.srcObject = remoteStream;
    mediaElement.play()
      .then(() => setPlaybackBlocked(false))
      .catch(() => setPlaybackBlocked(true));
  }, [hasRemoteVideo, hasRemoteAudio, isSelf, remoteStream]);

  const enablePlayback = async () => {
    const mediaElement = hasRemoteVideo ? remoteVideoRef.current : remoteAudioRef.current;
    if (!mediaElement) return;
    try {
      await mediaElement.play();
      setPlaybackBlocked(false);
    } catch {
      setPlaybackBlocked(true);
    }
  };

  return (
    <div className="group relative aspect-video overflow-hidden rounded-2xl bg-ink-900 shadow-[var(--shadow-soft)]">
      {isSelf && camOn && mediaStatus === "ready" ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full scale-x-[-1] object-cover"
        />
      ) : !isSelf && remoteStream && hasRemoteVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
      ) : !isSelf && remoteStream && hasRemoteAudio ? (
        <>
          <audio ref={remoteAudioRef} autoPlay playsInline />
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink-800 to-ink-900">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lav-500/25 font-display text-lg font-semibold text-lav-100 ring-2 ring-lav-400/40">
              {name?.[0]?.toUpperCase() || "?"}
            </span>
            <span className="text-xs font-medium text-lav-100/60">Audio connected · camera unavailable</span>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink-800 to-ink-900">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lav-500/25 font-display text-lg font-semibold text-lav-100 ring-2 ring-lav-400/40">
            {name?.[0]?.toUpperCase() || "?"}
          </span>
          {!isSelf && (
            <span className="text-xs font-medium text-lav-100/60">Camera off &middot; UI preview</span>
          )}
        </div>
      )}

      {!isSelf && playbackBlocked && (
        <button
          type="button"
          onClick={enablePlayback}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/75 px-4 py-2 text-sm font-semibold text-white"
        >
          Tap to enable remote audio/video
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 py-2.5">
        <span className="flex items-center gap-1.5 truncate text-xs font-medium text-white">
          <span className="relative flex h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-status-live)]">
            <span className="absolute inset-0 rounded-full bg-[color:var(--color-status-live)] animate-pulse-ring" />
          </span>
          {name} {isSelf && "(You)"}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-1.5 py-1 capitalize text-[10px] font-semibold text-lav-100">
          {role}
        </span>
      </div>

      {isSelf && (
        <div className="absolute right-2.5 top-2.5 flex gap-1.5">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${micOn ? "bg-white/15" : "bg-[#D14D5B]"}`}>
            {micOn ? <FiMic className="h-3 w-3 text-white" /> : <FiMicOff className="h-3 w-3 text-white" />}
          </span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${camOn ? "bg-white/15" : "bg-[#D14D5B]"}`}>
            {camOn ? <FiVideo className="h-3 w-3 text-white" /> : <FiVideoOff className="h-3 w-3 text-white" />}
          </span>
        </div>
      )}
    </div>
  );
};

export default ParticipantTile;
