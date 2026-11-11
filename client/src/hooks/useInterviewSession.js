import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/socket";
import {
  startInterview as apiStart,
  endInterview as apiEnd,
  getSession as apiGetSession,
} from "../services/interview.service";

/**
 * useInterviewSession
 *
 * Manages the interview lifecycle for the InterviewRoom:
 *  - Fetches current session state from the REST API on mount/reconnect
 *    so that a page refresh during a LIVE interview correctly restores state.
 *  - Listens for `interview-started` and `interview-ended` Socket.IO events
 *    so both participants update simultaneously.
 *  - Provides startSession() and endSession() for the interviewer to call.
 *  - Exposes derived presence flags (interviewerConnected, candidateConnected,
 *    bothReady) computed from the existing roomState.participants list.
 *
 * Architecture:
 *   REST API  → authoritative persistent state (status, started_at, ended_at)
 *   Socket.IO → real-time broadcast of state transitions to all participants
 */
export const useInterviewSession = ({
  interviewId,
  user,
  roomState,
  connectionState,
  isAuthenticated,
}) => {
  // ─── Core session state ───────────────────────────────────────────────
  const [sessionStatus, setSessionStatus] = useState(null); // null | scheduled | live | completed | cancelled
  const [startedAt, setStartedAt] = useState(null);
  const [endedAt, setEndedAt] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(null);

  // ─── Action loading state ─────────────────────────────────────────────
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // ─── End confirmation modal ───────────────────────────────────────────
  const [showEndModal, setShowEndModal] = useState(false);

  // ─── Flags ────────────────────────────────────────────────────────────
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endPayload, setEndPayload] = useState(null); // { durationSeconds, endedAt }

  const hasFetchedSession = useRef(false);

  // ─── 1. Fetch session state on room join (handles page refresh) ───────
  // Only the interviewer calls this endpoint. The candidate sees state
  // updates purely via Socket.IO events.
  useEffect(() => {
    if (!interviewId || !isAuthenticated || connectionState !== "joined") return;
    if (hasFetchedSession.current) return;

    const fetchSession = async () => {
      try {
        const session = await apiGetSession(interviewId);
        setSessionStatus(session.status);
        if (session.startedAt) setStartedAt(new Date(session.startedAt));
        if (session.endedAt) setEndedAt(new Date(session.endedAt));
        if (session.durationSeconds != null) setDurationSeconds(session.durationSeconds);
        if (session.status === "completed") {
          setSessionEnded(true);
        }
        hasFetchedSession.current = true;
      } catch (err) {
        console.error("[Session] Failed to fetch session:", err.message);
      }
    };

    fetchSession();
  }, [interviewId, isAuthenticated, connectionState]);

  // ─── 2. Socket.IO event listeners ────────────────────────────────────
  // Both interviewer and candidate receive these broadcasts.
  useEffect(() => {
    if (!interviewId || connectionState !== "joined") return;

    const socket = getSocket();

    const handleInterviewStarted = ({ startedAt: sa }) => {
      setSessionStatus("live");
      setStartedAt(new Date(sa));
    };

    const handleInterviewEnded = ({ endedAt: ea, startedAt: sa, durationSeconds: dur }) => {
      setSessionStatus("completed");
      setEndedAt(new Date(ea));
      if (sa) setStartedAt(new Date(sa));
      setDurationSeconds(dur);
      setEndPayload({ durationSeconds: dur, endedAt: new Date(ea) });
      setSessionEnded(true);
    };

    socket.on("interview-started", handleInterviewStarted);
    socket.on("interview-ended", handleInterviewEnded);

    return () => {
      socket.off("interview-started", handleInterviewStarted);
      socket.off("interview-ended", handleInterviewEnded);
    };
  }, [interviewId, connectionState]);

  // ─── 3. Derived presence flags from roomState ─────────────────────────
  // These are computed from the existing Socket.IO roomState so we don't
  // duplicate participant tracking.
  const participants = roomState?.participants ?? [];
  const interviewerConnected = participants.some((p) => p.role === "interviewer");
  const candidateConnected = participants.some((p) => p.role === "candidate");
  const bothReady = interviewerConnected && candidateConnected;

  // ─── 4. Start interview ───────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!interviewId || isStarting) return;
    setIsStarting(true);
    try {
      await apiStart(interviewId);
      // State is set via the `interview-started` socket event broadcast,
      // which the server emits immediately after the DB update.
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to start interview. Please try again.";
      throw new Error(msg);
    } finally {
      setIsStarting(false);
    }
  }, [interviewId, isStarting]);

  // ─── 5. End interview ─────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    if (!interviewId || isEnding) return;
    setIsEnding(true);
    setShowEndModal(false);
    try {
      await apiEnd(interviewId);
      // State is set via the `interview-ended` socket event.
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to end interview. Please try again.";
      throw new Error(msg);
    } finally {
      setIsEnding(false);
    }
  }, [interviewId, isEnding]);

  return {
    // State
    sessionStatus,
    startedAt,
    endedAt,
    durationSeconds,
    // Presence
    interviewerConnected,
    candidateConnected,
    bothReady,
    // Actions
    startSession,
    endSession,
    isStarting,
    isEnding,
    // End modal
    showEndModal,
    setShowEndModal,
    // Session ended signal (used to clean up WebRTC + show completed UI)
    sessionEnded,
    endPayload,
  };
};
