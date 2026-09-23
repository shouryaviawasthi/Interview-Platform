const { generateCandidateReportPdf } = require("./candidatePdf.service");
const { generateInterviewerReportPdf } = require("./interviewerPdf.service");
const reportModel = require("../../models/report.model");
const interviewModel = require("../../models/interview.model");
const analyticsModel = require("../../models/analytics.model");
const transcriptModel = require("../../models/transcript.model");
const { findUserById } = require("../../models/user.model");

/**
 * Generate Candidate Report PDF buffer and filename.
 */
const getCandidateReportPdf = async (interviewId) => {
  const interview = await interviewModel.getInterviewById(interviewId);
  if (!interview) {
    throw new Error("Interview not found.");
  }

  const report = await reportModel.getCandidateReport(interviewId);
  if (!report || report.status !== "completed" || !report.report_json) {
    throw new Error("Candidate report is not ready yet.");
  }

  const analytics = await analyticsModel.getAnalyticsByInterviewId(interviewId);
  const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);

  const pdfBuffer = await generateCandidateReportPdf({
    interview,
    report,
    analytics,
    segments,
  });

  const sanitizedName = (interview.candidate_name || "Candidate")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Candidate_Report_${sanitizedName}.pdf`;

  return { pdfBuffer, filename };
};

/**
 * Generate Interviewer Report PDF buffer and filename.
 */
const getInterviewerReportPdf = async (interviewId) => {
  const interview = await interviewModel.getInterviewById(interviewId);
  if (!interview) {
    throw new Error("Interview not found.");
  }

  const report = await reportModel.getInterviewerReport(interviewId);
  if (!report || report.status !== "completed" || !report.report_json) {
    throw new Error("Interviewer report is not ready yet.");
  }

  const interviewer = await findUserById(interview.interviewer_id);
  const analytics = await analyticsModel.getAnalyticsByInterviewId(interviewId);
  const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);

  const pdfBuffer = await generateInterviewerReportPdf({
    interview,
    interviewer,
    report,
    analytics,
    segments,
  });

  const sanitizedName = (interviewer?.name || "Interviewer")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Interviewer_Report_${sanitizedName}.pdf`;

  return { pdfBuffer, filename };
};

module.exports = {
  getCandidateReportPdf,
  getInterviewerReportPdf,
};
