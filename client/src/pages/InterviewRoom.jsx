import { useEffect, useMemo, useRef, useState } from "react";
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
  FiPlay,
  FiSquare,
  FiClock,
  FiFileText,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useInterviewRoom } from "../hooks/useInterviewRoom";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { useWebRTC } from "../hooks/useWebRTC";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import useLiveTranscript from "../hooks/useLiveTranscript";
import { joinInterviewByToken, uploadAudio } from "../services/interview.service";
import ParticipantTile from "../components/interview/ParticipantTile";
import LiveTimer from "../components/interview/LiveTimer";
import Modal from "../components/ui/Modal";
import Loader from "../components/ui/Loader";
import Button from "../components/ui/Button";
import CandidateEndScreen from "../components/interview/CandidateEndScreen";
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

const formatDuration = (seconds) => {
  if (!seconds) return "0 seconds";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} hour${h !== 1 ? "s" : ""}`);
  if (m > 0) parts.push(`${m} minute${m !== 1 ? "s" : ""}`);
  if (s > 0 || parts.length === 0) parts.push(`${s} second${s !== 1 ? "s" : ""}`);
  return parts.join(" ");
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

  // ── Resolve who the current user is ───────────────────────────────────
  // Check candidate sessionStorage FIRST (per-tab) before auth,
  // so both tabs in the same browser get distinct roles.
  const roomUser = useMemo(() => {
    if (!interviewMeta) return null;
    const storedName = sessionStorage.getItem(`aip_candidate_name_${token}`);
    if (storedName) {
      return { id: getOrCreateCandidateId(token), name: storedName, role: "candidate" };
    }
    if (isAuthenticated && user) {
      return { id: user.id, name: user.name, role: "interviewer" };
    }
    return null;
  }, [interviewMeta, isAuthenticated, user, token]);

  const enabled = !!interviewMeta?.id && !!roomUser && !hasLeft;
  const isInterviewer = roomUser?.role === "interviewer";

  // ── Hooks ──────────────────────────────────────────────────────────────
  const { connectionState, roomState, errorMessage, events, leaveRoom } = useInterviewRoom({
    interviewId: interviewMeta?.id,
    user: roomUser,
    enabled,
  });

  const { videoRef, localStream, camOn, micOn, status: mediaStatus, toggleCam, toggleMic } = useLocalMedia({
    enabled,
  });

  const {
    remoteStream,
    webrtcStatus,
  } = useWebRTC({
    interviewId: interviewMeta?.id,
    user: roomUser,
    localStream,
    connectionState,
    roomState,
  });

  const {
    sessionStatus,
    startedAt,
    durationSeconds,
    interviewerConnected,
    candidateConnected,
    bothReady,
    startSession,
    endSession,
    isStarting,
    isEnding,
    showEndModal,
    setShowEndModal,
    sessionEnded,
    endPayload,
  } = useInterviewSession({
    interviewId: interviewMeta?.id,
    user: roomUser,
    roomState,
    connectionState,
    isAuthenticated,
  });

  // ─── Audio recording (Phase 3) ────────────────────────────────────────
  // Only the interviewer records. Candidate-side tab has no auth to upload.
  const isLive = sessionStatus === "live";
  const prevIsLiveRef = useRef(false);
  const prevSessionEndedRef = useRef(false);

  const { startRecording, stopRecording, isRecording } = useAudioRecorder({
    onComplete: async (blob, mimeType) => {
      if (!isAuthenticated || !interviewMeta?.id) return;
      try {
        await uploadAudio(interviewMeta.id, blob, mimeType);
        console.log("[InterviewRoom] Audio uploaded successfully.");
        toast.success("Interview audio uploaded. Transcription starting…");
      } catch (err) {
        console.error("[InterviewRoom] Audio upload failed:", err.message);
        toast.error("Audio upload failed. You can retry from the interview details page.");
      }
    },
  });

  // ─── Live Transcript (Phase 6 — Deepgram) ────────────────────────────────
  const [showTranscript, setShowTranscript] = useState(true);
  const { chunks: liveChunks, finalChunks, isActive: transcriptActive } = useLiveTranscript({
    interviewId: interviewMeta?.id,
    speakerRole: roomUser?.role || "candidate",
    enabled: isLive && !!localStream,
    stream: localStream,
  });
  const transcriptEndRef = useRef(null);
  useEffect(() => {
    if (showTranscript) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveChunks, showTranscript]);

  // Start recording when interview goes live
  useEffect(() => {
    if (!isInterviewer) return;
    if (isLive && !prevIsLiveRef.current && localStream) {
      startRecording(localStream, remoteStream);
    }
    prevIsLiveRef.current = isLive;
  }, [isLive, localStream, remoteStream, isInterviewer, startRecording]);

  // Stop recording when interview ends
  useEffect(() => {
    if (!isInterviewer) return;
    if (sessionEnded && !prevSessionEndedRef.current && isRecording) {
      stopRecording();
    }
    prevSessionEndedRef.current = sessionEnded;
  }, [sessionEnded, isRecording, isInterviewer, stopRecording]);

  // ── Redirect unauthenticated candidate to join page ───────────────────
  useEffect(() => {
    if (interviewMeta && !roomUser && !isAuthenticated) {
      navigate(ROUTES.join(token), { replace: true });
    }
  }, [interviewMeta, roomUser, isAuthenticated, navigate, token]);

  // ── Handle explicit leave ──────────────────────────────────────────────
  const handleLeave = () => {
    leaveRoom();
    setHasLeft(true);
    toast.success("You left the room");
    if (isAuthenticated) {
      navigate(interviewMeta?.id ? ROUTES.interviewDetail(interviewMeta.id) : ROUTES.INTERVIEWS);
    }
  };

  // ── Handle start interview ─────────────────────────────────────────────
  const handleStart = async () => {
    try {
      await startSession();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Handle end interview ───────────────────────────────────────────────
  const handleEndConfirm = async () => {
    try {
      await endSession();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── When session ends: clean up and redirect interviewer ──────────────
  useEffect(() => {
    if (!sessionEnded) return;
    // Interviewer gets redirected to the end dashboard after a brief delay
    if (isAuthenticated && interviewMeta?.id) {
      const t = setTimeout(() => {
        leaveRoom();
        navigate(ROUTES.interviewEndDashboard(interviewMeta.id));
      }, 2500);
      return () => clearTimeout(t);
    }
    // Candidate stays on same page — CandidateEndScreen is shown in-place
  }, [sessionEnded, isAuthenticated, interviewMeta?.id, leaveRoom, navigate]);

  // ─────────────────────────────────────────────────────────────────────
  // Loading / error states
  // ─────────────────────────────────────────────────────────────────────

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

  // ── Interview completed screen ────────────────────────────────────────
  if (sessionEnded) {
    // Candidate gets their own dedicated end-of-interview dashboard
    if (!isAuthenticated && token) {
      return (
        <CandidateEndScreen
          token={token}
          candidateName={interviewMeta?.candidate_name || "Candidate"}
          durationSeconds={endPayload?.durationSeconds}
        />
      );
    }
    // Interviewer sees a brief "redirecting" splash then navigates
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-6 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lav-500/20 text-lav-200">
          <FiSquare className="h-6 w-6" />
        </span>
        <h1 className="font-display text-xl font-semibold text-white">Interview Completed</h1>
        {endPayload?.durationSeconds != null && (
          <p className="mt-2 text-sm text-white/50">
            Duration: {formatDuration(endPayload.durationSeconds)}
          </p>
        )}
        <p className="mt-1.5 max-w-sm text-sm text-white/40">
          Generating your dashboard…
        </p>
      </div>
    );
  }

  const others = roomState.participants.filter((p) => p.userId !== roomUser?.id);

  return (
    <div className="flex min-h-screen flex-col bg-ink-900">

      {/* ── Header ─────────────────────────────────────────────────────── */}
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
                ? `${roomState.participantCount} in room`
                : connectionState === "connecting"
                ? "Connecting…"
                : connectionState === "error"
                ? "Connection error"
                : "Idle"}
            </p>
          </div>
        </div>

        {/* Status badge + live timer */}
        <div className="flex items-center gap-3">
          {isLive && startedAt && (
            <div className="flex items-center gap-1.5 rounded-full bg-[#D14D5B]/20 px-3 py-1.5 text-xs font-medium text-[#F4A0A9]">
              <span className="relative flex h-1.5 w-1.5 rounded-full bg-[#D14D5B]">
                <span className="absolute inset-0 rounded-full bg-[#D14D5B] animate-ping opacity-75" />
              </span>
              LIVE &bull; <LiveTimer startedAt={startedAt} />
            </div>
          )}
          {isInterviewer && isRecording && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold tracking-wider text-red-400 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              REC
            </span>
          )}
          {!isLive && sessionStatus && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium capitalize text-white/60">
              {sessionStatus}
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70">
            <FiUsers className="h-3.5 w-3.5" />
            {roomState.participantCount}
          </span>
        </div>
      </header>

      {/* ── Banners ─────────────────────────────────────────────────────── */}
      {connectionState === "error" && (
        <div className="flex items-center gap-2 bg-[#D14D5B]/15 px-4 py-2.5 text-sm text-[#F4A0A9] sm:px-6">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage || "Something went wrong connecting to the room."}
        </div>
      )}

      {mediaStatus === "denied" && (
        <div className="flex items-center gap-2 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200 sm:px-6">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          Camera &amp; microphone access was denied. You can still see who&#39;s in the room.
        </div>
      )}

      {/* ── Ready panel (both participants present, not yet live) ─────── */}
      {connectionState === "joined" && !isLive && sessionStatus === "scheduled" && isInterviewer && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/30">
              Participant status
            </p>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    interviewerConnected ? "bg-green-400" : "bg-white/20"
                  }`}
                />
                <span className="text-white/70">
                  Interviewer:{" "}
                  <span className={interviewerConnected ? "text-green-400" : "text-white/40"}>
                    {interviewerConnected ? "Connected" : "Waiting…"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    candidateConnected ? "bg-green-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-white/70">
                  Candidate:{" "}
                  <span className={candidateConnected ? "text-green-400" : "text-amber-300"}>
                    {candidateConnected ? "Connected" : "Waiting for candidate…"}
                  </span>
                </span>
              </div>
            </div>
            <Button
              icon={FiPlay}
              disabled={!bothReady || isStarting}
              isLoading={isStarting}
              onClick={handleStart}
              className="w-full sm:w-auto"
            >
              {bothReady ? "Start Interview" : "Waiting for candidate to join…"}
            </Button>
          </div>
        </div>
      )}

      {/* Ready panel for candidate (read-only) */}
      {connectionState === "joined" && !isLive && sessionStatus === "scheduled" && !isInterviewer && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <FiClock className="h-4 w-4 text-amber-400" />
              Waiting for the interviewer to start the session…
            </div>
          </div>
        </div>
      )}

      {/* ── Video grid ─────────────────────────────────────────────────── */}
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
            <ParticipantTile key={p.socketId} name={p.name} role={p.role} remoteStream={remoteStream} />
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
                    {new Date(ev.at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>{" "}
                  &middot; {ev.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Live Transcript Panel ───────────────────────────────────── */}
        {isLive && (
          <div className="mx-auto mt-6 w-full max-w-5xl">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                <FiFileText className="h-3.5 w-3.5" />
                Live Transcript
                {transcriptActive && (
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/40">
                  {finalChunks.length} segments
                </span>
              </span>
              {showTranscript ? (
                <FiChevronUp className="h-3.5 w-3.5 text-white/40" />
              ) : (
                <FiChevronDown className="h-3.5 w-3.5 text-white/40" />
              )}
            </button>

            {showTranscript && (
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2 scrollbar-thin">
                {liveChunks.length === 0 ? (
                  <p className="text-center text-xs text-white/30 py-6">
                    {transcriptActive
                      ? "Listening… speak to see live transcript"
                      : "Waiting for interview to start…"}
                  </p>
                ) : (
                  liveChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className={`flex gap-2.5 ${
                        chunk.isFinal ? "opacity-100" : "opacity-60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                          chunk.speaker === "interviewer"
                            ? "bg-lav-500/20 text-lav-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {chunk.speaker === "interviewer" ? "I" : "C"}
                      </span>
                      <p className={`text-sm leading-relaxed ${
                        chunk.isFinal ? "text-white/85" : "text-white/50 italic"
                      }`}>
                        {chunk.text}
                        {!chunk.isFinal && (
                          <span className="ml-1 inline-block h-3 w-0.5 bg-white/40 animate-pulse" />
                        )}
                      </p>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4 sm:py-5">
        {/* Mic toggle */}
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

        {/* Camera toggle */}
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

        {/* End Interview — interviewer + live only */}
        {isInterviewer && isLive && (
          <button
            onClick={() => setShowEndModal(true)}
            disabled={isEnding}
            className="flex h-11 items-center gap-2 rounded-full bg-[#D14D5B] px-5 text-sm font-semibold text-white hover:bg-[#B93E4B] transition-colors disabled:opacity-50"
          >
            <FiSquare className="h-4 w-4" />
            End Interview
          </button>
        )}

        {/* Leave — always available */}
        <button
          onClick={handleLeave}
          className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
        >
          <FiPhoneOff className="h-4 w-4" />
          Leave
        </button>
      </div>

      {/* ── End Interview confirmation modal ─────────────────────────── */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Interview?"
        maxWidth="max-w-sm"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setShowEndModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={isEnding} onClick={handleEndConfirm}>
              End Interview
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          Are you sure you want to end this interview? Both participants will be notified and the
          session will be marked as completed.
        </p>
      </Modal>
    </div>
  );
};

export default InterviewRoom;
