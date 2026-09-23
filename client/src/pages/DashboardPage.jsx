import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { interviewApi } from "../lib/api";
import StatCard from "../components/dashboard/StatCard";
import InterviewRow from "../components/dashboard/InterviewRow";
import { PageSpinner, EmptyState } from "../components/ui/Spinner";
import Button from "../components/ui/Button";

const DashboardPage = () => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [interviews, setInterviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([interviewApi.dashboard(session), interviewApi.list(session)])
      .then(([statsRes, listRes]) => {
        if (cancelled) return;
        setStats(statsRes.data);
        setInterviews(listRes.interviews || []);
      })
      .catch((err) => toast.error(err.message || "Couldn't load your dashboard."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return <PageSpinner label="Loading your dashboard…" />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">Your interviews, at a glance.</p>
        </div>
        <Link to="/interviews/new" className="sm:hidden">
          <Button>
            <FiPlus size={16} /> New interview
          </Button>
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Scheduled" value={stats.scheduled} />
          <StatCard label="Live" value={stats.live} tone="amber" />
          <StatCard label="Completed" value={stats.completed} tone="teal" />
          <StatCard label="Cancelled" value={stats.cancelled} />
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Interviews</h2>
        {interviews.length === 0 ? (
          <EmptyState
            title="No interviews yet"
            description="Create your first interview and share the join link with a candidate."
            action={
              <Link to="/interviews/new">
                <Button>
                  <FiPlus size={16} /> New interview
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {interviews.map((interview) => (
              <InterviewRow key={interview.id} interview={interview} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
