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
 * Get all interviews for logged-in interviewer
 */
const getAllInterviews = async (req, res, next) => {
  try {
    const interviews = await interviewService.getAllInterviews(req.user.id);

    res.status(200).json({
      success: true,
      count: interviews.length,
      interviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/dashboard
 * Get dashboard counts
 */
const getDashboard = async (req, res, next) => {
  try {
    const stats = await interviewService.getDashboard(req.user.id);

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

module.exports = {
  createInterview,
  getAllInterviews,
  getDashboard,
  joinInterview,
  getInterviewById,
  updateInterview,
  deleteInterview,
  uploadResume,
};
