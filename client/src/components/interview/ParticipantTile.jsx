import { useRef, useEffect } from "react";
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

  useEffect(() => {
    if (!isSelf && remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [isSelf, remoteStream]);

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
      ) : !isSelf && remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
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
