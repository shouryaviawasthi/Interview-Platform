import { Link } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import StatusPill from "../ui/StatusPill";
import { formatDate, truncate } from "../../utils/formatters";

const InterviewRow = ({ interview }) => {
  return (
    <Link
      to={`/interviews/${interview.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-teal/40 hover:bg-teal-soft/30"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{interview.candidate_name}</p>
        <p className="mt-0.5 truncate text-sm text-ink-soft">{truncate(interview.job_description, 80)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="hidden text-sm text-ink-faint sm:inline">{formatDate(interview.created_at)}</span>
        <StatusPill status={interview.status} />
        <FiChevronRight className="text-ink-faint" />
      </div>
    </Link>
  );
};

export default InterviewRow;
