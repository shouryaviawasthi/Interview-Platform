const TONES = {
  teal: "bg-teal-soft text-teal-deep",
  amber: "bg-amber-soft text-amber",
  green: "bg-green-soft text-green",
  red: "bg-red-soft text-red",
  neutral: "bg-black/5 text-ink-soft",
};

// Interview lifecycle statuses map to a tone by default so callers don't
// need to know the mapping — pass `tone` explicitly to override (e.g.
// for a Hire/Maybe/Reject recommendation chip).
const STATUS_TONES = {
  scheduled: "neutral",
  live: "amber",
  completed: "teal",
  cancelled: "red",
};

const StatusPill = ({ status, tone, children, className = "" }) => {
  const resolvedTone = tone || STATUS_TONES[status] || "neutral";
  const label = children ?? status;
  const isLive = status === "live";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${TONES[resolvedTone]} ${className}`}
    >
      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" aria-hidden="true" />}
      {label}
    </span>
  );
};

export default StatusPill;
