const { generateCandidateReportPdf } = require("./candidatePdf.service");
const { generateInterviewerReportPdf } = require("./interviewerPdf.service");
const reportModel = require("../../models/report.model");
const interviewModel = require("../../models/interview.model");
const analyticsModel = require("../../models/analytics.model");
const transcriptModel = require("../../models/transcript.model");
const { findUserById } = require("../../models/user.model");

/**
 * Validates candidate report_json structure for PDF generation
 * @param {Object} reportJson - The report JSON to validate
 * @throws {Error} If validation fails
 */
const validateCandidateReportJson = (reportJson) => {
  if (!reportJson || typeof reportJson !== 'object') {
    throw new Error("Report data is missing or invalid. Cannot generate PDF without valid report content.");
  }

  const requiredFields = ['overallScore'];
  const missingFields = requiredFields.filter(field => reportJson[field] === undefined || reportJson[field] === null);
  
  if (missingFields.length > 0) {
    throw new Error(`Report is incomplete. Missing required fields for PDF generation: ${missingFields.join(', ')}. Please ensure the interview analysis is complete.`);
  }

  // Check for expected sections
  const expectedSections = ['technicalEvaluation', 'problemSolving', 'communication', 'behavioralPerformance'];
  const missingSections = expectedSections.filter(section => !reportJson[section] || typeof reportJson[section] !== 'object');
  
  if (missingSections.length > 0) {
    console.warn(`PDF generation continuing with incomplete sections: ${missingSections.join(', ')}`);
  }
};

/**
 * Generate Candidate Report PDF buffer and filename.
 */
