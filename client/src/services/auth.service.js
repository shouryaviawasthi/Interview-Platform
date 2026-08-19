import api from "../lib/axios";

export const registerUser = async ({ name, email, password, role }) => {
  const { data } = await api.post("/auth/register", { name, email, password, role });
  return data.data || data; // { user, token }
};

export const loginUser = async ({ email, password }) => {
  const { data } = await api.post("/auth/login", { email, password });
  return data.data || data; // { user, token }
};

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data.data; // user
};
