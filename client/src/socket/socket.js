import { io } from "socket.io-client";
import { SERVER_URL } from "../lib/axios";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};
