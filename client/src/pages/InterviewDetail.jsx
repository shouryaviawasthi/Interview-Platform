import { useEffect, useRef, useState } from "react";
import { useOutletContext, useNavigate, useParams, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiUploadCloud,
  FiFileText,
  FiMail,
  FiBriefcase,
  FiVideo,
  FiSave,
  FiX,
  FiClock,
  FiCalendar,
  FiDownload,
  FiBarChart2,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import TextArea from "../components/ui/TextArea";
import StatusBadge from "../components/ui/StatusBadge";
import Modal from "../components/ui/Modal";
import Loader from "../components/ui/Loader";
import { Spinner } from "../components/ui/Loader";
import {
  getInterviewById,
  updateInterview,
  deleteInterview,
  uploadResume,
  getTranscript,
  getCandidateReport,
  getInterviewerReport,
  generateReports,
  getAnalytics,
  generateAnalytics,
  downloadCandidateReportPdf,
  downloadInterviewerReportPdf,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";
import { SERVER_URL } from "../lib/axios";
import { useAuth } from "../context/AuthContext";

const InterviewDetail = () => {
  const { onMenuClick } = useOutletContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const isCandidate = user?.role === "candidate";

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ candidateName: "", candidateEmail: "", jobDescription: "" });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resume, setResume] = useState(null);
  const [transcriptStatus, setTranscriptStatus] = useState(null);
  const [candidateReportStatus, setCandidateReportStatus] = useState(null);
  const [interviewerReportStatus, setInterviewerReportStatus] = useState(null);
  const [analyticsStatus, setAnalyticsStatus] = useState(null);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [generatingAnalytics, setGeneratingAnalytics] = useState(false);

  const joinLink = interview
    ? `${window.location.origin}${ROUTES.join(interview.join_token)}`
    : "";

  const load = async () => {
    try {
      const data = await getInterviewById(id);
      setInterview(data);
      setForm({
        candidateName: data.candidate_name,
        candidateEmail: data.candidate_email,
        jobDescription: data.job_description,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load interview");
      navigate(ROUTES.INTERVIEWS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load transcript, report, and analytics statuses for completed interviews
  useEffect(() => {
    if (!interview) return;
    if (!['completed', 'live'].includes(interview.status)) return;
    getTranscript(id).then((t) => setTranscriptStatus(t?.status ?? null)).catch(() => {});
    getCandidateReport(id).then((r) => setCandidateReportStatus(r?.status ?? null)).catch(() => {});
    getInterviewerReport(id).then((r) => setInterviewerReportStatus(r?.status ?? null)).catch(() => {});
    getAnalytics(id).then((a) => setAnalyticsStatus(a?.status ?? null)).catch(() => {});
  }, [id, interview]);

  const handleGenerateReports = async () => {
    setGeneratingReports(true);
    try {
      await generateReports(id);
      toast.success('AI report generation started!');
      getCandidateReport(id).then((r) => setCandidateReportStatus(r?.status ?? 'processing')).catch(() => {});
      getInterviewerReport(id).then((r) => setInterviewerReportStatus(r?.status ?? 'processing')).catch(() => {});
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not start generation.');
    } finally {
      setGeneratingReports(false);
    }
  };

  const handleGenerateAnalytics = async () => {
    setGeneratingAnalytics(true);
    try {
      await generateAnalytics(id);
      toast.success('Analytics generation started!');
      setAnalyticsStatus('processing');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not start analytics.');
    } finally {
      setGeneratingAnalytics(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateInterview(id, form);
      setInterview(updated);
      setEditing(false);
      toast.success("Interview updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update interview");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteInterview(id);
      toast.success("Interview deleted");
      navigate(ROUTES.INTERVIEWS);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete interview");
      setDeleting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      toast.success("Join link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadResume(id, file, setUploadProgress);
      setResume(uploaded);
      toast.success("Resume uploaded and parsed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not upload resume");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return <Loader label="Loading interview" />;
  if (!interview) return null;

  return (
    <div>
      <Topbar
        onMenuClick={onMenuClick}
        title={interview.candidate_name}
        subtitle="Interview details"
        actions={<StatusBadge status={interview.status} pulse />}
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <Link
          to={ROUTES.INTERVIEWS}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to interviews
        </Link>

        {/* Join link + join room */}
        <div className="card-surface mb-5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Candidate join link</p>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <span className="flex-1 truncate rounded-xl border border-ink-100 bg-lav-50 px-3.5 py-2.5 font-mono text-xs text-ink-600">
              {joinLink}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" icon={FiCopy} onClick={copyLink}>
                Copy
              </Button>
              <Button
                icon={FiVideo}
                onClick={() => navigate(ROUTES.room(interview.join_token))}
              >
                Enter room
              </Button>
            </div>
          </div>
          {/* Transcript quick-link */}
          {(transcriptStatus || interview.status === 'completed') && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-ink-100 bg-lav-50/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-ink-600">
                <FiFileText className="h-4 w-4 text-lav-500" />
                <span>
                  Transcript
                  {transcriptStatus === 'completed' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Ready</span>}
                  {transcriptStatus === 'processing' && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Processing</span>}
                  {transcriptStatus === 'failed' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">Failed</span>}
                  {transcriptStatus === 'uploaded' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Uploaded</span>}
                  {!transcriptStatus && <span className="ml-2 text-ink-400">Not started</span>}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(ROUTES.transcript(id))}
              >
                View Transcript
              </Button>
            </div>
          )}
        </div>

        {/* Pipeline Processing Tracker — completed interviews */}
        {interview.status === 'completed' && (
          <div className="card-surface mb-5 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Processing Pipeline
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="font-semibold text-ink-800">1. Audio</p>
                  <p className="text-[10px] text-ink-400">Recorded</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5">
                <span className={`h-2 w-2 rounded-full ${
                  transcriptStatus === 'completed' ? 'bg-emerald-500' :
                  transcriptStatus === 'processing' ? 'bg-blue-500 animate-pulse' :
                  transcriptStatus === 'failed' ? 'bg-red-500' : 'bg-ink-300'
                }`} />
                <div>
                  <p className="font-semibold text-ink-800">2. Transcript</p>
                  <p className="text-[10px] text-ink-400 capitalize">{transcriptStatus || 'Waiting'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5">
                <span className={`h-2 w-2 rounded-full ${
                  analyticsStatus === 'completed' ? 'bg-emerald-500' :
                  analyticsStatus === 'processing' ? 'bg-blue-500 animate-pulse' :
                  analyticsStatus === 'failed' ? 'bg-red-500' : 'bg-ink-300'
                }`} />
                <div>
                  <p className="font-semibold text-ink-800">3. Analytics</p>
                  <p className="text-[10px] text-ink-400 capitalize">{analyticsStatus || 'Waiting'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5">
                <span className={`h-2 w-2 rounded-full ${
                  candidateReportStatus === 'completed' ? 'bg-emerald-500' :
                  candidateReportStatus === 'processing' ? 'bg-blue-500 animate-pulse' :
                  candidateReportStatus === 'failed' ? 'bg-red-500' : 'bg-ink-300'
                }`} />
                <div>
                  <p className="font-semibold text-ink-800">4. AI Reports</p>
                  <p className="text-[10px] text-ink-400 capitalize">{candidateReportStatus || 'Waiting'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5">
                <span className={`h-2 w-2 rounded-full ${
                  candidateReportStatus === 'completed' ? 'bg-emerald-500' : 'bg-ink-300'
                }`} />
                <div>
                  <p className="font-semibold text-ink-800">5. PDF Ready</p>
                  <p className="text-[10px] text-ink-400">{candidateReportStatus === 'completed' ? 'Available' : 'Waiting'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Reports — completed interviews only */}
        {interview.status === 'completed' && (
          <div className="card-surface mb-5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">AI Reports</p>
              {!isCandidate && transcriptStatus === 'completed' && (
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={generatingReports}
                  onClick={handleGenerateReports}
                >
                  Generate Reports
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {/* Candidate Report */}
              <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-lav-50/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-ink-600">
                  <FiFileText className="h-4 w-4 text-lav-500" />
                  <span>Candidate Report
                    {candidateReportStatus === 'completed' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Ready</span>}
                    {candidateReportStatus === 'processing' && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Processing</span>}
                    {candidateReportStatus === 'failed' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">Failed</span>}
                    {!candidateReportStatus && <span className="ml-2 text-ink-400">Not started</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {candidateReportStatus === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={FiDownload}
                      onClick={() => downloadCandidateReportPdf(id, interview?.candidate_name)}
                    >
                      PDF
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.candidateReport(id))}>
                    View
                  </Button>
                </div>
              </div>
              {/* Interviewer Report */}
              {!isCandidate && (
                <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-lav-50/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-ink-600">
                    <FiFileText className="h-4 w-4 text-lav-500" />
                    <span>Interviewer Report
                      {interviewerReportStatus === 'completed' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Ready</span>}
                      {interviewerReportStatus === 'processing' && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Processing</span>}
                      {interviewerReportStatus === 'failed' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">Failed</span>}
                      {!interviewerReportStatus && <span className="ml-2 text-ink-400">Not started</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {interviewerReportStatus === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={FiDownload}
                        onClick={() => downloadInterviewerReportPdf(id, "Interviewer")}
                      >
                        PDF
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.interviewerReport(id))}>
                      View
                    </Button>
                  </div>
                </div>
              )}
              {/* Interview Analytics */}
              <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-lav-50/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-ink-600">
                  <FiBarChart2 className="h-4 w-4 text-lav-500" />
                  <span>Advanced Analytics
                    {analyticsStatus === 'completed' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Ready</span>}
                    {analyticsStatus === 'processing' && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Processing</span>}
                    {analyticsStatus === 'failed' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">Failed</span>}
                    {!analyticsStatus && <span className="ml-2 text-ink-400">Not started</span>}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.analytics(id))}>
                  View
                </Button>
              </div>
              {transcriptStatus !== 'completed' && (
                <p className="text-xs text-ink-400 mt-1">Complete transcript assignment before generating reports and analytics.</p>
              )}
            </div>
          </div>
        )}

        {/* Session timing info (live / completed) */}
        {(interview.started_at || interview.ended_at) && (
          <div className="card-surface mb-5 p-6">
            <h3 className="mb-4 font-display text-base font-semibold text-ink-900">Session Info</h3>
            <dl className="space-y-4">
              {interview.started_at && (
                <div className="flex items-start gap-3">
                  <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                  <div>
                    <dt className="text-xs font-medium text-ink-400">Started at</dt>
                    <dd className="text-sm text-ink-800">
                      {new Date(interview.started_at).toLocaleString()}
                    </dd>
                  </div>
                </div>
              )}
              {interview.ended_at && (
                <div className="flex items-start gap-3">
                  <FiCalendar className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                  <div>
                    <dt className="text-xs font-medium text-ink-400">Ended at</dt>
                    <dd className="text-sm text-ink-800">
                      {new Date(interview.ended_at).toLocaleString()}
                    </dd>
                  </div>
                </div>
              )}
              {interview.started_at && interview.ended_at && (() => {
                const secs = Math.round(
                  (new Date(interview.ended_at) - new Date(interview.started_at)) / 1000
                );
                const h = Math.floor(secs / 3600);
                const m = Math.floor((secs % 3600) / 60);
                const s = secs % 60;
                const parts = [];
                if (h) parts.push(`${h}h`);
                if (m) parts.push(`${m}m`);
                if (s || !parts.length) parts.push(`${s}s`);
                return (
                  <div className="flex items-start gap-3">
                    <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-lav-500" />
                    <div>
                      <dt className="text-xs font-medium text-ink-400">Duration</dt>
                      <dd className="text-sm font-semibold text-ink-800">{parts.join(" ")}</dd>
                    </div>
                  </div>
                );
              })()}
            </dl>
          </div>
        )}

        {/* Details / edit form */}
        <div className="card-surface mb-5 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-ink-900">Candidate details</h3>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-lav-600 hover:text-lav-700"
              >
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditing(false);
                  setForm({
                    candidateName: interview.candidate_name,
                    candidateEmail: interview.candidate_email,
                    jobDescription: interview.job_description,
                  });
                }}
                className="flex items-center gap-1.5 text-sm font-medium text-ink-400 hover:text-ink-700"
              >
                <FiX className="h-3.5 w-3.5" />
                Cancel
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Candidate name"
                name="candidateName"
                icon={FiEdit2}
                value={form.candidateName}
                onChange={handleChange}
              />
              <Input
                label="Candidate email"
                name="candidateEmail"
                type="email"
                icon={FiMail}
                value={form.candidateEmail}
                onChange={handleChange}
              />
              <TextArea
                label="Job description / role"
                name="jobDescription"
                rows={4}
                icon={FiBriefcase}
                value={form.jobDescription}
                onChange={handleChange}
              />
              <Button type="submit" icon={FiSave} isLoading={saving}>
                Save changes
              </Button>
            </form>
          ) : (
            <dl className="space-y-4">
              <div className="flex items-start gap-3">
                <FiMail className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <div>
                  <dt className="text-xs font-medium text-ink-400">Email</dt>
                  <dd className="text-sm text-ink-800">{interview.candidate_email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiBriefcase className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <div>
                  <dt className="text-xs font-medium text-ink-400">Role / job description</dt>
                  <dd className="text-sm leading-relaxed text-ink-800">{interview.job_description}</dd>
                </div>
              </div>
            </dl>
          )}
        </div>

        {/* Resume upload */}
        <div className="card-surface mb-5 p-6">
          <h3 className="mb-4 font-display text-base font-semibold text-ink-900">Resume</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          {resume ? (
            <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-lav-50 p-4">
              <FiFileText className="mt-0.5 h-5 w-5 shrink-0 text-lav-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-800">Resume parsed successfully</p>
                <p className="mt-1 line-clamp-3 text-xs text-ink-400">{resume.resume_text}</p>
                <a
                  href={`${SERVER_URL}/${resume.resume_file_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-lav-600 hover:text-lav-700"
                >
                  View original PDF
                </a>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-lav-200 bg-lav-50/60 px-6 py-10 text-center transition-colors hover:border-lav-400 disabled:opacity-70"
            >
              {uploading ? (
                <>
                  <Spinner className="h-6 w-6" />
                  <p className="text-sm font-medium text-ink-600">Uploading &amp; parsing&hellip; {uploadProgress}%</p>
                </>
              ) : (
                <>
                  <FiUploadCloud className="h-6 w-6 text-lav-500" />
                  <p className="text-sm font-medium text-ink-700">Click to upload a resume PDF</p>
                  <p className="text-xs text-ink-400">The text is extracted automatically after upload</p>
                </>
              )}
            </button>
          )}
        </div>

        {/* Danger zone */}
        <div className="card-surface p-6">
          <h3 className="mb-1 font-display text-base font-semibold text-ink-900">Danger zone</h3>
          <p className="mb-4 text-sm text-ink-400">
            Deleting an interview removes it and its join link permanently.
          </p>
          <Button variant="danger" icon={FiTrash2} onClick={() => setDeleteOpen(true)}>
            Delete interview
          </Button>
        </div>
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete interview"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={deleting} onClick={handleDelete}>
              Delete permanently
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          Are you sure you want to delete the interview with{" "}
          <span className="font-semibold text-ink-900">{interview.candidate_name}</span>? This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default InterviewDetail;
