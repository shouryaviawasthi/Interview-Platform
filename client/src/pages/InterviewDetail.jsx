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
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";
import { SERVER_URL } from "../lib/axios";

const InterviewDetail = () => {
  const { onMenuClick } = useOutletContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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
        </div>

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
