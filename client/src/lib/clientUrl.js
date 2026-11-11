export const getClientOrigin = () => {
  const configuredOrigin = import.meta.env.VITE_CLIENT_URL?.trim();
  return (configuredOrigin || window.location.origin).replace(/\/+$/, "");
};

export const clientOriginIsLoopback = () => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(getClientOrigin()).hostname);
  } catch {
    return true;
  }
};
