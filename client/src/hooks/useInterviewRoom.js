import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../socket/socket";

/**
 * Manages the Socket.IO lifecycle for an interview room.
 * Mirrors the server's join-room / leave-room / room-state contract.
 */
export const useInterviewRoom = ({ interviewId, user, enabled }) => {
  const socketRef = useRef(null);
  const [connectionState, setConnectionState] = useState("idle"); // idle | connecting | joined | error
  const [roomState, setRoomState] = useState({ participantCount: 0, participants: [] });
  const [errorMessage, setErrorMessage] = useState(null);
  const [events, setEvents] = useState([]); // lightweight activity feed

  const pushEvent = useCallback((message) => {
    setEvents((prev) => [
      { id: `${Date.now()}-${Math.random()}`, message, at: new Date().toISOString() },
      ...prev,
    ].slice(0, 20));
  }, []);

  useEffect(() => {
    if (!enabled || !interviewId || !user?.id || !user?.name || !user?.role) return;

    const socket = getSocket();
    socketRef.current = socket;
    setConnectionState("connecting");
    setErrorMessage(null);

    if (!socket.connected) socket.connect();

    const handleConnect = () => {
      socket.emit("join-room", { interviewId, user });
    };

    const handleRoomJoined = ({ roomState: rs }) => {
      setConnectionState("joined");
      setRoomState(rs);
      pushEvent("You joined the room");
    };

    const handleUserJoined = ({ participant, roomState: rs }) => {
      setRoomState(rs);
      pushEvent(`${participant.name} joined (${participant.role})`);
    };

    const handleUserLeft = ({ participant, roomState: rs }) => {
      setRoomState(rs);
      pushEvent(`${participant.name} left`);
    };

    const handleRoomState = (rs) => setRoomState(rs);

    const handleError = ({ message }) => {
      setConnectionState("error");
      setErrorMessage(message);
    };

    const handleDisconnect = () => {
      setConnectionState((prev) => (prev === "error" ? prev : "idle"));
    };

    socket.on("connect", handleConnect);
    socket.on("room-joined", handleRoomJoined);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("room-state", handleRoomState);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) handleConnect();

    return () => {
      socket.emit("leave-room");
      socket.off("connect", handleConnect);
      socket.off("room-joined", handleRoomJoined);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("room-state", handleRoomState);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interviewId, user?.id, user?.name, user?.role]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("leave-room");
    socketRef.current?.disconnect();
    setConnectionState("idle");
  }, []);

  return { connectionState, roomState, errorMessage, events, leaveRoom };
};
