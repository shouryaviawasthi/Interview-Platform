import api from "../lib/axios";

export const registerUser = async ({ name, email, password, role }) => {
  const { data } = await api.post("/auth/register", { name, email, password, role });
  // Server returns { success, data: { user, token } }
  const payload = data?.data ?? data;
  if (!payload?.user || !payload?.token) {
    throw new Error("The server returned an invalid registration response");
  }
  return payload; // { user, token }
};

export const loginUser = async ({ email, password }) => {
  const { data } = await api.post("/auth/login", { email, password });
  // Server returns { success, data: { user, token } }
  const payload = data?.data ?? data;
  if (!payload?.user || !payload?.token) {
    throw new Error("The server returned an invalid login response");
  }
  return payload; // { user, token }
};

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data?.data ?? data; // user object
};
