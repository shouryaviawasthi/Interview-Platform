export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  INTERVIEWS: "/interviews",
  INTERVIEW_NEW: "/interviews/new",
  INTERVIEW_DETAIL: "/interviews/:id",
  interviewDetail: (id) => `/interviews/${id}`,
  JOIN: "/interview/join/:token",
  join: (token) => `/interview/join/${token}`,
  ROOM: "/interview/room/:token",
  room: (token) => `/interview/room/${token}`,
  NOT_FOUND: "*",
};

export const INTERVIEW_STATUS = {
  scheduled: {
    label: "Scheduled",
    text: "text-[color:var(--color-status-scheduled)]",
    bg: "bg-[color:var(--color-status-scheduled-bg)]",
    dot: "bg-[color:var(--color-status-scheduled)]",
  },
  live: {
    label: "Live",
    text: "text-[color:var(--color-status-live)]",
    bg: "bg-[color:var(--color-status-live-bg)]",
    dot: "bg-[color:var(--color-status-live)]",
  },
  completed: {
    label: "Completed",
    text: "text-[color:var(--color-status-completed)]",
    bg: "bg-[color:var(--color-status-completed-bg)]",
    dot: "bg-[color:var(--color-status-completed)]",
  },
  cancelled: {
    label: "Cancelled",
    text: "text-[color:var(--color-status-cancelled)]",
    bg: "bg-[color:var(--color-status-cancelled-bg)]",
    dot: "bg-[color:var(--color-status-cancelled)]",
  },
};
