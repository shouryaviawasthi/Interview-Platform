import { useEffect, useMemo, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { FiPlus, FiSearch, FiVideo } from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import InterviewRow from "../components/interview/InterviewRow";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import { getAllInterviews } from "../services/interview.service";
import { ROUTES, INTERVIEW_STATUS } from "../constants/routes";

const FILTERS = ["all", ...Object.keys(INTERVIEW_STATUS)];

const Interviews = () => {
  const { onMenuClick } = useOutletContext();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getAllInterviews();
        setInterviews(list);
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not load interviews");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return interviews.filter((interview) => {
      const matchesFilter = filter === "all" || interview.status === filter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        interview.candidate_name?.toLowerCase().includes(q) ||
        interview.candidate_email?.toLowerCase().includes(q) ||
        interview.job_description?.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [interviews, query, filter]);

  return (
    <div>
      <Topbar
        onMenuClick={onMenuClick}
        title="Interviews"
        subtitle={`${interviews.length} total interview${interviews.length === 1 ? "" : "s"}`}
        actions={
          <Link to={ROUTES.INTERVIEW_NEW}>
            <Button icon={FiPlus}>Schedule interview</Button>
          </Link>
        }
      />

      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or role"
              className="w-full rounded-xl border border-ink-100 bg-white py-2.5 pl-10 pr-3.5 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-4 focus:ring-lav-100 focus:border-lav-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filter === f
                    ? "bg-lav-600 text-white"
                    : "bg-white text-ink-500 border border-ink-100 hover:border-lav-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Loader label="Loading interviews" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FiVideo}
            title={interviews.length === 0 ? "No interviews yet" : "No matches found"}
            description={
              interviews.length === 0
                ? "Schedule your first interview and share the join link with your candidate."
                : "Try a different search term or filter."
            }
            action={
              interviews.length === 0 && (
                <Link to={ROUTES.INTERVIEW_NEW}>
                  <Button icon={FiPlus}>Schedule interview</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((interview) => (
              <InterviewRow key={interview.id} interview={interview} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Interviews;
