import { useEffect, useRef, useState } from "react";
import { createInterviewSocket } from "../lib/socket";

/**
 * Connects to the interview room over Socket.IO and keeps room presence
 * state in sync. Transcript chunks and the end-of-interview signal are
 * delivered via callbacks (kept in refs, so passing inline functions
 * from the caller doesn't cause reconnects) rather than accumulated
 * arrays here — the page component already owns the transcript list
 * (seeded from a REST fetch on mount) and just appends to it.
 */
export const useInterviewSocket = (interviewId, session, { onTranscriptChunk, onInterviewEnded } = {}) => {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState({ participantCount: 0, participants: [] });
  const [interviewMeta, setInterviewMeta] = useState(null);
  const [socketError, setSocketError] = useState(null);

  const onTranscriptChunkRef = useRef(onTranscriptChunk);
  onTranscriptChunkRef.current = onTranscriptChunk;
  const onInterviewEndedRef = useRef(onInterviewEnded);
  onInterviewEndedRef.current = onInterviewEnded;

  useEffect(() => {
    if (!interviewId || !session) return undefined;

    const socket = createInterviewSocket(interviewId, session);

    socket.on("connect", () => {
      setConnected(true);
      setSocketError(null);
      socket.emit("join-room");
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("connect_error", (err) => {
      setSocketError(err?.message || "Couldn't connect to the interview room.");
    });

    socket.on("room-joined", (payload) => {
      setRoomState(payload.roomState);
      setInterviewMeta(payload.interview);
    });

    socket.on("room-state", (state) => setRoomState(state));
    socket.on("user-joined", (payload) => setRoomState(payload.roomState));
    socket.on("user-left", (payload) => setRoomState(payload.roomState));

    socket.on("transcript-chunk", (row) => onTranscriptChunkRef.current?.(row));
    socket.on("interview-ended", (payload) => onInterviewEndedRef.current?.(payload));

    socket.on("error", (payload) => {
      setSocketError(payload?.message || "Something went wrong in the interview room.");
    });

    socket.connect();

    return () => {
      if (socket.connected) socket.emit("leave-room");
      socket.disconnect();
      socket.removeAllListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, session?.token, session?.joinToken, session?.type]);

  return { connected, roomState, interviewMeta, socketError };
};
