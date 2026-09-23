import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheck, FiCopy, FiUpload } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { interviewApi } from "../lib/api";
import Button from "../components/ui/Button";

const NewInterviewPage = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ candidateName: "", candidateEmail: "", jobDescription: "" });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null); // { interview, joinLink }
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await interviewApi.create(session, form);
      setCreated(res);
    } catch (err) {
      toast.error(err.message || "Couldn't create the interview.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(created.joinLink);
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
      await interviewApi.uploadResume(session, created.interview.id, file);
      setResumeUploaded(true);
      toast.success("Resume uploaded.");
    } catch (err) {
      toast.error(err.message || "Couldn't upload the resume.");
    } finally {
      setUploading(false);
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-soft text-teal-deep">
            <FiCheck size={20} />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold text-ink">Interview created</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Share this link with {created.interview.candidate_name} — it's their one-time way into the interview room.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate text-sm text-ink-soft">{created.joinLink}</code>
            <button
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-teal-deep shadow-sm hover:bg-teal-soft"
            >
              {copied ? <FiCheck size={13} /> : <FiCopy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <p className="text-sm font-medium text-ink">Resume (optional)</p>
            <p className="mt-1 text-xs text-ink-soft">Adding a resume helps the AI evaluate how well answers align with the candidate's background.</p>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleResumePick} />
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              disabled={resumeUploaded}
            >
              <FiUpload size={15} /> {resumeUploaded ? "Resume uploaded" : "Upload PDF resume"}
            </Button>
          </div>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => navigate("/dashboard")} className="flex-1">
              Back to dashboard
            </Button>
            <Button onClick={() => navigate(`/interviews/${created.interview.id}`)} className="flex-1">
              View interview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <FiArrowLeft size={14} /> Dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold text-ink">New interview</h1>
      <p className="mt-1 text-sm text-ink-soft">You'll get a link to send the candidate once this is created.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Candidate name</span>
          <input
            type="text"
            name="candidateName"
            required
            value={form.candidateName}
            onChange={handleChange}
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-teal"
            placeholder="Jane Doe"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Candidate email</span>
          <input
            type="email"
            name="candidateEmail"
            required
            value={form.candidateEmail}
            onChange={handleChange}
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-teal"
            placeholder="jane@example.com"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Job description</span>
          <textarea
            name="jobDescription"
            required
            rows={5}
            value={form.jobDescription}
            onChange={handleChange}
            className="resize-none rounded-lg border border-line px-3 py-2 outline-none focus:border-teal"
            placeholder="Paste the role's responsibilities and requirements — this grounds the AI's evaluation."
          />
        </label>
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Create interview
        </Button>
      </form>
    </div>
  );
};

export default NewInterviewPage;
