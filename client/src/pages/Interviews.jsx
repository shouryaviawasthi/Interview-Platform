import { useEffect, useState, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  FiPlus, FiSearch, FiVideo, FiFilter,
  FiChevronLeft, FiChevronRight, FiSliders,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import InterviewRow from "../components/interview/InterviewRow";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import { getAllInterviews } from "../services/interview.service";
import { ROUTES, INTERVIEW_STATUS } from "../constants/routes";
import { useAuth } from "../context/AuthContext";

const STATUS_FILTERS = ["all", ...Object.keys(INTERVIEW_STATUS)];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "upcoming", label: "Upcoming First" },
  { value: "highest_score", label: "Highest Score" },
  { value: "lowest_score", label: "Lowest Score" },
];

const Interviews = () => {
  const { onMenuClick } = useOutletContext();
  const { user } = useAuth();
  const isCandidate = user?.role === "candidate";

  const [interviews, setInterviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllInterviews({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        status,
        reportStatus,
        sort,
      });

      if (res && res.interviews) {
        setInterviews(res.interviews);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else if (Array.isArray(res)) {
        setInterviews(res);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load interviews");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, status, reportStatus, sort]);

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleReportStatusChange = (newReportStatus) => {
    setReportStatus(newReportStatus);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSortChange = (newSort) => {
    setSort(newSort);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div>
      <Topbar
        onMenuClick={onMenuClick}
        title={isCandidate ? "My Interviews" : "Interview History"}
        subtitle={`${pagination.totalCount || interviews.length} total interview${pagination.totalCount === 1 ? "" : "s"} found`}
        actions={
          !isCandidate && (
            <Link to={ROUTES.INTERVIEW_NEW}>
              <Button icon={FiPlus}>Schedule interview</Button>
            </Link>
          )
        }
      />

      <div className="px-4 py-6 sm:px-8 sm:py-8 space-y-6">
        {/* ── SEARCH & FILTER CONTROLS ─────────────────────────────────── */}
        <div className="flex flex-col gap-4 rounded-2xl border border-ink-100 bg-white p-4 sm:p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-md">
              <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate, email, role, or ID…"
                className="w-full rounded-xl border border-ink-100 bg-ink-50/40 py-2.5 pl-10 pr-3.5 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-4 focus:ring-lav-100 focus:border-lav-400 transition-all"
              />
            </div>

            {/* Sort & Quick Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <FiSliders className="h-4 w-4 text-ink-400" />
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2 text-xs font-semibold text-ink-700 focus:outline-none focus:ring-2 focus:ring-lav-200"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <FiFilter className="h-4 w-4 text-ink-400" />
                <select
                  value={reportStatus}
                  onChange={(e) => handleReportStatusChange(e.target.value)}
                  className="rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2 text-xs font-semibold text-ink-700 focus:outline-none focus:ring-2 focus:ring-lav-200"
                >
                  <option value="all">All Reports</option>
                  <option value="reports_ready">Reports Ready</option>
                  <option value="pending">Pending Reports</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100/70 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400 mr-1">Status:</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => handleStatusChange(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                  status === f
                    ? "bg-lav-600 text-white shadow-sm"
                    : "bg-white text-ink-500 border border-ink-100 hover:border-lav-300 hover:text-ink-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── INTERVIEW LIST / RESULTS ──────────────────────────────────── */}
        {loading ? (
          <Loader label="Loading interviews" />
        ) : interviews.length === 0 ? (
          <EmptyState
            icon={FiVideo}
            title={pagination.totalCount === 0 && !search && status === "all" ? "No interviews recorded" : "No matching interviews"}
            description={
              pagination.totalCount === 0 && !search && status === "all"
                ? "Schedule your first interview to begin conducting assessments and generating AI reports."
                : "Try adjusting your search keywords, status filters, or sorting criteria."
            }
            action={
              !isCandidate && (
                <Link to={ROUTES.INTERVIEW_NEW}>
                  <Button icon={FiPlus}>Schedule interview</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {interviews.map((interview) => (
              <InterviewRow key={interview.id} interview={interview} />
            ))}
          </div>
        )}

        {/* ── SERVER-SIDE PAGINATION CONTROLS ───────────────────────────── */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-500">
              Showing page <strong className="text-ink-800">{pagination.page}</strong> of{" "}
              <strong className="text-ink-800">{pagination.totalPages}</strong> ({pagination.totalCount} total)
            </p>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                icon={FiChevronLeft}
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                  if (
                    p === 1 ||
                    p === pagination.totalPages ||
                    (p >= pagination.page - 1 && p <= pagination.page + 1)
                  ) {
                    return (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                          p === pagination.page
                            ? "bg-lav-600 text-white"
                            : "bg-white text-ink-600 border border-ink-100 hover:border-lav-300"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === pagination.page - 2 || p === pagination.page + 2) {
                    return <span key={p} className="px-1 text-ink-400">…</span>;
                  }
                  return null;
                })}
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next <FiChevronRight className="ml-1 h-4 w-4 inline" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Interviews;
