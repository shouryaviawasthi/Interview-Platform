import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import InterviewRoom from "../components/interview/InterviewRoom";

const InterviewRoomPage = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  if (!session) return null; // AuthProvider is still resolving the stored token

  return (
    <InterviewRoom
      interviewId={id}
      session={session}
      role="interviewer"
      onEnded={() => navigate(`/interviews/${id}/report`, { replace: true })}
    />
  );
};

export default InterviewRoomPage;
