const interviewService = require("../services/interview/interview.service");

/**
 * POST /api/interviews
 * Create a new interview
 */
const createInterview = async (req, res, next) => {
  try {
    const result = await interviewService.createInterview(req.user.id, req.body);

    res.status(201).json({
      success: true,
      interview: result.interview,
      joinLink: result.joinLink,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews
 * Get paginated, searched, and filtered interviews for logged-in user
 */
const getAllInterviews = async (req, res, next) => {
  try {
    const { page, limit, search, status, reportStatus, sort } = req.query;

    const result = await interviewService.getAllInterviews(req.user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || "",
      status: status || "all",
      reportStatus: reportStatus || "all",
      sort: sort || "newest",
    });

    res.status(200).json({
      success: true,
      count: result.interviews.length,
      pagination: result.pagination,
      interviews: result.interviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/dashboard
 * Get role-aware dashboard stats (interviewer or candidate)
 */
const getDashboard = async (req, res, next) => {
  try {
    const stats = await interviewService.getDashboard(req.user);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/join/:token
 * Public — candidate joins via token
 */
const joinInterview = async (req, res, next) => {
  try {
    const interview = await interviewService.joinInterview(req.params.token);

    res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/:id
 * Get single interview by ID
 */
const getInterviewById = async (req, res, next) => {
  try {
    const interview = await interviewService.getInterviewById(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/interviews/:id
 * Update interview
 */
const updateInterview = async (req, res, next) => {
  try {
    const interview = await interviewService.updateInterview(
      req.params.id,
      req.user.id,
      req.body
    );

    res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/interviews/:id
 * Delete interview
 */
const deleteInterview = async (req, res, next) => {
  try {
    await interviewService.deleteInterview(req.params.id, req.user.id);

    res.status(200).json({
      success: true,
      message: "Interview deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/resume
 * Upload and parse resume PDF
 */
const uploadResume = async (req, res, next) => {
  try {
    const resume = await interviewService.uploadResume(
      req.params.id,
      req.user.id,
      req.file
    );

    res.status(201).json({
      success: true,
      resume,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/start
 * Start a scheduled interview — interviewer only
 */
const startInterview = async (req, res, next) => {
  try {
    const interview = await interviewService.startInterview(
      req.params.id,
      req.user.id
    );
    res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/end
 * End a live interview — interviewer only
 * Also auto-triggers Groq report generation (fire-and-forget).
 */
const endInterview = async (req, res, next) => {
  try {
    const interview = await interviewService.endInterview(
      req.params.id,
      req.user.id
    );
    res.status(200).json({
      success: true,
      interview,
    });

    // Auto-trigger Groq reports fire-and-forget (no await — don't block response)
    // Reports will generate in background; client polls for status.
    (async () => {
      try {
        const liveTranscript = require("../services/transcription/liveTranscription.service");
        if (liveTranscript.isSessionActive(req.params.id)) {
          await liveTranscript.stopSession(req.params.id);
          console.log(`[Interview] Flushed and stopped live transcript session for ${req.params.id}`);
        }
        const { generateReports } = require("../services/report/report.service");
        generateReports(req.params.id, "both");
        console.log(`[Interview] Auto-triggered Groq report generation for ${req.params.id}`);
      } catch (reportErr) {
        console.error(`[Interview] Failed to auto-trigger reports for ${req.params.id}:`, reportErr.message);
      }
    })();
  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/interviews/:id/session
 * Get session state (status + timestamps + presence) — interviewer only
 */
const getSession = async (req, res, next) => {
  try {
    const session = await interviewService.getSession(
      req.params.id,
      req.user.id
    );
    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInterview,
  getAllInterviews,
  getDashboard,
  joinInterview,
  getInterviewById,
  updateInterview,
  deleteInterview,
  uploadResume,
  startInterview,
  endInterview,
  getSession,
};
