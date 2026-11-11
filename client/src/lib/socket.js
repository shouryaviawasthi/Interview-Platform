import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

/**
 * Creates a (disconnected) Socket.IO client scoped to one interview.
 * Identity is proven via the handshake `auth` payload — the server
 * verifies `token` against either the interviewer's JWT or the
 * interview's join_token and derives role/name itself; nothing about
 * who's connecting is ever trusted from event payloads.
 *
 * session: { type: "interviewer", token } | { type: "candidate", joinToken }
 */
export const createInterviewSocket = (interviewId, session) => {
  const token = session?.type === "interviewer" ? session.token : session?.joinToken;

  return io(SOCKET_URL, {
    autoConnect: false,
    auth: { interviewId, token },
    transports: ["websocket", "polling"],
  });
};
