import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiMic, FiVideo } from "react-icons/fi";
import { interviewApi } from "../lib/api";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import { PageSpinner } from "../components/ui/Spinner";

const CandidateJoinPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, interview: null, error: null });

  useEffect(() => {
    interviewApi
      .joinByToken(token)
      .then((res) => setState({ loading: false, interview: res.interview, error: null }))
      .catch((err) => setState({ loading: false, interview: null, error: err }));
  }, [token]);

  if (state.loading) return <PageSpinner label="Finding your interview…" />;

  if (state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">{state.error.message}</h1>
          <p className="mt-2 text-sm text-ink-soft">Double check the link your interviewer sent you.</p>
        </div>
      </div>
    );
  }

  const { interview } = state;

  if (interview.status === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">This interview has already ended</h1>
          <p className="mt-2 text-sm text-ink-soft">Your feedback report is ready to view.</p>
          <Button className="mt-5" onClick={() => navigate(`/interview/join/${token}/report`)}>
            View my report
          </Button>
        </div>
      </div>
    );
  }

  if (interview.status === "cancelled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-sm rounded-2xl border border-line bg-white p-8 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">This interview was cancelled</h1>
          <p className="mt-2 text-sm text-ink-soft">Reach out to your interviewer if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal text-white">
          <FiVideo size={20} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Hi {interview.candidate_name.split(" ")[0]},</h1>
        <p className="mt-1 text-sm text-ink-soft">you're about to join your interview for:</p>
        <p className="mt-3 rounded-lg bg-paper px-4 py-3 text-sm text-ink">{interview.job_description}</p>

        <div className="mt-4 flex justify-center">
          <StatusPill status={interview.status} />
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-amber-soft px-3.5 py-3 text-left text-xs text-amber">
          <FiMic size={14} className="mt-0.5 shrink-0" />
          <span>Your browser will ask for microphone access — this is used to live-transcribe the conversation for feedback afterward.</span>
        </div>

        <Button className="mt-6 w-full" size="lg" onClick={() => navigate(`/interview/join/${token}/room`)}>
          Join interview
        </Button>
      </div>
    </div>
  );
};

export default CandidateJoinPage;
