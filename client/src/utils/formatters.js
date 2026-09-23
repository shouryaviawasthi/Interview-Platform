export const formatDate = (dateLike) => {
  if (!dateLike) return "—";
  try {
    return new Date(dateLike).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (_err) {
    return "—";
  }
};

export const formatDateTime = (dateLike) => {
  if (!dateLike) return "—";
  try {
    return new Date(dateLike).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (_err) {
    return "—";
  }
};

/** Formats a seconds count as m:ss, used for elapsed-time / transcript timestamps. */
export const formatDuration = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const truncate = (str, max) => {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

export const initials = (name) => {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};
