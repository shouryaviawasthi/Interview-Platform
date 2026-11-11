import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheck, FiCopy, FiFileText, FiTrash2, FiUpload, FiVideo } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { interviewApi } from "../lib/api";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import { PageSpinner } from "../components/ui/Spinner";
import { formatDateTime } from "../utils/formatters";

const InterviewDetailPage = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    interviewApi
      .getById(session, id)
      .then((res) => setInterview(res.interview))
      .catch((err) => toast.error(err.message || "Couldn't load this interview."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session]);

  const joinLink = interview ? `${window.location.origin}/interview/join/${interview.join_token}` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      toast.error("Couldn't copy — copy the link manually.");
    }
  };

  const handleResumePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await interviewApi.uploadResume(session, id, file);
      toast.success("Resume uploaded.");
      load();
    } catch (err) {
      toast.error(err.message || "Couldn't upload the resume.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete the interview with ${interview.candidate_name}? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await interviewApi.remove(session, id);
      toast.success("Interview deleted.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message || "Couldn't delete this interview.");
      setDeleting(false);
    }
  };

  if (loading) return <PageSpinner label="Loading interview…" />;
  if (!interview) return null;

  const canJoinRoom = interview.status === "scheduled" || interview.status === "live";

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <FiArrowLeft size={14} /> Dashboard
      </Link>

      <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{interview.candidate_name}</h1>
            <p className="mt-1 text-sm text-ink-soft">{interview.candidate_email}</p>
          </div>
          <StatusPill status={interview.status} />
        </div>

        <div className="mt-6 rounded-xl bg-paper p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Job description</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft">{interview.job_description}</p>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ink-faint">Created</dt>
            <dd className="mt-0.5 text-ink">{formatDateTime(interview.created_at)}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Started</dt>
            <dd className="mt-0.5 text-ink">{formatDateTime(interview.started_at)}</dd>
          </div>
        </dl>

        {canJoinRoom && (
          <div className="mt-6 border-t border-line pt-6">
            <p className="text-sm font-medium text-ink">Candidate join link</p>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-sm text-ink-soft">{joinLink}</code>
              <button
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-teal-deep shadow-sm hover:bg-teal-soft"
              >
                {copied ? <FiCheck size={13} /> : <FiCopy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-6">
          <p className="text-sm font-medium text-ink">Resume</p>
          {interview.hasResume ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-teal-deep">
              <FiFileText size={14} /> Uploaded
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-ink-soft">Optional — helps the AI evaluate how well answers align with the candidate's background.</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleResumePick} />
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                <FiUpload size={14} /> Upload PDF resume
              </Button>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-red disabled:opacity-50"
          >
            <FiTrash2 size={14} /> Delete interview
          </button>

          {canJoinRoom && (
            <Button onClick={() => navigate(`/interviews/${id}/room`)}>
              <FiVideo size={16} /> Enter interview room
            </Button>
          )}
          {interview.status === "completed" && <Button onClick={() => navigate(`/interviews/${id}/report`)}>View report</Button>}
        </div>
      </div>
    </div>
  );
};

export default InterviewDetailPage;
