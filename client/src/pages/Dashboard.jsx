import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  FiLayers, FiClock, FiRadio, FiCheckCircle, FiPlus,
  FiVideo, FiAward, FiFileText, FiDownload, FiArrowRight,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import StatCard from "../components/ui/StatCard";
import InterviewRow from "../components/interview/InterviewRow";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import {
  getDashboard,
  getAllInterviews,
  downloadCandidateReportPdf,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { onMenuClick } = useOutletContext();
  const { user } = useAuth();
  const isCandidate = user?.role === "candidate";

  const [stats, setStats] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, res] = await Promise.all([
          getDashboard(),
          getAllInterviews({ limit: 10 }),
        ]);
        setStats(statsData);
        setInterviews(res.interviews || (Array.isArray(res) ? res : []));
      } catch (err) {
        toast.error(err.response?.data?.message || "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loader label="Loading your dashboard" />;

  const firstName = user?.name?.split(" ")[0];
  const upcomingList = interviews.filter((i) => i.status === "scheduled" || i.status === "live");
  const completedList = interviews.filter((i) => i.status === "completed");
  const nextUpcoming = upcomingList[0];

  return (
    <div>
      <Topbar
        onMenuClick={onMenuClick}
        title={`Welcome back${firstName ? `, ${firstName}` : ""}`}
        subtitle={
          isCandidate
            ? "Track your upcoming interviews, performance reports, and feedback"
            : "Here's what's happening across your technical interviews"
        }
        actions={
          !isCandidate && (
            <Link to={ROUTES.INTERVIEW_NEW}>
              <Button icon={FiPlus}>Schedule interview</Button>
            </Link>
          )
        }
      />

      <div className="px-4 py-6 sm:px-8 sm:py-8 space-y-8">
        {/* ── METRICS GRID ──────────────────────────────────────────────── */}
        {isCandidate ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="My Interviews" value={stats?.total ?? 0} icon={FiLayers} tone="lavender" />
            <StatCard label="Upcoming" value={(stats?.scheduled ?? 0) + (stats?.live ?? 0)} icon={FiClock} tone="soft" />
            <StatCard label="Completed" value={stats?.completed ?? 0} icon={FiCheckCircle} tone="soft" />
            <StatCard label="Reports Ready" value={stats?.reportsReady ?? 0} icon={FiFileText} tone="soft" />
            <StatCard
              label="Avg Score"
              value={stats?.averageScore ? `${stats.averageScore}/100` : "N/A"}
              icon={FiAward}
              tone="soft"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <StatCard label="Total" value={stats?.total ?? 0} icon={FiLayers} tone="lavender" />
            <StatCard label="Scheduled" value={stats?.scheduled ?? 0} icon={FiClock} tone="soft" />
            <StatCard label="Live" value={stats?.live ?? 0} icon={FiRadio} tone="soft" />
            <StatCard label="Completed" value={stats?.completed ?? 0} icon={FiCheckCircle} tone="soft" />
            <StatCard label="Reports Ready" value={stats?.reportsReady ?? 0} icon={FiFileText} tone="soft" />
            <StatCard
              label="Avg Score"
              value={stats?.averageScore ? `${stats.averageScore}/100` : "N/A"}
              icon={FiAward}
              tone="soft"
            />
          </div>
        )}

        {/* ── CANDIDATE ACTIVE UPCOMING CALLOUT ──────────────────────────── */}
        {isCandidate && nextUpcoming && (
          <div className="rounded-2xl border border-lav-500/30 bg-gradient-to-r from-lav-600/15 via-lav-500/10 to-transparent p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lav-600 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  <FiRadio className="animate-pulse" /> Upcoming Interview
                </span>
                <h3 className="mt-2 font-display text-xl font-bold text-ink-900">
                  {nextUpcoming.job_description || "Technical Software Interview"}
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  Scheduled for {new Date(nextUpcoming.created_at).toLocaleDateString()} · Join link ready
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to={ROUTES.join(nextUpcoming.join_token)}>
                  <Button icon={FiVideo}>Join Interview Room</Button>
                </Link>
                <Link to={ROUTES.interviewDetail(nextUpcoming.id)}>
                  <Button variant="ghost">View Details</Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── UPCOMING INTERVIEWS (INTERVIEWER VIEW) ────────────────────── */}
        {!isCandidate && upcomingList.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink-900">Upcoming & Live Interviews</h2>
              <span className="rounded-full bg-lav-50 px-2.5 py-0.5 text-xs font-semibold text-lav-700">
                {upcomingList.length} scheduled
              </span>
            </div>
            <div className="space-y-3">
              {upcomingList.slice(0, 3).map((interview) => (
                <div
                  key={interview.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-4 sm:p-5 hover:border-lav-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lav-100 font-bold text-lav-700">
                      {interview.candidate_name?.[0]?.toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink-900 truncate">{interview.candidate_name}</p>
                      <p className="text-xs text-ink-500 truncate">{interview.job_description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={ROUTES.room(interview.join_token)}>
                      <Button size="sm" icon={FiVideo}>
                        {interview.status === "live" ? "Enter Live Room" : "Start Session"}
                      </Button>
                    </Link>
                    <Link to={ROUTES.interviewDetail(interview.id)}>
                      <Button variant="ghost" size="sm">Details</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RECENT / COMPLETED INTERVIEWS ─────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {isCandidate ? "Previous Interviews & Reports" : "Recent Interviews"}
            </h2>
            {interviews.length > 0 && (
              <Link
                to={ROUTES.INTERVIEWS}
                className="flex items-center gap-1 text-sm font-semibold text-lav-600 hover:text-lav-700"
              >
                View all history <FiArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {interviews.length === 0 ? (
            <EmptyState
              icon={FiVideo}
              title="No interviews recorded"
              description={
                isCandidate
                  ? "You haven't participated in any interviews yet. When you receive an invitation, your interview will appear here."
                  : "Schedule your first interview and share the join link with your candidate."
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
              {interviews.slice(0, 6).map((interview) => (
                <InterviewRow key={interview.id} interview={interview} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