const getCandidateReportPdf = async (interviewId) => {
  try {
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      throw new Error("Interview not found. Cannot generate PDF for non-existent interview.");
    }

    const report = await reportModel.getCandidateReport(interviewId);
    
    // Enhanced validation with specific error messages
    if (!report) {
      throw new Error("No candidate report exists for this interview. The interview analysis must be completed first before generating a PDF report.");
    }

    if (report.status === 'processing') {
      throw new Error("Candidate report is still being generated. Please wait for the analysis to complete before downloading the PDF.");
    }

    if (report.status === 'failed') {
      const errorMsg = report.error_message || 'Unknown error occurred during report generation';
      throw new Error(`Candidate report generation failed: ${errorMsg}. Please retry the interview analysis.`);
    }

    if (report.status !== "completed") {
      throw new Error(`Candidate report is not ready for PDF generation. Current status: ${report.status}. Expected status: completed.`);
    }

    if (!report.report_json) {
      throw new Error("Candidate report data is missing. The report exists but contains no analysis data. Please regenerate the interview analysis.");
    }

    // Parse and validate report JSON
    let reportJson;
    try {
      reportJson = typeof report.report_json === 'string' ? JSON.parse(report.report_json) : report.report_json;
    } catch (parseError) {
      throw new Error("Candidate report contains invalid data format. Please regenerate the interview analysis.");
    }

    validateCandidateReportJson(reportJson);

    // Safely retrieve supporting data with null checks
    const analytics = await analyticsModel.getAnalyticsByInterviewId(interviewId);
    const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);

    // Ensure we have the report_json in the correct format for PDF generation
    const reportWithParsedJson = {
      ...report,
      report_json: reportJson
    };

    const pdfBuffer = await generateCandidateReportPdf({
      interview,
      report: reportWithParsedJson,
      analytics,
      segments: segments || [],
    });

    const sanitizedName = (interview.candidate_name || "Candidate")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Candidate_Report_${sanitizedName}.pdf`;

    return { pdfBuffer, filename };
  } catch (error) {
    // Re-throw with enhanced context if needed
    if (error.message.includes('PDF generation')) {
      throw error;
    }
    throw new Error(`Failed to generate candidate PDF: ${error.message}`);
  }
};

/**
 * Validates interviewer report_json structure for PDF generation
 * @param {Object} reportJson - The report JSON to validate
 * @throws {Error} If validation fails
 */
const validateInterviewerReportJson = (reportJson) => {
  if (!reportJson || typeof reportJson !== 'object') {
    throw new Error("Interviewer report data is missing or invalid. Cannot generate PDF without valid report content.");
  }

  const requiredFields = ['overallScore'];
  const missingFields = requiredFields.filter(field => reportJson[field] === undefined || reportJson[field] === null);
  
  if (missingFields.length > 0) {
    throw new Error(`Interviewer report is incomplete. Missing required fields for PDF generation: ${missingFields.join(', ')}. Please ensure the interview analysis is complete.`);
  }

  // Check for expected sections
  const expectedSections = ['questionQuality', 'followUpQuality', 'interviewStructure', 'candidateEngagement', 'communication'];
  const missingSections = expectedSections.filter(section => !reportJson[section] || typeof reportJson[section] !== 'object');
  
  if (missingSections.length > 0) {
    console.warn(`PDF generation continuing with incomplete sections: ${missingSections.join(', ')}`);
  }
};

/**
 * Generate Interviewer Report PDF buffer and filename.
 */
const getInterviewerReportPdf = async (interviewId) => {
  try {
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      throw new Error("Interview not found. Cannot generate PDF for non-existent interview.");
    }

    const report = await reportModel.getInterviewerReport(interviewId);
    
    // Enhanced validation with specific error messages
    if (!report) {
      throw new Error("No interviewer report exists for this interview. The interview analysis must be completed first before generating a PDF report.");
    }

    if (report.status === 'processing') {
      throw new Error("Interviewer report is still being generated. Please wait for the analysis to complete before downloading the PDF.");
    }

    if (report.status === 'failed') {
      const errorMsg = report.error_message || 'Unknown error occurred during report generation';
      throw new Error(`Interviewer report generation failed: ${errorMsg}. Please retry the interview analysis.`);
    }

    if (report.status !== "completed") {
      throw new Error(`Interviewer report is not ready for PDF generation. Current status: ${report.status}. Expected status: completed.`);
    }

    if (!report.report_json) {
      throw new Error("Interviewer report data is missing. The report exists but contains no analysis data. Please regenerate the interview analysis.");
    }

    // Parse and validate report JSON
    let reportJson;
    try {
      reportJson = typeof report.report_json === 'string' ? JSON.parse(report.report_json) : report.report_json;
    } catch (parseError) {
      throw new Error("Interviewer report contains invalid data format. Please regenerate the interview analysis.");
    }

    validateInterviewerReportJson(reportJson);

    // Safely retrieve interviewer info with null checks
    const interviewer = await findUserById(interview.interviewer_id);
    if (!interviewer) {
      console.warn(`Interviewer not found for interview ${interviewId}, using default name`);
    }

    // Safely retrieve supporting data with null checks
    const analytics = await analyticsModel.getAnalyticsByInterviewId(interviewId);
    const segments = await transcriptModel.getSegmentsByInterviewId(interviewId);

    // Ensure we have the report_json in the correct format for PDF generation
    const reportWithParsedJson = {
      ...report,
      report_json: reportJson
    };

    const pdfBuffer = await generateInterviewerReportPdf({
      interview,
      interviewer,
      report: reportWithParsedJson,
      analytics,
      segments: segments || [],
    });

    const sanitizedName = (interviewer?.name || "Interviewer")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Interviewer_Report_${sanitizedName}.pdf`;

    return { pdfBuffer, filename };
  } catch (error) {
    // Re-throw with enhanced context if needed
    if (error.message.includes('PDF generation')) {
      throw error;
    }
    throw new Error(`Failed to generate interviewer PDF: ${error.message}`);
  }
};

module.exports = {
  getCandidateReportPdf,
  getInterviewerReportPdf,
  validateCandidateReportJson,
  validateInterviewerReportJson,
};
