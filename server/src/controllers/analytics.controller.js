const analyticsModel = require("../models/analytics.model");
const interviewModel = require("../models/interview.model");
const audioModel = require("../models/audio.model");
const analyticsService = require("../services/analytics/analytics.service");

/**
 * GET /api/interviews/:id/analytics
 * Retrieve stored interview analytics.
 */
const getAnalytics = async (req, res, next) => {
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

    const analytics = await analyticsModel.getAnalyticsByInterviewId(interviewId);

    if (!analytics) {
      return res.status(200).json({
        success: true,
        analytics: {
          status: "not_started",
          duration: null,
          speakingTime: null,
          speakingPercentage: null,
          turns: null,
          analyticsJson: null,
        },
      });
    }

    res.status(200).json({
      success: true,
      analytics: {
        id: analytics.id,
        interviewId: analytics.interview_id,
        status: analytics.status,
        duration: {
          totalSeconds: analytics.total_duration,
          speakingSeconds: (analytics.interviewer_speaking_time || 0) + (analytics.candidate_speaking_time || 0),
          silenceSeconds: analytics.silence_duration,
        },
        speakingTime: {
          interviewer: analytics.interviewer_speaking_time,
          candidate: analytics.candidate_speaking_time,
        },
        speakingPercentage: {
          interviewer: analytics.interviewer_speaking_percentage ? parseFloat(analytics.interviewer_speaking_percentage) : 0,
          candidate: analytics.candidate_speaking_percentage ? parseFloat(analytics.candidate_speaking_percentage) : 0,
        },
        turns: {
          total: analytics.total_turns,
          interviewer: analytics.interviewer_turn_count,
          candidate: analytics.candidate_turn_count,
          avgInterviewerDuration: analytics.average_interviewer_turn_duration ? parseFloat(analytics.average_interviewer_turn_duration) : 0,
          avgCandidateDuration: analytics.average_candidate_turn_duration ? parseFloat(analytics.average_candidate_turn_duration) : 0,
          longestTurnDuration: analytics.longest_turn_duration ? parseFloat(analytics.longest_turn_duration) : 0,
        },
        questions: {
          total: analytics.question_count,
          followUps: analytics.follow_up_count,
        },
        fillers: {
          candidate: analytics.candidate_filler_count,
          interviewer: analytics.interviewer_filler_count,
        },
        languages: {
          candidate: analytics.candidate_language_stats,
          interviewer: analytics.interviewer_language_stats,
        },
        analyticsJson: analytics.analytics_json,
        errorMessage: analytics.error_message,
        createdAt: analytics.created_at,
        updatedAt: analytics.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/analytics/generate
 * Trigger background generation of analytics.
 */
const generateAnalytics = async (req, res, next) => {
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

    if (interview.status !== "completed") {
      return res.status(409).json({
        success: false,
        message: "Analytics can only be generated for completed interviews.",
      });
    }

    const audio = await audioModel.getAudioByInterviewId(interviewId);
    if (!audio || audio.status !== "completed") {
      return res.status(409).json({
        success: false,
        message: `Transcript is not ready yet. Current status: ${audio?.status ?? "not_started"}.`,
      });
    }

    const existing = await analyticsModel.getAnalyticsByInterviewId(interviewId);
    if (existing?.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Analytics are already completed.",
        status: "completed",
      });
    }
    if (existing?.status === "processing") {
      return res.status(200).json({
        success: true,
        message: "Analytics are already being generated.",
        status: "processing",
      });
    }

    // Fire-and-forget generation
    analyticsService.generateInterviewAnalytics(interviewId);

    res.status(202).json({
      success: true,
      message: "Analytics generation started. Poll GET /analytics for status.",
      status: "processing",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/:id/analytics/retry
 * Retry failed analytics generation.
 */
const retryAnalytics = async (req, res, next) => {
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

    const existing = await analyticsModel.getAnalyticsByInterviewId(interviewId);
    if (existing && existing.status !== "failed") {
      return res.status(409).json({
        success: false,
        message: `Cannot retry analytics with status: ${existing.status}`,
      });
    }

    // Reset status and restart
    await analyticsModel.setAnalyticsStatus(interviewId, "not_started", null);
    analyticsService.generateInterviewAnalytics(interviewId);

    res.status(202).json({
      success: true,
      message: "Analytics retry started.",
      status: "processing",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics,
  generateAnalytics,
  retryAnalytics,
};
