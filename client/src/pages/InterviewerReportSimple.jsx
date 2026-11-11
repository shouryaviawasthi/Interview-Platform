import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiDownload, FiLoader, FiAlertTriangle, FiArrowLeft } from "react-icons/fi";
import toast from "react-hot-toast";
import {
  getInterviewerReport,
  getInterviewById,
  downloadInterviewerReportPdf,
  getTranscript,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const Section = ({ title, color = "#e8f0fe", children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ backgroundColor: color, padding: "6px 12px", marginBottom: 8 }}>
      <strong style={{ color: "#2563eb", fontSize: 14 }}>{title}</strong>
    </div>
    <div style={{ padding: "0 4px" }}>{children}</div>
  </div>
);

const Row = ({ label, value }) => (
  <p style={{ fontSize: 13, margin: "4px 0", color: "#222" }}>
    <strong>{label}:</strong> {value ?? "—"}
  </p>
);

/**
 * InterviewerReportSimple
 *
 * Standalone page (no sidebar) that shows a simple document-style report
 * for the interviewer — matching the user's uploaded image design.
 */
const InterviewerReportSimple = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [report, setReport] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [iv, rep, tr] = await Promise.all([
          getInterviewById(id).catch(() => null),
          getInterviewerReport(id).catch(() => null),
          getTranscript(id).catch(() => ({ segments: [] })),
        ]);
        setInterview(iv);
        setReport(rep);
        setTranscript(tr?.segments || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInterviewerReportPdf(id, "Interviewer");
      toast.success("PDF downloaded!");
    } catch {
      toast.error("PDF not ready yet.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <FiLoader style={{ animation: "spin 1s linear infinite", fontSize: 32 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#dc2626" }}>
        <FiAlertTriangle size={36} />
        <p style={{ marginTop: 12 }}>Failed to load report: {error}</p>
      </div>
    );
  }

  const rj = report?.reportJson ?? null;
  const date = interview?.ended_at || interview?.created_at;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f5f5f5", minHeight: "100vh", padding: "24px 16px" }}>
      {/* Top bar */}
      <div style={{ maxWidth: 640, margin: "0 auto 16px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => navigate(ROUTES.interviewEndDashboard(id))}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#374151", fontSize: 13 }}
        >
          <FiArrowLeft /> Back
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading || report?.status !== "completed"}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            backgroundColor: report?.status === "completed" ? "#2563eb" : "#9ca3af",
            color: "white", border: "none", borderRadius: 6, cursor: report?.status === "completed" ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 600,
          }}
        >
          {downloading ? <FiLoader style={{ animation: "spin 1s linear infinite" }} /> : <FiDownload />}
          Download PDF
        </button>
      </div>

      {/* Report Document */}
      <div
        style={{
          maxWidth: 640, margin: "0 auto", backgroundColor: "white",
          padding: "32px 36px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {/* Header */}
        <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#1e3a5f", marginBottom: 4 }}>
          Interviewer Conduct Report
        </h1>
        <p style={{ fontSize: 13, color: "#444", margin: "2px 0" }}>Job Role: {interview?.job_description?.split("\n")[0]?.slice(0, 60) || "—"}</p>
        <p style={{ fontSize: 13, color: "#444", margin: "2px 0" }}>Candidate: {interview?.candidate_name || "—"}</p>
        <p style={{ fontSize: 13, color: "#444", margin: "2px 0" }}>Date: {date ? fmt(date) : "—"}</p>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #ddd" }} />

        {report?.status === "processing" && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
            <FiLoader size={28} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 12 }}>AI is generating your report…</p>
          </div>
        )}

        {(report?.status === "not_started" || !report) && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
            <p>Report has not been generated yet.</p>
          </div>
        )}

        {report?.status === "failed" && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#dc2626" }}>
            <FiAlertTriangle size={28} />
            <p style={{ marginTop: 12 }}>Report generation failed. Please retry from the interview details page.</p>
          </div>
        )}

        {report?.status === "completed" && rj && (
          <>
            {/* Interviewer Conduct Analysis */}
            <Section title="Interviewer Conduct Analysis" color="#e8f0fe">
              <Row label="Overall Conduct Score" value={`${rj.overallScore ?? 0}/10`} />
              <Row label="Question Quality" value={`${rj.questionQuality?.score ?? 0}/100`} />
              <Row label="Interview Structure" value={`${rj.interviewStructure?.score ?? 0}/100`} />
              <Row label="Candidate Engagement" value={`${rj.candidateEngagement?.score ?? 0}/100`} />
              <Row label="Follow-up Quality" value={`${rj.followUpQuality?.score ?? 0}/100`} />
              <Row label="Communication" value={`${rj.communication?.score ?? 0}/100`} />
              {rj.speakingBalance && (
                <Row
                  label="Speaking Balance"
                  value={`Interviewer ${rj.speakingBalance.interviewerPercentage ?? 0}% / Candidate ${rj.speakingBalance.candidatePercentage ?? 0}%`}
                />
              )}
            </Section>

            {/* Summary */}
            {rj.summary && (
              <Section title="Summary" color="#e8f0fe">
                <p style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{rj.summary}</p>
              </Section>
            )}

            {/* Strengths */}
            {rj.questionQuality?.strengths?.length > 0 && (
              <Section title="Strengths" color="#e8f0fe">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {rj.questionQuality.strengths.map((s, i) => (
                    <li key={i} style={{ fontSize: 12, color: "#333", marginBottom: 3 }}>{s}</li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Areas for Improvement */}
            {rj.areasForImprovement?.length > 0 && (
              <Section title="Areas for Improvement" color="#e8f0fe">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {rj.areasForImprovement.map((a, i) => (
                    <li key={i} style={{ fontSize: 12, color: "#333", marginBottom: 3 }}>• {a}</li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Strong Questions */}
            {rj.strongQuestions?.length > 0 && (
              <Section title="Strong Questions Asked" color="#e8f0fe">
                {rj.strongQuestions.map((q, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#444", margin: "4px 0" }}>• {q}</p>
                ))}
              </Section>
            )}

            {/* Weak Questions */}
            {rj.weakQuestions?.length > 0 && (
              <Section title="Questions to Improve" color="#e8f0fe">
                {rj.weakQuestions.map((q, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#444", margin: "4px 0" }}>• {q}</p>
                ))}
              </Section>
            )}

            {/* Final Assessment */}
            {rj.finalAssessment && (
              <Section title="Final Assessment" color="#e8f0fe">
                <p style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{rj.finalAssessment}</p>
              </Section>
            )}

            {/* Full Transcript */}
            {transcript.length > 0 && (
              <Section title="Full Transcript" color="#e8f0fe">
                {transcript.map((seg, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#444", margin: "3px 0" }}>
                    <strong style={{ textTransform: "uppercase" }}>{seg.speaker_type || seg.speaker || "SPEAKER"}:</strong>{" "}
                    {seg.text}
                  </p>
                ))}
              </Section>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default InterviewerReportSimple;
