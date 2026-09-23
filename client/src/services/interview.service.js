import api from "../lib/axios";

export const createInterview = async ({ candidateName, candidateEmail, jobDescription }) => {
  const { data } = await api.post("/interviews", { candidateName, candidateEmail, jobDescription });
  return data; // { interview, joinLink }
};

export const getAllInterviews = async (params = {}) => {
  const { data } = await api.get("/interviews", { params });
  return data; // { interviews, pagination, count }
};

export const getDashboard = async () => {
  const { data } = await api.get("/interviews/dashboard");
  return data.data; // { total, scheduled, live, completed, cancelled }
};

export const getInterviewById = async (id) => {
  const { data } = await api.get(`/interviews/${id}`);
  return data.interview;
};

export const updateInterview = async (id, updates) => {
  const { data } = await api.put(`/interviews/${id}`, updates);
  return data.interview;
};

export const deleteInterview = async (id) => {
  const { data } = await api.delete(`/interviews/${id}`);
  return data;
};

export const uploadResume = async (id, file, onProgress) => {
  const formData = new FormData();
  formData.append("resume", file);
  const { data } = await api.post(`/interviews/${id}/resume`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return data.resume;
};

// Public — candidate joins via token, no auth required
export const joinInterviewByToken = async (token) => {
  const { data } = await api.get(`/interviews/join/${token}`);
  return data.interview; // { candidate_name, job_description, status }
};

// Session management
export const startInterview = async (id) => {
  const { data } = await api.post(`/interviews/${id}/start`);
  return data.interview;
};

export const endInterview = async (id) => {
  const { data } = await api.post(`/interviews/${id}/end`);
  return data.interview;
};

export const getSession = async (id) => {
  const { data } = await api.get(`/interviews/${id}/session`);
  return data.session;
};

// ─── Phase 3: Audio + Transcript ──────────────────────────────────

export const uploadAudio = async (id, blob, mimeType, onProgress) => {
  const ext = mimeType?.includes('ogg') ? 'ogg' : mimeType?.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([blob], `interview-audio.${ext}`, { type: mimeType || 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', file);
  const { data } = await api.post(`/interviews/${id}/audio`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return data;
};

export const getTranscript = async (id) => {
  const { data } = await api.get(`/interviews/${id}/transcript`);
  return data.transcript;
};

export const retryTranscript = async (id) => {
  const { data } = await api.post(`/interviews/${id}/transcript/retry`);
  return data;
};

export const assignSpeakers = async (id, speakerMap) => {
  const { data } = await api.post(`/interviews/${id}/transcript/assign-speakers`, { speakerMap });
  return data;
};

// ─── Phase 4: AI Reports ───────────────────────────────────────────────────

export const generateReports = async (id) => {
  const { data } = await api.post(`/interviews/${id}/reports/generate`);
  return data;
};

export const getCandidateReport = async (id) => {
  const { data } = await api.get(`/interviews/${id}/candidate-report`);
  return data.report;
};

export const getInterviewerReport = async (id) => {
  const { data } = await api.get(`/interviews/${id}/interviewer-report`);
  return data.report;
};

export const retryReports = async (id) => {
  const { data } = await api.post(`/interviews/${id}/reports/retry`);
  return data;
};

// ─── Phase 5: Advanced Analytics ───────────────────────────────────────────

export const getAnalytics = async (id) => {
  const { data } = await api.get(`/interviews/${id}/analytics`);
  return data.analytics;
};

export const generateAnalytics = async (id) => {
  const { data } = await api.post(`/interviews/${id}/analytics/generate`);
  return data;
};

export const retryAnalytics = async (id) => {
  const { data } = await api.post(`/interviews/${id}/analytics/retry`);
  return data;
};

// ─── Phase 6: PDF Reports & Export ─────────────────────────────────────────

export const downloadCandidateReportPdf = async (id, candidateName = "Candidate") => {
  const response = await api.get(`/interviews/${id}/reports/candidate/pdf`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = candidateName.replace(/[^a-zA-Z0-9_-]/g, "_");
  link.setAttribute("download", `Candidate_Report_${safeName}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadInterviewerReportPdf = async (id, interviewerName = "Interviewer") => {
  const response = await api.get(`/interviews/${id}/reports/interviewer/pdf`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = interviewerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  link.setAttribute("download", `Interviewer_Report_${safeName}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─── Public (no auth) — candidate report access via join token ──────────────

/**
 * Get candidate report by join token — no authentication required.
 * Used by CandidateEndScreen.
 */
export const getPublicCandidateReport = async (token) => {
  const { data } = await api.get(`/interviews/public/${token}/candidate-report`);
  return data; // { interviewId, candidateName, report }
};

/**
 * Download candidate PDF by join token — no authentication required.
 */
export const downloadPublicCandidateReportPdf = async (token, candidateName = "Candidate") => {
  const response = await api.get(`/interviews/public/${token}/candidate-report/pdf`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = candidateName.replace(/[^a-zA-Z0-9_-]/g, "_");
  link.setAttribute("download", `My_Interview_Report_${safeName}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

