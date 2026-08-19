import { useState } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { FiUser, FiMail, FiBriefcase, FiArrowLeft, FiCheck, FiCopy } from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import Input from "../components/ui/Input";
import TextArea from "../components/ui/TextArea";
import Button from "../components/ui/Button";
import { createInterview } from "../services/interview.service";
import { ROUTES } from "../constants/routes";

const InterviewNew = () => {
  const { onMenuClick } = useOutletContext();
  const navigate = useNavigate();
  const [form, setForm] = useState({ candidateName: "", candidateEmail: "", jobDescription: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { interview, joinLink }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const next = {};
    if (!form.candidateName) next.candidateName = "Candidate name is required";
    if (!form.candidateEmail) next.candidateEmail = "Candidate email is required";
    if (!form.jobDescription) next.jobDescription = "Job description is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = await createInterview(form);
      setResult(data);
      toast.success("Interview scheduled");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Could not create interview");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.joinLink);
      toast.success("Join link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div>
      <Topbar onMenuClick={onMenuClick} title="Schedule interview" subtitle="Set up a new candidate interview" />

      <div className="mx-auto max-w-xl px-4 py-6 sm:px-8 sm:py-8">
        <Link
          to={ROUTES.INTERVIEWS}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to interviews
        </Link>

        {!result ? (
          <form onSubmit={handleSubmit} className="card-surface space-y-5 p-6" noValidate>
            <Input
              label="Candidate name"
              name="candidateName"
              icon={FiUser}
              placeholder="Rahul Sharma"
              value={form.candidateName}
              onChange={handleChange}
              error={errors.candidateName}
            />
            <Input
              label="Candidate email"
              name="candidateEmail"
              type="email"
              icon={FiMail}
              placeholder="rahul@example.com"
              value={form.candidateEmail}
              onChange={handleChange}
              error={errors.candidateEmail}
            />
            <TextArea
              label="Job description / role"
              name="jobDescription"
              rows={4}
              icon={FiBriefcase}
              placeholder="e.g. Node.js Developer — 3+ years, REST APIs, PostgreSQL"
              value={form.jobDescription}
              onChange={handleChange}
              error={errors.jobDescription}
            />
            <Button type="submit" className="w-full" isLoading={submitting}>
              Schedule interview
            </Button>
          </form>
        ) : (
          <div className="card-surface animate-rise-in space-y-5 p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-status-live-bg)] text-[color:var(--color-status-live)]">
              <FiCheck className="h-6 w-6" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-900">
                Interview scheduled for {result.interview.candidate_name}
              </h3>
              <p className="mt-1 text-sm text-ink-400">
                Share this link with the candidate so they can join at the right time.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-lav-50 px-3.5 py-2.5">
              <span className="flex-1 truncate text-left font-mono text-xs text-ink-600">
                {result.joinLink}
              </span>
              <button
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-lav-700 border border-ink-100 hover:border-lav-300"
              >
                <FiCopy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setResult(null)}
              >
                Schedule another
              </Button>
              <Button
                className="w-full"
                onClick={() => navigate(ROUTES.interviewDetail(result.interview.id))}
              >
                View interview
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewNew;
