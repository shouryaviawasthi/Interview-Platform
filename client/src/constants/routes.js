export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  INTERVIEWS: "/interviews",
  INTERVIEW_NEW: "/interviews/new",
  INTERVIEW_DETAIL: "/interviews/:id",
  interviewDetail: (id) => `/interviews/${id}`,
  TRANSCRIPT: "/interviews/:id/transcript",
  transcript: (id) => `/interviews/${id}/transcript`,
  CANDIDATE_REPORT: "/interviews/:id/candidate-report",
  candidateReport: (id) => `/interviews/${id}/candidate-report`,
  INTERVIEWER_REPORT: "/interviews/:id/interviewer-report",
  interviewerReport: (id) => `/interviews/${id}/interviewer-report`,
  ANALYTICS: "/interviews/:id/analytics",
  analytics: (id) => `/interviews/${id}/analytics`,
  // Standalone pages (no sidebar layout)
  INTERVIEW_END_DASHBOARD: "/interviews/:id/end",
  interviewEndDashboard: (id) => `/interviews/${id}/end`,
  CANDIDATE_REPORT_SIMPLE: "/report/candidate/:id",
  candidateReportSimple: (id) => `/report/candidate/${id}`,
  INTERVIEWER_REPORT_SIMPLE: "/report/interviewer/:id",
  interviewerReportSimple: (id) => `/report/interviewer/${id}`,
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
