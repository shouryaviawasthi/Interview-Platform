const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const pdfParse = require("pdf-parse");

const interviewModel = require("../../models/interview.model");
const resumeModel = require("../../models/resume.model");
const roomService = require("../socket/room.service");
const { getIO } = require("../../sockets/socket");

/**
 * Create a new interview
 */
const createInterview = async (interviewerId, body) => {
  const { candidateName, candidateEmail, jobDescription } = body;

  // Validate input
  if (!candidateName || !candidateEmail || !jobDescription) {
    throw new Error("candidateName, candidateEmail, and jobDescription are required");
  }

  // Generate a unique join token
  const join_token = uuidv4();

  const interview = await interviewModel.createInterview({
    interviewer_id: interviewerId,
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    job_description: jobDescription,
    join_token,
  });

  // Build a shareable candidate link
  const joinLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/interview/join/${join_token}`;

  return { interview, joinLink };
};

/**
 * Get paginated & filtered interviews for logged-in user (role-aware)
 */
const getAllInterviews = async (user, options = {}) => {
  const userId = typeof user === "object" ? user.id : user;
  const role = typeof user === "object" ? user.role : "interviewer";
  const email = typeof user === "object" ? user.email : null;

  return await interviewModel.getPaginatedInterviews({
    userId,
    role,
    email,
    search: options.search || "",
    status: options.status || "all",
    reportStatus: options.reportStatus || "all",
    sort: options.sort || "newest",
    page: options.page || 1,
    limit: options.limit || 20,
  });
};

/**
 * Get single interview by ID — verifies authorization (Interviewer or Candidate)
 */
const getInterviewById = async (interviewId, user) => {
  const interview = await interviewModel.getInterviewById(interviewId);

  if (!interview) {
    throw new Error("Interview not found");
  }

  const userId = typeof user === "object" ? user.id : user;
  const role = typeof user === "object" ? user.role : "interviewer";
  const email = typeof user === "object" ? user.email : null;

  const isOwner = interview.interviewer_id === userId;
  const isCandidate = role === "candidate" && interview.candidate_email === email;

  if (!isOwner && !isCandidate) {
    throw new Error("Access denied");
  }

  return interview;
};

/**
 * Update interview — verifies ownership before updating
 */
const updateInterview = async (interviewId, interviewerId, updates) => {
  const interview = await interviewModel.getInterviewById(interviewId);

  if (!interview) {
    throw new Error("Interview not found");
  }

  if (interview.interviewer_id !== interviewerId) {
    throw new Error("Access denied");
  }

  const updated = await interviewModel.updateInterview(interviewId, {
    candidate_name: updates.candidateName,
    candidate_email: updates.candidateEmail,
    job_description: updates.jobDescription,
  });

  return updated;
};

/**
 * Delete interview — verifies ownership before deleting
 */
const deleteInterview = async (interviewId, interviewerId) => {
  const interview = await interviewModel.getInterviewById(interviewId);

  if (!interview) {
    throw new Error("Interview not found");
  }

  if (interview.interviewer_id !== interviewerId) {
    throw new Error("Access denied");
  }

  await interviewModel.deleteInterview(interviewId);
};

/**
 * Public join — find interview by token
 */
const joinInterview = async (token) => {
  const interview = await interviewModel.getInterviewByToken(token);

  if (!interview) {
    throw new Error("Invalid or expired join link");
  }

  return interview;
};

/**
 * Upload and parse resume PDF
 */
const uploadResume = async (interviewId, interviewerId, file) => {
  // Verify interview exists and belongs to interviewer
  const interview = await interviewModel.getInterviewById(interviewId);

  if (!interview) {
    throw new Error("Interview not found");
  }

  if (interview.interviewer_id !== interviewerId) {
    throw new Error("Access denied");
  }

  if (!file) {
    throw new Error("No file uploaded");
  }

  // Parse PDF text
  const fileBuffer = fs.readFileSync(file.path);
  const parsedData = await pdfParse(fileBuffer);
  const resume_text = parsedData.text;

  // Save to DB — relative path stored
  const resume_file_url = `uploads/resumes/${file.filename}`;

  const resume = await resumeModel.createResume({
    interview_id: interviewId,
    resume_file_url,
    resume_text,
  });

  return resume;
};

/**
 * Get dashboard stats for logged-in user (role-aware: interviewer or candidate)
 */
const getDashboard = async (user) => {
  const userId = typeof user === "object" ? user.id : user;
  const role = typeof user === "object" ? user.role : "interviewer";
  const email = typeof user === "object" ? user.email : null;

  return await interviewModel.getDashboardStats({ userId, role, email });
};

/**
 * Start an interview session.
 * Only the interviewer who owns the interview may start it.
 * Interview must be in 'scheduled' status.
 */
const startInterview = async (interviewId, interviewerId) => {
  // 1. Fetch + verify ownership
  const interview = await interviewModel.getInterviewById(interviewId);
  if (!interview) {
    const err = new Error("Interview not found");
    err.statusCode = 404;
    throw err;
  }
  if (interview.interviewer_id !== interviewerId) {
    const err = new Error("You are not authorized to start this interview");
    err.statusCode = 403;
    throw err;
  }

  // 2. Guard invalid state transitions
  if (interview.status === "live") {
    const err = new Error("Interview is already live");
    err.statusCode = 409;
    throw err;
  }
  if (interview.status === "completed") {
    const err = new Error("Interview is already completed and cannot be restarted");
    err.statusCode = 409;
    throw err;
  }
  if (interview.status === "cancelled") {
    const err = new Error("Interview has been cancelled");
    err.statusCode = 409;
    throw err;
  }

  // 3. Conditional UPDATE (only succeeds if still 'scheduled' — prevents races)
  const updated = await interviewModel.startInterview(interviewId);
  if (!updated) {
    // Another request won the race or status changed between fetch and update
    const err = new Error("Interview could not be started. It may have already changed status.");
    err.statusCode = 409;
    throw err;
  }

  // 4. Broadcast to all room participants via Socket.IO
  try {
    const io = getIO();
    io.to(interviewId).emit("interview-started", {
      interviewId,
      startedAt: updated.started_at,
      status: updated.status,
    });
  } catch (socketErr) {
    console.error("[Socket] Failed to emit interview-started:", socketErr.message);
  }

  return updated;
};

/**
 * End a live interview session.
 * Only the interviewer who owns the interview may end it.
 * Interview must be in 'live' status.
 */
const endInterview = async (interviewId, interviewerId) => {
  // 1. Fetch + verify ownership
  const interview = await interviewModel.getInterviewById(interviewId);
  if (!interview) {
    const err = new Error("Interview not found");
    err.statusCode = 404;
    throw err;
  }
  if (interview.interviewer_id !== interviewerId) {
    const err = new Error("You are not authorized to end this interview");
    err.statusCode = 403;
    throw err;
  }

  // 2. Guard: must be live to end
  if (interview.status !== "live") {
    const err = new Error(
      interview.status === "completed"
        ? "Interview is already completed"
        : `Interview cannot be ended because its status is '${interview.status}'`
    );
    err.statusCode = 409;
    throw err;
  }

  // 3. Conditional UPDATE (live → completed)
  const updated = await interviewModel.endInterview(interviewId);
  if (!updated) {
    const err = new Error("Interview could not be ended. Status may have changed.");
    err.statusCode = 409;
    throw err;
  }

  // 4. Calculate duration in seconds (authoritative)
  const durationSeconds =
    updated.started_at && updated.ended_at
      ? Math.round((new Date(updated.ended_at) - new Date(updated.started_at)) / 1000)
      : null;

  // 5. Broadcast to all room participants
  try {
    const io = getIO();
    io.to(interviewId).emit("interview-ended", {
      interviewId,
      endedAt: updated.ended_at,
      startedAt: updated.started_at,
      durationSeconds,
      status: updated.status,
    });
  } catch (socketErr) {
    console.error("[Socket] Failed to emit interview-ended:", socketErr.message);
  }

  return { ...updated, durationSeconds };
};

/**
 * Get session state: DB timestamps + in-memory participant presence.
 * Used by the frontend on page load/refresh to restore live state.
 */
const getSession = async (interviewId, interviewerId) => {
  const interview = await interviewModel.getInterviewById(interviewId);
  if (!interview) {
    const err = new Error("Interview not found");
    err.statusCode = 404;
    throw err;
  }
  if (interview.interviewer_id !== interviewerId) {
    const err = new Error("Access denied");
    err.statusCode = 403;
    throw err;
  }

  const session = await interviewModel.getSessionById(interviewId);

  // Merge in-memory presence from Socket.IO room
  const participants = roomService.getParticipants(interviewId);
  const interviewerConnected = participants.some((p) => p.role === "interviewer");
  const candidateConnected = participants.some((p) => p.role === "candidate");

  return {
    interviewId: session.id,
    status: session.status,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationSeconds: session.duration_seconds,
    interviewer: { connected: interviewerConnected },
    candidate: { connected: candidateConnected },
  };
};

module.exports = {
  createInterview,
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  joinInterview,
  uploadResume,
  getDashboard,
  startInterview,
  endInterview,
  getSession,
};
