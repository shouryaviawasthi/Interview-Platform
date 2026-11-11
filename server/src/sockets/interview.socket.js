const roomService = require("../services/socket/room.service");
const interviewModel = require("../models/interview.model");
const liveTranscript = require("../services/transcription/liveTranscription.service");

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
    // WebRTC Signaling Events
    // ─────────────────────────────────────────────
    socket.on("webrtc-offer", ({ interviewId, offer }) => {
      if (interviewId && offer) {
        socket.to(interviewId).emit("webrtc-offer", { offer });
      }
    });

    socket.on("webrtc-answer", ({ interviewId, answer }) => {
      if (interviewId && answer) {
        socket.to(interviewId).emit("webrtc-answer", { answer });
      }
    });

    socket.on("webrtc-ice-candidate", ({ interviewId, candidate }) => {
      if (interviewId && candidate) {
        socket.to(interviewId).emit("webrtc-ice-candidate", { candidate });
      }
    });

    // ─────────────────────────────────────────────
    // Live Transcription Events (Phase 6)
    // ─────────────────────────────────────────────

    /**
     * EVENT: start-live-transcript
     * Payload: { interviewId }
     * Each joined participant opens a separate stream when the interview goes live.
     */
    socket.on("start-live-transcript", async ({ interviewId, sampleRate } = {}, acknowledge) => {
      if (!interviewId) {
        acknowledge?.({ success: false, message: "Interview ID is required." });
        return;
      }
      if (socket.interviewId !== interviewId || !socket.userInfo) {
        const message = "Join the interview room before starting transcription.";
        acknowledge?.({ success: false, message });
        socket.emit("live-transcript-error", { message });
        return;
      }
      try {
        await liveTranscript.startSession(interviewId, io, socket.userInfo.role, sampleRate);
        acknowledge?.({ success: true });
        socket.emit("live-transcript-started", { interviewId });
        console.log(`[Socket] Live transcript started for ${interviewId}`);
      } catch (err) {
        console.error(`[Socket] Failed to start live transcript for ${interviewId}:`, err.message);
        const message = "Could not start live transcription: " + err.message;
        acknowledge?.({ success: false, message });
        socket.emit("live-transcript-error", { message });
      }
    });

    /**
     * EVENT: audio-chunk
     * Payload: { interviewId, chunk: ArrayBuffer | Buffer }
     * The server routes each chunk using the participant role from join-room.
     */
    socket.on("audio-chunk", ({ interviewId, chunk } = {}, acknowledge) => {
      if (!interviewId || !chunk || socket.interviewId !== interviewId || !socket.userInfo) {
        acknowledge?.({ success: false, message: "Audio chunk is missing or the participant is not in this interview." });
        return;
      }
      try {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const sent = liveTranscript.sendAudioChunk(interviewId, socket.userInfo.role, buffer);
        acknowledge?.(sent
          ? { success: true }
          : { success: false, message: "The transcription stream is not ready to receive audio." });
      } catch (err) {
        console.error(`[Socket] Failed to forward audio chunk for ${interviewId}:`, err.message);
        acknowledge?.({ success: false, message: "Could not forward audio to transcription." });
      }
    });

    /**
     * EVENT: stop-live-transcript
     * Payload: { interviewId }
     * Called when the interview ends. Closes Deepgram connection.
     */
    socket.on("stop-live-transcript", async ({ interviewId } = {}, acknowledge) => {
      if (!interviewId || socket.interviewId !== interviewId || !socket.userInfo) {
        acknowledge?.({ success: false, message: "Participant is not in this interview." });
        return;
      }
      try {
        const finalSegments = await liveTranscript.stopSession(interviewId, socket.userInfo.role);
        const result = { interviewId, segmentCount: finalSegments.length };
        acknowledge?.({ success: true });
        socket.emit("live-transcript-stopped", result);
        console.log(`[Socket] Live transcript stopped for ${interviewId}, ${finalSegments.length} final segments`);
      } catch (err) {
        console.error(`[Socket] Failed to stop live transcript for ${interviewId}:`, err.message);
        acknowledge?.({ success: false, message: "Could not finalize the transcript." });
      }
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