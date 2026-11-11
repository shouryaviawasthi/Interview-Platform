import { INTERVIEW_STATUS } from "../../constants/routes";

const StatusBadge = ({ status, pulse = false }) => {
  const config = INTERVIEW_STATUS[status] || INTERVIEW_STATUS.scheduled;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}
    >
      <span className={`relative h-1.5 w-1.5 rounded-full ${config.dot}`}>
        {pulse && status === "live" && (
          <span className={`absolute inset-0 rounded-full ${config.dot} animate-pulse-ring`} />
        )}
      </span>
      {config.label}
    </span>
  );
};

export default StatusBadge;
