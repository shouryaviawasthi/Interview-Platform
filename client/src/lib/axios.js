import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const getServerUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    const configuredServer = new URL(import.meta.env.VITE_SERVER_URL, window.location.origin);
    const localHosts = ["localhost", "127.0.0.1", "::1"];
    const configuredServerIsLocal = localHosts.includes(configuredServer.hostname);
    const pageIsLocal = localHosts.includes(window.location.hostname);

    if (!configuredServerIsLocal || pageIsLocal) return import.meta.env.VITE_SERVER_URL;
  }

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
  }

  return window.location.origin;
};

export const SERVER_URL = getServerUrl();
export const TOKEN_KEY = "aip_token";
export const USER_KEY = "aip_user";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
