import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { FiLayers, FiClock, FiRadio, FiCheckCircle, FiPlus, FiVideo } from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import StatCard from "../components/ui/StatCard";
import InterviewRow from "../components/interview/InterviewRow";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import { getDashboard, getAllInterviews } from "../services/interview.service";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { onMenuClick } = useOutletContext();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsData, list] = await Promise.all([getDashboard(), getAllInterviews()]);
        setStats(statsData);
        setInterviews(list);
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

  return (
    <div>
      <Topbar
        onMenuClick={onMenuClick}
        title={`Welcome back${firstName ? `, ${firstName}` : ""}`}
        subtitle="Here's what's happening across your interviews"
        actions={
          <Link to={ROUTES.INTERVIEW_NEW}>
            <Button icon={FiPlus}>Schedule interview</Button>
          </Link>
        }
      />

      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total" value={stats?.total ?? 0} icon={FiLayers} tone="lavender" />
          <StatCard label="Scheduled" value={stats?.scheduled ?? 0} icon={FiClock} tone="soft" />
          <StatCard label="Live" value={stats?.live ?? 0} icon={FiRadio} tone="soft" />
          <StatCard label="Completed" value={stats?.completed ?? 0} icon={FiCheckCircle} tone="soft" />
          <StatCard label="Cancelled" value={stats?.cancelled ?? 0} icon={FiLayers} tone="soft" />
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-900">Recent interviews</h2>
            {interviews.length > 0 && (
              <Link
                to={ROUTES.INTERVIEWS}
                className="text-sm font-medium text-lav-600 hover:text-lav-700"
              >
                View all
              </Link>
            )}
          </div>

          {interviews.length === 0 ? (
            <EmptyState
              icon={FiVideo}
              title="No interviews yet"
              description="Schedule your first interview and share the join link with your candidate."
              action={
                <Link to={ROUTES.INTERVIEW_NEW}>
                  <Button icon={FiPlus}>Schedule interview</Button>
                </Link>
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
