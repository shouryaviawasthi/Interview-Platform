import axios from "axios";
import { API_BASE_URL } from "./config";

const client = axios.create({ baseURL: API_BASE_URL });

/**
 * session is either:
 *   { type: "interviewer", token }   — JWT from login/register
 *   { type: "candidate", joinToken } — the interview's one-time join token
 * null/undefined is valid for the few public endpoints (login, register,
 * join-by-token).
 */
const authHeaders = (session) => {
  if (!session) return {};
  if (session.type === "interviewer" && session.token) return { Authorization: `Bearer ${session.token}` };
  if (session.type === "candidate" && session.joinToken) return { "x-join-token": session.joinToken };
  return {};
};

const extractMessage = async (error) => {
  const data = error.response?.data;
  if (!data) return error.message || "Something went wrong. Please try again.";
  // Blob-typed requests (PDF download) get their error body back as a
  // Blob too — it's still JSON underneath, just needs decoding first.
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed.message || "Something went wrong. Please try again.";
    } catch (_err) {
      return "Something went wrong. Please try again.";
    }
  }
  return data.message || "Something went wrong. Please try again.";
};

const unwrap = async (promise) => {
  try {
    const res = await promise;
    return res.data;
  } catch (error) {
    const message = await extractMessage(error);
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    throw wrapped;
  }
};

export const authApi = {
  register: (name, email, password) => unwrap(client.post("/auth/register", { name, email, password })),
  login: (email, password) => unwrap(client.post("/auth/login", { email, password })),
  me: (token) => unwrap(client.get("/auth/me", { headers: authHeaders({ type: "interviewer", token }) })),
};

export const interviewApi = {
  create: (session, body) => unwrap(client.post("/interviews", body, { headers: authHeaders(session) })),
  list: (session) => unwrap(client.get("/interviews", { headers: authHeaders(session) })),
  dashboard: (session) => unwrap(client.get("/interviews/dashboard", { headers: authHeaders(session) })),
  getById: (session, id) => unwrap(client.get(`/interviews/${id}`, { headers: authHeaders(session) })),
  update: (session, id, body) => unwrap(client.put(`/interviews/${id}`, body, { headers: authHeaders(session) })),
  remove: (session, id) => unwrap(client.delete(`/interviews/${id}`, { headers: authHeaders(session) })),

  joinByToken: (token) => unwrap(client.get(`/interviews/join/${token}`)),

  uploadResume: (session, id, file) => {
    const form = new FormData();
    form.append("resume", file);
    return unwrap(
      client.post(`/interviews/${id}/resume`, form, {
        headers: { ...authHeaders(session), "Content-Type": "multipart/form-data" },
      })
    );
  },

  end: (session, id) => unwrap(client.post(`/interviews/${id}/end`, {}, { headers: authHeaders(session) })),
  regenerateReport: (session, id) =>
    unwrap(client.post(`/interviews/${id}/report/generate`, {}, { headers: authHeaders(session) })),

  getTranscript: (session, id) => unwrap(client.get(`/interviews/${id}/transcript`, { headers: authHeaders(session) })),

  postTranscriptChunk: (session, id, blob, timeOffsetSeconds) => {
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");
    form.append("timeOffsetSeconds", String(timeOffsetSeconds));
    return unwrap(
      client.post(`/interviews/${id}/transcript`, form, {
        headers: { ...authHeaders(session), "Content-Type": "multipart/form-data" },
      })
    );
  },

  getReport: (session, id) => unwrap(client.get(`/interviews/${id}/report`, { headers: authHeaders(session) })),

  getReportPdfBlob: async (session, id) => {
    try {
      const res = await client.get(`/interviews/${id}/report/pdf`, {
        headers: authHeaders(session),
        responseType: "blob",
      });
      return res.data;
    } catch (error) {
      const message = await extractMessage(error);
      const wrapped = new Error(message);
      wrapped.status = error.response?.status;
      throw wrapped;
    }
  },
};

export default client;
