/**
 * Room Management Service
 * 
 * In-memory state store for active interview room participants.
 * Keeps track of connected users in each interview room (identified by interviewId).
 */

// Structure: Map<interviewId, Map<socketId, { socketId, userId, name, role, joinedAt }>>
const rooms = new Map();

// Structure: Map<socketId, interviewId> for quick lookup on disconnect
const socketToRoomMap = new Map();

/**
 * Add a participant to an interview room
 */
const addParticipant = (interviewId, socketId, user) => {
  if (!interviewId || !socketId || !user) {
    throw new Error("Missing required parameters for adding participant.");
  }

  if (!rooms.has(interviewId)) {
    rooms.set(interviewId, new Map());
  }

  const roomParticipants = rooms.get(interviewId);

  const participantData = {
    socketId,
    userId: user.id,
    name: user.name,
    role: user.role || "candidate",
    joinedAt: new Date().toISOString(),
  };

  roomParticipants.set(socketId, participantData);
  socketToRoomMap.set(socketId, interviewId);

  return {
    participant: participantData,
    participantCount: roomParticipants.size,
  };
};

/**
 * Remove a participant from an interview room by socketId
 */
const removeParticipant = (socketId) => {
  const interviewId = socketToRoomMap.get(socketId);
  if (!interviewId) return null;

  socketToRoomMap.delete(socketId);

  const roomParticipants = rooms.get(interviewId);
  let removedParticipant = null;

  if (roomParticipants) {
    removedParticipant = roomParticipants.get(socketId);
    roomParticipants.delete(socketId);

    // Clean up empty room
    if (roomParticipants.size === 0) {
      rooms.delete(interviewId);
    }
  }

  return {
    interviewId,
    participant: removedParticipant,
    participantCount: roomParticipants ? roomParticipants.size : 0,
  };
};

/**
 * Get all active participants in a specific room
 */
const getParticipants = (interviewId) => {
  const roomParticipants = rooms.get(interviewId);
  if (!roomParticipants) return [];
  return Array.from(roomParticipants.values());
};

/**
 * Get formatted room state payload
 */
const getRoomState = (interviewId) => {
  const participants = getParticipants(interviewId);
  return {
    interviewId,
    participantCount: participants.length,
    participants,
  };
};

module.exports = {
  addParticipant,
  removeParticipant,
  getParticipants,
  getRoomState,
};
