import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { interviewApi } from "../lib/api";
import InterviewRoom from "../components/interview/InterviewRoom";
import { PageSpinner } from "../components/ui/Spinner";

const CandidateRoomPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [interviewId, setInterviewId] = useState(null);
  const [error, setError] = useState(null);

  // The room is keyed by interview id, but the candidate only ever has
  // the join token — resolve the id once up front.
  useEffect(() => {
    interviewApi
      .joinByToken(token)
      .then((res) => {
        if (res.interview.status === "completed") {
          navigate(`/interview/join/${token}/report`, { replace: true });
          return;
        }
        setInterviewId(res.interview.id);
      })
      .catch((err) => setError(err.message || "Couldn't find this interview."));
  }, [token, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-6 text-center text-white">
        <p>{error}</p>
      </div>
    );
  }

  if (!interviewId) return <PageSpinner label="Joining the interview room…" />;

  return (
    <InterviewRoom
      interviewId={interviewId}
      session={{ type: "candidate", joinToken: token }}
      role="candidate"
      onEnded={() => navigate(`/interview/join/${token}/report`, { replace: true })}
    />
  );
};

export default CandidateRoomPage;
