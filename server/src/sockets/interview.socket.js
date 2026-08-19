const roomService = require("../services/socket/room.service");
const interviewModel = require("../models/interview.model");

/**
 * Register all interview socket events on the io instance.
 * Follows Single Responsibility: ONLY handles socket event wiring.
 * All room state logic is delegated to roomService.
 */
const registerInterviewEvents = (io) => {
  io.on("connection", (socket) => {
    console.log(`🟢 Socket Connected: ${socket.id}`);

    // ─────────────────────────────────────────────
    // EVENT: join-room
    // ─────────────────────────────────────────────
    socket.on("join-room", async ({ interviewId, user } = {}) => {
      try {
        // 1. Validate payload
        if (!interviewId || !user || !user.id || !user.name || !user.role) {
          socket.emit("error", { message: "Invalid payload. interviewId and user (id, name, role) are required." });
          return;
        }

        if (!["interviewer", "candidate"].includes(user.role)) {
          socket.emit("error", { message: "Invalid role. Must be 'interviewer' or 'candidate'." });
          return;
        }

        // 2. Verify interview exists in DB
        const interview = await interviewModel.getInterviewById(interviewId);
        if (!interview) {
          socket.emit("error", { message: "Interview not found." });
          return;
        }

        // 3. Join the Socket.IO room using interviewId as room identifier
        socket.join(interviewId);

        // 4. Store context on the socket object for disconnect handling
        socket.interviewId = interviewId;
        socket.userInfo = user;

        // 5. Add participant to in-memory room state
        const { participant } = roomService.addParticipant(interviewId, socket.id, user);

        // 6. Emit room-joined ONLY to the joining socket
        socket.emit("room-joined", {
          message: "Successfully joined the interview room.",
          participant,
          roomState: roomService.getRoomState(interviewId),
        });

        // 7. Notify all OTHERS in the room about the new participant
        socket.to(interviewId).emit("user-joined", {
          participant,
          roomState: roomService.getRoomState(interviewId),
        });

        // 8. Broadcast updated room-state to ALL participants
        io.to(interviewId).emit("room-state", roomService.getRoomState(interviewId));

        console.log(`✅ ${user.role} "${user.name}" joined room [${interviewId}]`);
      } catch (err) {
        console.error("join-room error:", err.message);
        socket.emit("error", { message: "Failed to join room. Please try again." });
      }
    });

    // ─────────────────────────────────────────────
    // EVENT: leave-room
    // ─────────────────────────────────────────────
    socket.on("leave-room", () => {
      handleLeaveRoom(socket, io);
    });

    // ─────────────────────────────────────────────
    // EVENT: disconnect (browser closes / network loss)
    // ─────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`🔴 Socket Disconnected: ${socket.id}`);
      handleLeaveRoom(socket, io);
    });
  });
};

/**
 * Shared leave-room handler for both explicit leave and disconnect events.
 */
const handleLeaveRoom = (socket, io) => {
  const result = roomService.removeParticipant(socket.id);
  if (!result || !result.participant) return;

  const { interviewId, participant } = result;

  // Leave the Socket.IO channel
  socket.leave(interviewId);

  // Notify remaining participants
  io.to(interviewId).emit("user-left", {
    participant,
    roomState: roomService.getRoomState(interviewId),
  });

  // Broadcast updated room-state
  io.to(interviewId).emit("room-state", roomService.getRoomState(interviewId));

  console.log(`👋 ${participant.role} "${participant.name}" left room [${interviewId}]`);
};

module.exports = registerInterviewEvents;