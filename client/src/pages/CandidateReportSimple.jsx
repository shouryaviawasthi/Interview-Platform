import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiDownload, FiLoader, FiAlertTriangle, FiArrowLeft } from "react-icons/fi";
import toast from "react-hot-toast";
import {
  getCandidateReport,
  getInterviewById,
  downloadCandidateReportPdf,
  getTranscript,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const scoreLabel = (s) =>
  s >= 7 ? "High" : s >= 5 ? "Medium" : s >= 3 ? "Low" : "Very Low";

const Section = ({ title, color = "#1e3a5f", children }) => (
  <div style={{ marginBottom: 24 }}>
    <div
      style={{
        backgroundColor: color,
        padding: "6px 12px",
        marginBottom: 8,
      }}
    >
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
 * CandidateReportSimple
 *
 * Standalone page (no sidebar) that shows a simple document-style report
 * for the candidate — matching the user's uploaded image design.
 */
const CandidateReportSimple = () => {
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
          getCandidateReport(id).catch(() => null),
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
      await downloadCandidateReportPdf(id, interview?.candidate_name || "Candidate");
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
        id="candidate-report-doc"
        style={{
          maxWidth: 640, margin: "0 auto", backgroundColor: "white",
          padding: "32px 36px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {/* Header */}
        <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#1e3a5f", marginBottom: 4 }}>
          Interview Analysis Report
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

        {report?.status === "not_started" && (
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
            {/* Candidate Analysis */}
            <Section title="Candidate Analysis" color="#e8f0fe">
              <Row label="Overall Confidence Score" value={`${rj.communication?.score ?? rj.overallScore ?? 0}/10`} />
              <Row label="Overall Clarity Score" value={`${rj.communication?.score ?? 0}/10`} />
              <Row label="Answer Quality Average" value={`${rj.technicalEvaluation?.score ?? 0}/10`} />
              <Row label="Overall Score" value={`${rj.overallScore ?? 0}/100`} />
              <Row label="Recommendation" value={rj.recommendation} />

              {/* Per-question breakdown */}
              {rj.questionAnswerAnalysis?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 13 }}>Per-Question Breakdown:</strong>
                  {rj.questionAnswerAnalysis.slice(0, 8).map((qa, i) => (
                    <div key={i} style={{ marginTop: 8, paddingLeft: 8, borderLeft: "2px solid #2563eb" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: "2px 0" }}>Q: {qa.question}</p>
                      <p style={{ fontSize: 12, color: "#555", margin: "2px 0" }}>
                        Answer Quality: {qa.evaluation?.slice(0, 60) || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {rj.technicalEvaluation?.strengths?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 13 }}>Strengths:</strong>
                  <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                    {rj.technicalEvaluation.strengths.map((s, i) => (
                      <li key={i} style={{ fontSize: 12, color: "#333", marginBottom: 2 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {rj.areasForImprovement?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 13 }}>Areas for Improvement:</strong>
                  <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                    {rj.areasForImprovement.map((a, i) => (
                      <li key={i} style={{ fontSize: 12, color: "#333", marginBottom: 2 }}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {rj.summary && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 13 }}>Summary:</strong>
                  <p style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{rj.summary}</p>
                </div>
              )}
            </Section>

            {/* Score Breakdown */}
            <Section title="Score Breakdown" color="#e8f0fe">
              {[
                { label: "Technical Skills", score: rj.technicalEvaluation?.score },
                { label: "Problem Solving", score: rj.problemSolving?.score },
                { label: "Communication", score: rj.communication?.score },
                { label: "Behavioral Performance", score: rj.behavioralPerformance?.score },
                { label: "Job Fit", score: rj.jobFit?.score },
              ].map(({ label, score }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#333" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{score ?? 0}/100</span>
                </div>
              ))}
            </Section>

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

export default CandidateReportSimple;
