import api from "../lib/axios";

export const createInterview = async ({ candidateName, candidateEmail, jobDescription }) => {
  const { data } = await api.post("/interviews", { candidateName, candidateEmail, jobDescription });
  return data; // { interview, joinLink }
};

export const getAllInterviews = async () => {
  const { data } = await api.get("/interviews");
  return data.interviews;
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
