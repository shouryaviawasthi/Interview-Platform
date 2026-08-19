import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiPhoneOff,
  FiUsers,
  FiAlertTriangle,
  FiArrowLeft,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useInterviewRoom } from "../hooks/useInterviewRoom";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { joinInterviewByToken } from "../services/interview.service";
import ParticipantTile from "../components/interview/ParticipantTile";
import Loader from "../components/ui/Loader";
import Button from "../components/ui/Button";
import { ROUTES } from "../constants/routes";

const getOrCreateCandidateId = (token) => {
  const key = `aip_candidate_id_${token}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
};

const InterviewRoom = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [interviewMeta, setInterviewMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await joinInterviewByToken(token);
        setInterviewMeta(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoadingMeta(false);
      }
    };
    load();
  }, [token]);

  const roomUser = useMemo(() => {
    if (!interviewMeta) return null;
    if (isAuthenticated && user) {
      return { id: user.id, name: user.name, role: "interviewer" };
    }
    const storedName = sessionStorage.getItem(`aip_candidate_name_${token}`);
    if (!storedName) return null;
    return { id: getOrCreateCandidateId(token), name: storedName, role: "candidate" };
  }, [interviewMeta, isAuthenticated, user, token]);

  const enabled = !!interviewMeta?.id && !!roomUser && !hasLeft;

  const { connectionState, roomState, errorMessage, events, leaveRoom } = useInterviewRoom({
    interviewId: interviewMeta?.id,
    user: roomUser,
    enabled,
  });

  const { videoRef, camOn, micOn, status: mediaStatus, toggleCam, toggleMic } = useLocalMedia({
    enabled,
  });

  useEffect(() => {
    if (interviewMeta && !roomUser && !isAuthenticated) {
      navigate(ROUTES.join(token), { replace: true });
    }
  }, [interviewMeta, roomUser, isAuthenticated, navigate, token]);

  const handleLeave = () => {
    leaveRoom();
    setHasLeft(true);
    toast.success("You left the room");
    if (isAuthenticated) {
      navigate(interviewMeta?.id ? ROUTES.interviewDetail(interviewMeta.id) : ROUTES.INTERVIEWS);
    }
  };

  if (loadingMeta) return <Loader label="Preparing your room" />;

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-6 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D14D5B]/15 text-[#F4A0A9]">
          <FiAlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="font-display text-xl font-semibold text-white">Room not found</h1>
        <p className="mt-1.5 max-w-sm text-sm text-white/50">
          This interview link is invalid or has expired.
        </p>
        <Link to={ROUTES.HOME} className="mt-6">
          <Button variant="secondary">Go to homepage</Button>
        </Link>
      </div>
    );
  }

  if (hasLeft) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-6 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lav-500/20 text-lav-200">
          <FiPhoneOff className="h-6 w-6" />
        </span>
        <h1 className="font-display text-xl font-semibold text-white">You've left the room</h1>
        <p className="mt-1.5 max-w-sm text-sm text-white/50">
          Thanks for joining. You can close this tab now.
        </p>
        <Link to={ROUTES.HOME} className="mt-6">
          <Button variant="secondary">Go to homepage</Button>
        </Link>
      </div>
    );
  }

  const others = roomState.participants.filter((p) => p.userId !== roomUser?.id);

  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <button
              onClick={() =>
                navigate(interviewMeta?.id ? ROUTES.interviewDetail(interviewMeta.id) : ROUTES.INTERVIEWS)
              }
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <FiArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <p className="font-display text-sm font-semibold text-white sm:text-base">
              {interviewMeta?.job_description || "Interview room"}
            </p>
            <p className="text-xs text-white/40">
              {connectionState === "joined"
                ? `Connected \u2022 ${roomState.participantCount} in room`
                : connectionState === "connecting"
                ? "Connecting\u2026"
                : connectionState === "error"
                ? "Connection error"
                : "Idle"}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70">
          <FiUsers className="h-3.5 w-3.5" />
          {roomState.participantCount}
        </span>
      </header>

      {connectionState === "error" && (
        <div className="flex items-center gap-2 bg-[#D14D5B]/15 px-4 py-2.5 text-sm text-[#F4A0A9] sm:px-6">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage || "Something went wrong connecting to the room."}
        </div>
      )}

      {mediaStatus === "denied" && (
        <div className="flex items-center gap-2 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200 sm:px-6">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          Camera &amp; microphone access was denied. You can still see who's in the room.
        </div>
      )}

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
          {roomUser && (
            <ParticipantTile
              name={roomUser.name}
              role={roomUser.role}
              isSelf
              videoRef={videoRef}
              camOn={camOn}
              micOn={micOn}
              mediaStatus={mediaStatus}
            />
          )}
          {others.map((p) => (
            <ParticipantTile key={p.socketId} name={p.name} role={p.role} />
          ))}
          {others.length === 0 && connectionState === "joined" && (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-center">
              <FiUsers className="h-6 w-6 text-white/30" />
              <p className="text-sm font-medium text-white/50">Waiting for others to join&hellip;</p>
            </div>
          )}
        </div>

        {/* Activity feed */}
        {events.length > 0 && (
          <div className="mx-auto mt-6 max-w-5xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/30">
              Room activity
            </p>
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {events.slice(0, 5).map((ev) => (
                <p key={ev.id} className="text-xs text-white/50">
                  <span className="text-white/30">
                    {new Date(ev.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>{" "}
                  &middot; {ev.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4 sm:py-5">
        <button
          onClick={toggleMic}
          disabled={mediaStatus !== "ready"}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
            micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#D14D5B] text-white"
          }`}
          aria-label="Toggle microphone"
        >
          {micOn ? <FiMic className="h-4.5 w-4.5" /> : <FiMicOff className="h-4.5 w-4.5" />}
        </button>
        <button
          onClick={toggleCam}
          disabled={mediaStatus !== "ready"}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
            camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#D14D5B] text-white"
          }`}
          aria-label="Toggle camera"
        >
          {camOn ? <FiVideo className="h-4.5 w-4.5" /> : <FiVideoOff className="h-4.5 w-4.5" />}
        </button>
        <button
          onClick={handleLeave}
          className="flex h-11 items-center gap-2 rounded-full bg-[#D14D5B] px-5 text-sm font-semibold text-white hover:bg-[#B93E4B] transition-colors"
        >
          <FiPhoneOff className="h-4 w-4" />
          Leave
        </button>
      </div>
    </div>
  );
};

export default InterviewRoom;
