const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const pdfParse = require("pdf-parse");

const interviewModel = require("../../models/interview.model");
const resumeModel = require("../../models/resume.model");

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
 * Get all interviews for logged-in interviewer
 */
const getAllInterviews = async (interviewerId) => {
  const interviews = await interviewModel.getInterviewsByInterviewer(interviewerId);
  return interviews;
};

/**
 * Get single interview by ID — verifies ownership
 */
const getInterviewById = async (interviewId, interviewerId) => {
  const interview = await interviewModel.getInterviewById(interviewId);

  if (!interview) {
    throw new Error("Interview not found");
  }

  if (interview.interviewer_id !== interviewerId) {
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
 * Get dashboard stats for logged-in interviewer
 */
const getDashboard = async (interviewerId) => {
  const stats = await interviewModel.getDashboardStats(interviewerId);

  return {
    total:     parseInt(stats.total),
    scheduled: parseInt(stats.scheduled),
    live:      parseInt(stats.live),
    completed: parseInt(stats.completed),
    cancelled: parseInt(stats.cancelled),
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
};
