import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiBriefcase, FiClock, FiVideo, FiAlertTriangle } from "react-icons/fi";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import StatusBadge from "../components/ui/StatusBadge";
import Loader from "../components/ui/Loader";
import { joinInterviewByToken } from "../services/interview.service";
import { ROUTES } from "../constants/routes";
import { acquireLocalMedia, savePreparedMedia } from "../lib/localMedia";

const JoinInterview = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const tokenLooksTruncated = token?.length !== 36;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await joinInterviewByToken(token);
        if (cancelled) return;
        setInterview(data);
        setName(data.candidate_name || "");
      } catch (error) {
        if (cancelled) return;
        if (error.response?.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(
            error.response?.data?.message ||
            "Couldn't connect to the interview service. Check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name to continue");
      return;
    }
    setJoining(true);
    setMediaError(null);
    try {
      const { stream, warning } = await acquireLocalMedia();
      savePreparedMedia(token, stream, warning);
      sessionStorage.setItem(`aip_candidate_name_${token}`, name.trim());
      navigate(ROUTES.room(token));
    } catch (error) {
      setMediaError(error.message || "Please allow camera and microphone access to join.");
      setJoining(false);
    }
  };

  if (loading) return <Loader label="Looking up your interview" />;

  if (notFound || loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-lav-50 px-6 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-status-cancelled-bg)] text-[color:var(--color-status-cancelled)]">
          <FiAlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="font-display text-xl font-semibold text-ink-900">
          {notFound ? "Link not found" : "Unable to open interview"}
        </h1>
        <p className="mt-1.5 max-w-sm text-sm text-ink-400">
          {notFound
            ? tokenLooksTruncated
              ? "This link appears incomplete. Ask the interviewer to open the interview details, create a new link, and send the complete URL."
              : "This interview link is invalid or the interview no longer exists. Ask the interviewer to create and share a new link."
            : loadError}
        </p>
        <Link to={ROUTES.HOME} className="mt-6">
          <Button variant="secondary">Go to homepage</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-lav-50 px-6 py-12">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 10%, rgba(163,140,242,0.22) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(110,89,232,0.18) 0%, transparent 45%)",
        }}
      />
      <div className="card-surface relative w-full max-w-md animate-rise-in p-7 sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-600 text-white">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="13" r="5.5" fill="currentColor" />
              <path d="M6 27c0-6 4.5-9.5 10-9.5S26 21 26 27" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-base font-semibold text-ink-900">Amble</span>
        </div>

        <StatusBadge status={interview.status} pulse />
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink-900">
          You're invited to an interview
        </h1>

        <div className="mt-5 space-y-3 rounded-xl border border-ink-100 bg-lav-50 p-4">
          <div className="flex items-start gap-2.5 text-sm">
            <FiBriefcase className="mt-0.5 h-4 w-4 shrink-0 text-lav-600" />
            <span className="text-ink-700">{interview.job_description}</span>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-lav-600" />
            <span className="text-ink-700 capitalize">Interview is {interview.status}</span>
          </div>
        </div>

        <form onSubmit={handleJoin} className="mt-6 space-y-4">
          <Input
            label="Confirm your name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
          />
          <Button type="submit" icon={FiVideo} isLoading={joining} className="w-full">
            {joining ? "Checking camera and microphone…" : "Allow camera & mic and join"}
          </Button>
        </form>
        {mediaError && (
          <p role="alert" className="mt-3 text-center text-sm text-red-600">{mediaError}</p>
        )}
        {joining && (
          <p className="mt-3 text-center text-xs text-ink-500">
            Allow both camera and microphone when your browser asks. Your preview starts after you join.
          </p>
        )}
        <p className="mt-4 text-center text-xs text-ink-400">
          Camera and microphone access is needed for the live interview. Mobile browsers require HTTPS.
        </p>
      </div>
    </div>
  );
};

export default JoinInterview;
