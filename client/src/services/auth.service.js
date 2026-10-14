import api from "../lib/axios";

const getAuthPayload = (responseData, action) => {
  const envelopes = ["data", "result", "payload", "auth", "session", "tokens"];
  const tokenFields = [
    "token",
    "accessToken",
    "access_token",
    "jwt",
    "jwtToken",
    "jwt_token",
    "authToken",
    "auth_token",
  ];
  const pending = [{ value: responseData, depth: 0 }];
  const visited = new Set();
  let user;
  let token;

  while (pending.length > 0) {
    const { value, depth } = pending.shift();
    if (!value || typeof value !== "object" || Array.isArray(value) || visited.has(value)) continue;
    visited.add(value);

    user ??= value.user ?? value.userData ?? value.profile ?? value.userProfile;
    if (!user && (value.id || value.userId) && value.email) {
      user = value;
    }
    token ??= tokenFields
      .map((field) => value[field])
      .find((candidate) => typeof candidate === "string" && candidate.length > 0);

    if (depth < 5) {
      for (const envelope of envelopes) {
        if (value[envelope] && typeof value[envelope] === "object") {
          pending.push({ value: value[envelope], depth: depth + 1 });
        }
      }
    }
  }

  if (user && typeof user === "object" && !Array.isArray(user) && token) {
    return { user, token };
  }

  const fields = responseData && typeof responseData === "object"
    ? Object.keys(responseData).join(", ")
    : typeof responseData;
  throw new Error(
    `The server returned an incomplete ${action} response (top-level fields: ${fields || "none"}). It must include a user profile and authentication token. Check the API server response format.`
  );
};

export const registerUser = async ({ name, email, password, role }) => {
  const { data } = await api.post("/auth/register", { name, email, password, role });
  return getAuthPayload(data, "registration");
};

export const loginUser = async ({ email, password }) => {
  const { data } = await api.post("/auth/login", { email, password });
  return getAuthPayload(data, "login");
};

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data?.data ?? data; // user object
};
