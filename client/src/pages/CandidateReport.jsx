import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import {
  FiArrowLeft, FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiLoader, FiClock, FiUser, FiZap, FiBriefcase, FiBarChart2,
  FiMessageSquare, FiAward, FiChevronDown, FiChevronUp, FiDownload,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import {
  getCandidateReport,
  generateReports,
  retryReports,
  getInterviewById,
  downloadCandidateReportPdf,
  getTranscript,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (s) => {
  if (s == null) return null;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const STATUS_UI = {
  not_started: { icon: FiClock,       text: "Not started",           color: "text-ink-400" },
  processing:  { icon: FiLoader,      text: "Generating report…",    color: "text-blue-400", spin: true },
  completed:   { icon: FiCheckCircle, text: "Report ready",          color: "text-emerald-400" },
  failed:      { icon: FiAlertTriangle, text: "Generation failed",   color: "text-red-400" },
};

const REC_LABEL = {
  "Strong Candidate":       { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  "Good Candidate":         { bg: "bg-blue-500/15",    text: "text-blue-300",    border: "border-blue-500/30" },
  "Average Candidate":      { bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/30" },
  "Below Average Candidate":{ bg: "bg-orange-500/15",  text: "text-orange-300",  border: "border-orange-500/30" },
  "Not Recommended":        { bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/30" },
};

// ── Score Ring ────────────────────────────────────────────────────────────────

const ScoreRing = ({ score, size = 100, strokeWidth = 8 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * circ;
  const color = pct >= 75 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        className="rotate-90 origin-center" fill="white"
        style={{ fontSize: size * 0.2, fontWeight: 700, transform: "rotate(90deg)", transformOrigin: "50% 50%" }}>
        {pct}
      </text>
    </svg>
  );
};

// ── Score Bar ─────────────────────────────────────────────────────────────────

const ScoreBar = ({ label, score, icon: Icon }) => {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const barColor = pct >= 75 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-white/70">
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </span>
        <span className="text-sm font-bold text-white">{pct}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Evidence Accordion ────────────────────────────────────────────────────────

const EvidenceList = ({ evidence }) => {
  const [open, setOpen] = useState(false);
  if (!evidence || evidence.length === 0) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs font-medium text-lav-400 hover:text-lav-300">
        {open ? <FiChevronUp className="h-3 w-3" /> : <FiChevronDown className="h-3 w-3" />}
        {open ? "Hide" : "Show"} evidence ({evidence.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {evidence.map((ev, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="text-xs text-white/70">{ev.claim}</p>
              {(ev.startTime != null || ev.quote) && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {ev.startTime != null && (
                    <span className="rounded-md bg-lav-500/10 px-2 py-0.5 font-mono text-[10px] text-lav-300">
                      {formatTime(ev.startTime)}{ev.endTime != null ? ` → ${formatTime(ev.endTime)}` : ""}
                    </span>
                  )}
                  {ev.quote && (
                    <span className="italic text-[11px] text-white/40">"{ev.quote.slice(0, 120)}{ev.quote.length > 120 ? "…" : ""}"</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Dimension Card ────────────────────────────────────────────────────────────

const DimensionCard = ({ title, score, strengths, weaknesses, evidence, icon: Icon }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-white">
        {Icon && <Icon className="h-4 w-4 text-lav-400" />} {title}
      </h3>
      <span className={`text-2xl font-bold ${score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"}`}>
        {score ?? 0}
      </span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06] mb-4">
      <div className={`h-full rounded-full transition-all duration-700 ${score >= 75 ? "bg-emerald-400" : score >= 50 ? "bg-amber-400" : "bg-red-400"}`}
        style={{ width: `${score ?? 0}%` }} />
    </div>
    {strengths?.length > 0 && (
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Strengths</p>
        <ul className="space-y-1">
          {strengths.map((s, i) => <li key={i} className="flex items-start gap-1.5 text-xs text-white/70"><span className="mt-0.5 text-emerald-400">✓</span>{s}</li>)}
        </ul>
      </div>
    )}
    {weaknesses?.length > 0 && (
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400/70">Weaknesses</p>
        <ul className="space-y-1">
          {weaknesses.map((w, i) => <li key={i} className="flex items-start gap-1.5 text-xs text-white/70"><span className="mt-0.5 text-red-400">✗</span>{w}</li>)}
        </ul>
      </div>
    )}
    <EvidenceList evidence={evidence} />
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const CandidateReport = () => {
  const { id } = useParams();
  const { onMenuClick } = useOutletContext();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [report, setReport] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([
        getCandidateReport(id).catch(() => null),
        getTranscript(id).catch(() => null),
      ]);
      setReport(r);
      setTranscript(t);
      return r;
    } catch (e) {
      return null;
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      try {
        const [iData] = await Promise.all([getInterviewById(id)]);
        setInterview(iData);
      } catch { navigate(ROUTES.INTERVIEWS); return; }
      await loadReport();
      setLoading(false);
    };
    init();
  }, [id, navigate, loadReport]);

  // Poll while processing
  useEffect(() => {
    if (report?.status !== "processing") return;
    const iv = setInterval(async () => {
      const r = await loadReport();
      if (r?.status !== "processing") clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [report?.status, loadReport]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReports(id);
      toast.success("Report generation started…");
      await loadReport();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to start generation.");
    } finally { setGenerating(false); }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryReports(id);
      toast.success("Retry started.");
      await loadReport();
    } catch (e) {
      toast.error(e.response?.data?.message || "Retry failed.");
    } finally { setRetrying(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadCandidateReportPdf(id, interview?.candidate_name || "Candidate");
      toast.success("PDF downloaded successfully!");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) return <Loader label="Loading report" />;
  if (!interview) return null;

  const status = report?.status ?? "not_started";
  const statusUi = STATUS_UI[status] || STATUS_UI.not_started;
  const StatusIcon = statusUi.icon;
  const rpt = report?.reportJson ?? null;
  const recStyle = REC_LABEL[rpt?.recommendation] ?? REC_LABEL["Average Candidate"];

  return (
    <div>
      <Topbar onMenuClick={onMenuClick} title="Candidate Report" subtitle={interview.candidate_name} />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={ROUTES.interviewDetail(id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
            <FiArrowLeft className="h-4 w-4" /> Back to interview
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.interviewerReport(id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-colors"
            >
              <FiUser className="h-3.5 w-3.5 text-sky-400" /> Interviewer Report
            </Link>
            <Link
              to={ROUTES.analytics(id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-colors"
            >
              <FiBarChart2 className="h-3.5 w-3.5 text-lav-400" /> Advanced Analytics
            </Link>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="card-surface mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <StatusIcon className={`h-4 w-4 ${statusUi.color} ${statusUi.spin ? "animate-spin" : ""}`} />
              <span className={`text-sm font-medium ${statusUi.color}`}>{statusUi.text}</span>
            </div>
            <div className="flex items-center gap-2">
              {status === "completed" && (
                <Button variant="secondary" icon={FiDownload} isLoading={downloadingPdf} onClick={handleDownloadPdf}>
                  Download PDF
                </Button>
              )}
              {(status === "not_started" || status === "failed") && (
                <Button icon={FiZap} isLoading={generating} onClick={handleGenerate}>
                  {status === "not_started" ? "Generate Report" : "Regenerate"}
                </Button>
              )}
              {status === "failed" && (
                <Button variant="secondary" icon={FiRefreshCw} isLoading={retrying} onClick={handleRetry}>
                  Retry
                </Button>
              )}
            </div>
          </div>
          {status === "failed" && report?.errorMessage && (
            <p className="mt-2 text-xs text-red-400/80">{report.errorMessage}</p>
          )}
          {status === "not_started" && interview.status !== "completed" && (
            <p className="mt-2 text-xs text-amber-400/80">Reports can only be generated after the interview is completed.</p>
          )}
        </div>

        {/* Processing placeholder */}
        {status === "processing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FiLoader className="h-10 w-10 animate-spin text-lav-400" />
            <p className="text-sm font-medium text-white/60">Analyzing interview with Groq AI…</p>
            <p className="text-xs text-white/30">This usually takes 30–60 seconds. Page updates automatically.</p>
          </div>
        )}

        {/* Not started placeholder */}
        {status === "not_started" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <FiAward className="h-12 w-12 text-white/10" />
            <p className="text-sm text-white/50">No candidate report yet. Click "Generate Report" to start AI analysis.</p>
          </div>
        )}

        {/* Full report */}
        {status === "completed" && rpt && (
          <div className="space-y-6">
            {/* Hero: overall score + recommendation */}
            <div className="card-surface p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="shrink-0">
                  <ScoreRing score={rpt.overallScore} size={120} strokeWidth={10} />
                  <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-white/40">Overall</p>
                </div>
                <div className="flex-1">
                  <div className={`mb-3 inline-flex rounded-xl border px-4 py-1.5 text-sm font-bold ${recStyle.bg} ${recStyle.text} ${recStyle.border}`}>
                    {rpt.recommendation}
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">{rpt.summary}</p>
                </div>
              </div>
            </div>

            {/* Score overview bars */}
            <div className="card-surface p-5">
              <h2 className="mb-4 font-display text-sm font-semibold text-white">Score Breakdown</h2>
              <div className="space-y-4">
                <ScoreBar label="Technical Skills" score={rpt.technicalEvaluation?.score} icon={FiZap} />
                <ScoreBar label="Problem Solving" score={rpt.problemSolving?.score} icon={FiBarChart2} />
                <ScoreBar label="Communication" score={rpt.communication?.score} icon={FiMessageSquare} />
                <ScoreBar label="Behavioral Performance" score={rpt.behavioralPerformance?.score} icon={FiUser} />
                <ScoreBar label="Job Fit" score={rpt.jobFit?.score} icon={FiBriefcase} />
              </div>
            </div>

            {/* Dimension cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              <DimensionCard title="Technical Skills" score={rpt.technicalEvaluation?.score}
                strengths={rpt.technicalEvaluation?.strengths} weaknesses={rpt.technicalEvaluation?.weaknesses}
                evidence={rpt.technicalEvaluation?.evidence} icon={FiZap} />
              <DimensionCard title="Problem Solving" score={rpt.problemSolving?.score}
                strengths={rpt.problemSolving?.strengths} weaknesses={rpt.problemSolving?.weaknesses}
                evidence={rpt.problemSolving?.evidence} icon={FiBarChart2} />
              <DimensionCard title="Communication" score={rpt.communication?.score}
                strengths={rpt.communication?.strengths} weaknesses={rpt.communication?.weaknesses}
                evidence={rpt.communication?.evidence} icon={FiMessageSquare} />
              <DimensionCard title="Behavioral Performance" score={rpt.behavioralPerformance?.score}
                strengths={rpt.behavioralPerformance?.strengths} weaknesses={rpt.behavioralPerformance?.weaknesses}
                evidence={rpt.behavioralPerformance?.evidence} icon={FiUser} />
            </div>

            {/* Job Fit */}
            <div className="card-surface p-5">
              <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-white">
                <FiBriefcase className="h-4 w-4 text-lav-400" /> Job Fit — {rpt.jobFit?.score ?? 0}/100
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Matching Skills", items: rpt.jobFit?.matchingSkills, color: "text-emerald-400", prefix: "✓" },
                  { label: "Resume Only (not demonstrated)", items: rpt.jobFit?.resumeOnlySkills, color: "text-amber-400", prefix: "~" },
                  { label: "Missing Skills", items: rpt.jobFit?.missingSkills, color: "text-red-400", prefix: "✗" },
                ].map(({ label, items, color, prefix }) => (
                  <div key={label}>
                    <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${color}/70`}>{label}</p>
                    {items?.length > 0
                      ? <ul className="space-y-1">{items.map((s, i) => <li key={i} className={`flex items-start gap-1 text-xs text-white/65`}><span className={color}>{prefix}</span>{s}</li>)}</ul>
                      : <p className="text-xs text-white/30">None</p>}
                  </div>
                ))}
              </div>
              <EvidenceList evidence={rpt.jobFit?.evidence} />
            </div>

            {/* Q&A Analysis */}
            {rpt.questionAnswerAnalysis?.length > 0 && (
              <div className="card-surface p-5">
                <h2 className="mb-4 font-display text-sm font-semibold text-white">Question-Answer Analysis</h2>
                <div className="space-y-4">
                  {rpt.questionAnswerAnalysis.map((qa, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      {qa.startTime != null && (
                        <span className="mb-2 inline-block font-mono text-[10px] text-white/30">{formatTime(qa.startTime)}</span>
                      )}
                      <p className="mb-1 text-xs font-semibold text-lav-300">Q: {qa.question}</p>
                      <p className="mb-2 text-xs text-white/60">A: {qa.answer}</p>
                      <p className="text-xs text-white/45 italic">{qa.evaluation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strong / Weak answers */}
            {(rpt.strongAnswers?.length > 0 || rpt.weakAnswers?.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {rpt.strongAnswers?.length > 0 && (
                  <div className="card-surface p-5">
                    <h2 className="mb-3 font-display text-sm font-semibold text-emerald-400">Strong Answers</h2>
                    <ul className="space-y-2">
                      {rpt.strongAnswers.map((a, i) => <li key={i} className="flex items-start gap-2 text-xs text-white/70"><span className="mt-0.5 text-emerald-400">★</span>{a}</li>)}
                    </ul>
                  </div>
                )}
                {rpt.weakAnswers?.length > 0 && (
                  <div className="card-surface p-5">
                    <h2 className="mb-3 font-display text-sm font-semibold text-red-400">Weak Answers</h2>
                    <ul className="space-y-2">
                      {rpt.weakAnswers.map((a, i) => <li key={i} className="flex items-start gap-2 text-xs text-white/70"><span className="mt-0.5 text-red-400">✗</span>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Areas for improvement */}
            {rpt.areasForImprovement?.length > 0 && (
              <div className="card-surface p-5">
                <h2 className="mb-3 font-display text-sm font-semibold text-white">Areas for Improvement</h2>
                <ol className="space-y-2">
                  {rpt.areasForImprovement.map((a, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                      <span className="shrink-0 rounded-full bg-lav-500/20 px-2 py-0.5 text-[10px] font-bold text-lav-300">{i+1}</span>
                      {a}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Final assessment */}
            {rpt.finalAssessment && (
              <div className="card-surface border-lav-500/20 p-5">
                <h2 className="mb-3 font-display text-sm font-semibold text-white">Final Assessment</h2>
                <p className="text-sm leading-relaxed text-white/75">{rpt.finalAssessment}</p>
                {report?.updatedAt && (
                  <p className="mt-3 text-[11px] text-white/25">
                    Generated {new Date(report.updatedAt).toLocaleString()} · Model: {report.llmModel}
                  </p>
                )}
              </div>
            )}

            {/* Full Interview Transcript */}
            {transcript?.segments?.length > 0 && (
              <div className="card-surface p-5">
                <h2 className="mb-4 font-display text-sm font-semibold text-white flex items-center justify-between">
                  <span>Interview Transcript</span>
                  <span className="text-xs font-normal text-white/40">{transcript.segments.length} segments</span>
                </h2>
                <div className="max-h-96 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {transcript.segments.map((seg, i) => {
                    const isInterviewer = (seg.speaker || seg.speaker_type || "").includes("interviewer");
                    return (
                      <div key={seg.id || i} className={`rounded-xl border p-3 ${isInterviewer ? "border-lav-500/20 bg-lav-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isInterviewer ? "text-lav-300" : "text-emerald-300"}`}>
                            {isInterviewer ? "Interviewer" : "Candidate"}
                          </span>
                          {seg.startTime != null && (
                            <span className="font-mono text-[10px] text-white/30">{formatTime(seg.startTime)}</span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-white/85">{seg.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Disclaimer */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-center">
              <p className="text-xs text-white/40 leading-relaxed">
                Notice: This report is AI-generated from the interview transcript and evidence. It is intended to assist human review and does not constitute an automated hiring decision.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateReport;
