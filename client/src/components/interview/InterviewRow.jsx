import { Link } from "react-router-dom";
import { FiChevronRight, FiMail } from "react-icons/fi";
import StatusBadge from "../ui/StatusBadge";
import { ROUTES } from "../../constants/routes";

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (s) => {
  if (s == null || isNaN(s)) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const InterviewRow = ({ interview }) => {
  const score = interview.candidate_score ?? interview.candidateScore;
  const reportStatus = interview.candidate_report_status ?? interview.candidateReportStatus;
  const duration = interview.duration_seconds ?? interview.durationSeconds;

  return (
    <Link
      to={ROUTES.interviewDetail(interview.id)}
      className="group flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4 transition-all hover:border-lav-300 hover:shadow-[var(--shadow-soft)] sm:p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lav-100 font-display text-sm font-semibold text-lav-700">
        {interview.candidate_name?.[0]?.toUpperCase() || "?"}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-display text-sm font-semibold text-ink-900 sm:text-base">
            {interview.candidate_name}
          </p>
          <StatusBadge status={interview.status} pulse />

          {score != null && (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {score}/100
            </span>
          )}

          {reportStatus === "completed" && score == null && (
            <span className="rounded-full bg-lav-50 border border-lav-200 px-2 py-0.5 text-[10px] font-semibold text-lav-700 uppercase">
              Report Ready
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-400">
          <FiMail className="h-3 w-3 shrink-0" />
          {interview.candidate_email}
        </p>
        <p className="mt-1 truncate text-xs text-ink-500 line-clamp-1">{interview.job_description}</p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-xs font-medium text-ink-400">
          {duration ? formatTime(duration) : "Created"}
        </p>
        <p className="text-sm font-medium text-ink-700">{formatDate(interview.created_at)}</p>
      </div>

      <FiChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-lav-500" />
    </Link>
  );
};

export default InterviewRow;
