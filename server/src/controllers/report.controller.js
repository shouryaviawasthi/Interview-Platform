const reportModel = require("../models/report.model");
const interviewModel = require("../models/interview.model");
const transcriptModel = require("../models/transcript.model");
const audioModel = require("../models/audio.model");
const reportService = require("../services/report/report.service");
const env = require("../config/env");

/**
 * POST /api/interviews/:id/reports/generate
 *
 * Triggers AI report generation for both candidate and interviewer.
 * Pre-conditions checked:
 *  1. Authenticated interviewer owns this interview.
 *  2. Interview is completed.
 *  3. Transcript is completed.
 *  4. Groq API key is configured.
 *  5. Not already completed (idempotency).
 *
 * Report generation runs fire-and-forget.
 * Response is immediate — client polls for status.
 */
const generateReports = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    // Auth check
    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Interview must be completed
    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        message: "Reports can only be generated for completed interviews.",
      });
    }

    // Transcript must be completed or segments must exist
    const audio = await audioModel.getAudioByInterviewId(interviewId);
    const existingSegments = await transcriptModel.getSegmentsByInterviewId(interviewId);
    const hasSegments = existingSegments && existingSegments.length > 0;

    if ((!audio || audio.status !== "completed") && !hasSegments) {
      return res.status(409).json({
        success: false,
        message: `Transcript is not ready yet. Current status: ${audio?.status ?? "not_started"}.`,
      });
    }

    // Groq key check
    if (!env.GROQ_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "Groq API key is not configured on the server.",
      });
    }

    // Check idempotency — return early if both are already completed
    const [candidateRpt, interviewerRpt] = await Promise.all([
      reportModel.getCandidateReport(interviewId),
      reportModel.getInterviewerReport(interviewId),
    ]);

    const candidateDone = candidateRpt?.status === "completed";
    const interviewerDone = interviewerRpt?.status === "completed";
    const candidateProcessing = candidateRpt?.status === "processing";
    const interviewerProcessing = interviewerRpt?.status === "processing";

    if (candidateDone && interviewerDone) {
      return res.status(200).json({
        success: true,
        message: "Both reports are already completed.",
        candidateStatus: "completed",
        interviewerStatus: "completed",
      });
    }

    if (candidateProcessing && interviewerProcessing) {
      return res.status(200).json({
        success: true,
        message: "Reports are already being generated.",
        candidateStatus: "processing",
        interviewerStatus: "processing",
      });
    }

    // Fire-and-forget generation
    reportService.generateReports(interviewId, "both");

    res.status(202).json({
      success: true,
      message: "Report generation started. Poll /candidate-report and /interviewer-report for status.",
      candidateStatus: candidateRpt?.status ?? "not_started",
      interviewerStatus: interviewerRpt?.status ?? "not_started",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/interviews/:id/candidate-report
 */
const getCandidateReport = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }

    const isOwner = interview.interviewer_id === req.user.id;
    const isCandidate = req.user.role === "candidate" && interview.candidate_email === req.user.email;

    if (!isOwner && !isCandidate) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const report = await reportModel.getCandidateReport(interviewId);

    res.status(200).json({
      success: true,
      report: report
        ? {
            id: report.id,
            status: report.status,
            overallScore: report.overall_score ? parseFloat(report.overall_score) : null,
            recommendation: report.recommendation,
            reportJson: report.report_json,
            llmModel: report.llm_model,
            errorMessage: report.error_message,
            createdAt: report.created_at,
            updatedAt: report.updated_at,
          }
        : { status: "not_started", reportJson: null },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/interviews/:id/interviewer-report
 */
const getInterviewerReport = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const report = await reportModel.getInterviewerReport(interviewId);

    res.status(200).json({
      success: true,
      report: report
        ? {
            id: report.id,
            status: report.status,
            overallScore: report.overall_score ? parseFloat(report.overall_score) : null,
            reportJson: report.report_json,
            llmModel: report.llm_model,
            errorMessage: report.error_message,
            createdAt: report.created_at,
            updatedAt: report.updated_at,
          }
        : { status: "not_started", reportJson: null },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/interviews/:id/reports/retry
 * Retry failed reports. Only retries the failed ones, not the completed ones.
 */
const retryReports = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const [candidateRpt, interviewerRpt] = await Promise.all([
      reportModel.getCandidateReport(interviewId),
      reportModel.getInterviewerReport(interviewId),
    ]);

    const nothingToRetry =
      (!candidateRpt || candidateRpt.status === "completed" || candidateRpt.status === "processing") &&
      (!interviewerRpt || interviewerRpt.status === "completed" || interviewerRpt.status === "processing");

    if (nothingToRetry) {
      return res.status(409).json({
        success: false,
        message: "No failed reports to retry.",
      });
    }

    // Reset failed reports to 'not_started' so service will re-run them
    if (candidateRpt?.status === "failed") {
      await reportModel.upsertCandidateReport({
        interview_id: interviewId,
        status: "not_started",
        llm_model: candidateRpt.llm_model,
        error_message: null,
      });
    }
    if (interviewerRpt?.status === "failed") {
      await reportModel.upsertInterviewerReport({
        interview_id: interviewId,
        status: "not_started",
        llm_model: interviewerRpt.llm_model,
        error_message: null,
      });
    }

    // Fire-and-forget
    reportService.generateReports(interviewId, "both");

    res.status(202).json({
      success: true,
      message: "Retry started.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/interviews/:id/reports/candidate/pdf
 * Download Candidate Interview Report as PDF.
 */
const downloadCandidatePdf = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }

    const isOwner = interview.interviewer_id === req.user.id;
    const isCandidate = req.user.role === "candidate" && interview.candidate_email === req.user.email;

    if (!isOwner && !isCandidate) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { getCandidateReportPdf } = require("../services/pdf/pdf.service");
    const { pdfBuffer, filename } = await getCandidateReportPdf(interviewId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/interviews/:id/reports/interviewer/pdf
 * Download Interviewer Performance Report as PDF.
 */
const downloadInterviewerPdf = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    const interviewerId = req.user.id;

    const interview = await interviewModel.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.interviewer_id !== interviewerId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { getInterviewerReportPdf } = require("../services/pdf/pdf.service");
    const { pdfBuffer, filename } = await getInterviewerReportPdf(interviewId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/interviews/public/:token/candidate-report
 * PUBLIC — no auth required. Candidate accesses their own report via join token.
 * Returns only candidate-facing report fields.
 */
const publicGetCandidateReport = async (req, res, next) => {
  try {
    const { token } = req.params;
    const interview = await interviewModel.getInterviewByToken(token);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    if (interview.status !== "completed") {
      return res.status(200).json({
        success: true,
        interviewId: interview.id,
        candidateName: interview.candidate_name,
        report: { status: "not_started", reportJson: null },
      });
    }
    const report = await reportModel.getCandidateReport(interview.id);
    res.status(200).json({
      success: true,
      interviewId: interview.id,
      candidateName: interview.candidate_name,
      report: report
        ? {
            status: report.status,
            overallScore: report.overall_score ? parseFloat(report.overall_score) : null,
            recommendation: report.recommendation,
            reportJson: report.report_json,
            llmModel: report.llm_model,
            errorMessage: report.error_message,
            updatedAt: report.updated_at,
          }
        : { status: "not_started", reportJson: null },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/interviews/public/:token/candidate-report/pdf
 * PUBLIC — no auth. Download candidate PDF by join token.
 */
const publicDownloadCandidatePdf = async (req, res, next) => {
  try {
    const { token } = req.params;
    const interview = await interviewModel.getInterviewByToken(token);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found." });
    }
    const report = await reportModel.getCandidateReport(interview.id);
    if (!report || report.status !== "completed") {
      return res.status(409).json({ success: false, message: "Report is not ready yet." });
    }
    const { getCandidateReportPdf } = require("../services/pdf/pdf.service");
    const { pdfBuffer, filename } = await getCandidateReportPdf(interview.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateReports,
  getCandidateReport,
  getInterviewerReport,
  retryReports,
  downloadCandidatePdf,
  downloadInterviewerPdf,
  publicGetCandidateReport,
  publicDownloadCandidatePdf,
};

