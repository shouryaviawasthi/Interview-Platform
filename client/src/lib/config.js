// Single source of truth for where the backend lives. The Socket.IO
// origin is derived from the API URL (strip the trailing /api) so
// there's only one thing to configure in .env.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

// How long each recorded audio chunk is before it's sent for
// transcription. Groq bills a 10s minimum per request regardless, so
// going much shorter than that wastes quota without improving
// perceived latency; going much longer feels less "live".
export const CHUNK_DURATION_MS = 8000;
