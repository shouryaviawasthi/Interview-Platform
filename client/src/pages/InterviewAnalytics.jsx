import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import {
  FiArrowLeft, FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiLoader, FiClock, FiActivity, FiUsers, FiMessageSquare,
  FiZap, FiBarChart2, FiLayers, FiHelpCircle, FiGlobe,
  FiVolume2, FiAward, FiExternalLink, FiCornerDownRight,
  FiFileText,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import {
  getAnalytics,
  generateAnalytics,
  retryAnalytics,
  getInterviewById,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (s) => {
  if (s == null || isNaN(s)) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const STATUS_UI = {
  not_started: { icon: FiClock, text: "Analytics not started", color: "text-ink-400" },
  processing: { icon: FiLoader, text: "Analyzing interview conversation…", color: "text-blue-400", spin: true },
  completed: { icon: FiCheckCircle, text: "Analytics ready", color: "text-emerald-400" },
  failed: { icon: FiAlertTriangle, text: "Analysis failed", color: "text-red-400" },
};

// ── Stat Card Component ──────────────────────────────────────────────────────

const StatCard = ({ title, value, subtitle, icon: Icon, color = "text-lav-400" }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{title}</p>
      {Icon && <Icon className={`h-4 w-4 ${color}`} />}
    </div>
    <p className="mt-2 font-display text-2xl font-bold text-white">{value ?? "—"}</p>
    {subtitle && <p className="mt-1 text-xs text-white/40">{subtitle}</p>}
  </div>
);

// ── Speaking Balance Component ───────────────────────────────────────────────

const SpeakingBalanceVisualizer = ({ speakingTime, speakingPercentage, duration }) => {
  const iPct = speakingPercentage?.interviewer ?? 0;
  const cPct = speakingPercentage?.candidate ?? 0;

  return (
    <div className="card-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
          <FiUsers className="h-5 w-5 text-lav-400" /> Speaking Time & Conversation Balance
        </h2>
        <span className="rounded-md bg-white/[0.05] px-2.5 py-1 text-xs font-mono text-white/60">
          Total: {formatTime(duration?.totalSeconds)}
        </span>
      </div>

      {/* Dual Segmented Bar */}
      <div className="mb-4 overflow-hidden rounded-xl h-5 flex bg-white/[0.04] p-0.5">
        <div
          className="flex items-center justify-center rounded-l-lg bg-sky-500 text-[11px] font-bold text-white transition-all duration-700 shadow-sm"
          style={{ width: `${iPct}%` }}
          title={`Interviewer: ${iPct}%`}
        >
          {iPct >= 12 ? `Interviewer ${iPct}%` : ""}
        </div>
        <div
          className="flex items-center justify-center rounded-r-lg bg-lav-500 text-[11px] font-bold text-white transition-all duration-700 shadow-sm"
          style={{ width: `${cPct}%` }}
          title={`Candidate: ${cPct}%`}
        >
          {cPct >= 12 ? `Candidate ${cPct}%` : ""}
        </div>
      </div>

      {/* Legend & Details */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 text-xs">
        <div className="flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <span className="h-3 w-3 rounded-full bg-sky-500" />
          <div>
            <p className="font-semibold text-white">Interviewer Speaking</p>
            <p className="text-white/60 font-mono">{formatTime(speakingTime?.interviewer)} ({iPct}%)</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-lav-500/20 bg-lav-500/5 p-3">
          <span className="h-3 w-3 rounded-full bg-lav-500" />
          <div>
            <p className="font-semibold text-white">Candidate Speaking</p>
            <p className="text-white/60 font-mono">{formatTime(speakingTime?.candidate)} ({cPct}%)</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <span className="h-3 w-3 rounded-full bg-white/20" />
          <div>
            <p className="font-semibold text-white">Silence & Transitions</p>
            <p className="text-white/60 font-mono">{formatTime(duration?.silenceSeconds)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Turn Taking Analytics ────────────────────────────────────────────────────

const TurnTakingCard = ({ turns }) => (
  <div className="card-surface p-6">
    <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
      <FiActivity className="h-5 w-5 text-lav-400" /> Conversational Turns & Dynamics
    </h2>

    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-5">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-[11px] text-white/50 uppercase font-semibold">Total Turns</p>
        <p className="text-xl font-bold text-white mt-1">{turns?.total ?? 0}</p>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-[11px] text-white/50 uppercase font-semibold">Interviewer Turns</p>
        <p className="text-xl font-bold text-sky-300 mt-1">{turns?.interviewer ?? 0}</p>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-[11px] text-white/50 uppercase font-semibold">Candidate Turns</p>
        <p className="text-xl font-bold text-lav-300 mt-1">{turns?.candidate ?? 0}</p>
      </div>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-[11px] text-white/50 uppercase font-semibold">Avg Turn Time</p>
        <p className="text-xl font-bold text-white mt-1">
          {turns?.avgCandidateDuration ?? 0}s <span className="text-xs text-white/40 font-normal">cand</span>
        </p>
      </div>
    </div>

    {turns?.longestTurn?.duration > 0 && (
      <div className="rounded-xl border border-lav-500/20 bg-lav-500/5 p-4 text-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-lav-300 uppercase tracking-wider text-[10px]">
            Longest Continuous Turn ({turns.longestTurn.duration} seconds)
          </span>
          <span className="font-mono text-white/50">
            {formatTime(turns.longestTurn.startTime)} → {formatTime(turns.longestTurn.endTime)}
          </span>
        </div>
        <p className="text-white/70 italic line-clamp-2">
          "{turns.longestTurn.snippet}…"
        </p>
      </div>
    )}
  </div>
);

// ── Speech Patterns & Fillers ────────────────────────────────────────────────

const SpeechPatternsCard = ({ fillers, languages }) => {
  const cFillers = fillers?.candidate;
  const iFillers = fillers?.interviewer;
  const cLang = languages?.candidate;

  return (
    <div className="card-surface p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
        <FiVolume2 className="h-5 w-5 text-lav-400" /> Speech Patterns & Multilingual Breakdown
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Language Distribution */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white">
            <FiGlobe className="h-3.5 w-3.5 text-lav-400" /> Language Distribution (Descriptive)
          </p>
          <p className="text-xs text-white/60 mb-3">
            Primary: <strong className="text-white">{cLang?.primaryLanguage || "English"}</strong>
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-white/70">
              <span>English</span>
              <span className="font-mono">{cLang?.englishPct ?? 100}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${cLang?.englishPct ?? 100}%` }} />
            </div>
            {cLang?.hindiPct > 0 && (
              <>
                <div className="flex items-center justify-between text-white/70 pt-1">
                  <span>Hindi / Hinglish</span>
                  <span className="font-mono">{cLang?.hindiPct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-lav-400 rounded-full" style={{ width: `${cLang?.hindiPct}%` }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filler Word Analytics */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white">
            <FiMessageSquare className="h-3.5 w-3.5 text-lav-400" /> Conversational Fillers & Markers
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-white/40 block text-[10px] uppercase font-semibold">Candidate</span>
              <span className="text-base font-bold text-white">{cFillers?.totalCount ?? 0}</span>
              <span className="text-[10px] text-white/40 block mt-0.5">({cFillers?.frequencyPer100Words ?? 0}/100 words)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-white/40 block text-[10px] uppercase font-semibold">Interviewer</span>
              <span className="text-base font-bold text-white">{iFillers?.totalCount ?? 0}</span>
              <span className="text-[10px] text-white/40 block mt-0.5">({iFillers?.frequencyPer100Words ?? 0}/100 words)</span>
            </div>
          </div>
          {cFillers?.breakdown && Object.keys(cFillers.breakdown).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(cFillers.breakdown).map(([word, count]) => (
                <span key={word} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-mono text-white/70">
                  {word}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Technical Topics Visualizer ──────────────────────────────────────────────

const TopicsCard = ({ topics, interviewId }) => {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="card-surface p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
        <FiZap className="h-5 w-5 text-lav-400" /> Technical & Domain Topics Discussed
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {topics.map((t, idx) => (
          <div key={idx} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-white">{t.topic}</span>
                {t.startTime != null && (
                  <Link
                    to={`${ROUTES.transcript(interviewId)}#t=${Math.floor(t.startTime)}`}
                    className="flex items-center gap-1 font-mono text-[10px] text-lav-400 hover:text-lav-300 transition-colors"
                  >
                    {formatTime(t.startTime)} <FiExternalLink className="h-2.5 w-2.5" />
                  </Link>
                )}
              </div>
              <p className="text-xs text-white/60 line-clamp-2">{t.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Timeline Visualizer ──────────────────────────────────────────────────────

const TimelineCard = ({ timeline, interviewId }) => {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="card-surface p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
        <FiLayers className="h-5 w-5 text-lav-400" /> Chronological Interview Timeline
      </h2>
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.1]">
        {timeline.map((item, idx) => (
          <div key={idx} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-lav-500 bg-[#161224]" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{item.milestone}</h3>
              {item.startTime != null && (
                <Link
                  to={`${ROUTES.transcript(interviewId)}#t=${Math.floor(item.startTime)}`}
                  className="inline-flex items-center gap-1 rounded-md bg-lav-500/10 px-2 py-0.5 font-mono text-[11px] text-lav-300 hover:bg-lav-500/20 transition-colors"
                >
                  <FiClock className="h-3 w-3" /> {formatTime(item.startTime)}
                  {item.endTime != null && ` → ${formatTime(item.endTime)}`}
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs text-white/60 leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Question-Answer Explorer ─────────────────────────────────────────────────

const QAExplorerCard = ({ mappings, interviewId }) => {
  if (!mappings || mappings.length === 0) return null;

  return (
    <div className="card-surface p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
        <FiHelpCircle className="h-5 w-5 text-lav-400" /> Question & Answer Analysis
      </h2>
      <div className="space-y-4">
        {mappings.map((qa, idx) => (
          <div key={idx} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300 uppercase text-[10px]">
                {qa.category || "Question"}
              </span>
              {qa.startTime != null && (
                <Link
                  to={`${ROUTES.transcript(interviewId)}#t=${Math.floor(qa.startTime)}`}
                  className="font-mono text-[11px] text-lav-400 hover:text-lav-300 flex items-center gap-1"
                >
                  {formatTime(qa.startTime)} {qa.endTime != null && `→ ${formatTime(qa.endTime)}`}
                  <FiExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
            </div>
            <p className="font-medium text-white mb-1.5">Q: {qa.question}</p>
            <p className="text-white/60 mb-2 pl-3 border-l border-lav-500/30">A: "{qa.answerSnippet}"</p>
            {qa.evaluation && (
              <p className="text-white/45 italic bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                Evaluation: {qa.evaluation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Evidence-Based Insights ──────────────────────────────────────────────────

const InsightsCard = ({ candidateInsights, interviewerInsights, interviewId }) => {
  if (!candidateInsights && !interviewerInsights) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Candidate Insights */}
      {candidateInsights && (
        <div className="card-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-emerald-400">
            <FiAward className="h-5 w-5" /> Candidate Insights (Evidence-Linked)
          </h2>
          <div className="space-y-4 text-xs">
            {candidateInsights.strongestTechnicalArea?.area && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-300 uppercase text-[10px]">Strongest Technical Area</span>
                  {candidateInsights.strongestTechnicalArea.startTime != null && (
                    <Link
                      to={`${ROUTES.transcript(interviewId)}#t=${Math.floor(candidateInsights.strongestTechnicalArea.startTime)}`}
                      className="font-mono text-[10px] text-emerald-300/70 hover:underline flex items-center gap-1"
                    >
                      {formatTime(candidateInsights.strongestTechnicalArea.startTime)} <FiExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  )}
                </div>
                <p className="font-semibold text-white mb-1">{candidateInsights.strongestTechnicalArea.area}</p>
                <p className="text-white/70">{candidateInsights.strongestTechnicalArea.explanation}</p>
              </div>
            )}

            {candidateInsights.mostDifficultQuestion?.question && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <span className="font-bold text-amber-300 uppercase text-[10px] block mb-1">Most Challenging Question</span>
                <p className="font-semibold text-white mb-1">"{candidateInsights.mostDifficultQuestion.question}"</p>
                <p className="text-white/70">{candidateInsights.mostDifficultQuestion.challenge}</p>
              </div>
            )}

            {candidateInsights.bestAnswer?.topic && (
              <div className="rounded-xl border border-lav-500/20 bg-lav-500/5 p-3">
                <span className="font-bold text-lav-300 uppercase text-[10px] block mb-1">Standout Response</span>
                <p className="font-semibold text-white mb-1">{candidateInsights.bestAnswer.topic}</p>
                <p className="text-white/70">{candidateInsights.bestAnswer.highlight}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interviewer Insights */}
      {interviewerInsights && (
        <div className="card-surface p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-sky-400">
            <FiUsers className="h-5 w-5" /> Interviewer Insights (Evidence-Linked)
          </h2>
          <div className="space-y-4 text-xs">
            {interviewerInsights.strongestSection?.section && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                <span className="font-bold text-sky-300 uppercase text-[10px] block mb-1">Strongest Interview Section</span>
                <p className="font-semibold text-white mb-1">{interviewerInsights.strongestSection.section}</p>
                <p className="text-white/70">{interviewerInsights.strongestSection.highlight}</p>
              </div>
            )}

            {interviewerInsights.bestFollowUpQuestion?.question && (
              <div className="rounded-xl border border-lav-500/20 bg-lav-500/5 p-3">
                <span className="font-bold text-lav-300 uppercase text-[10px] block mb-1">Most Effective Follow-Up</span>
                <p className="font-semibold text-white mb-1">"{interviewerInsights.bestFollowUpQuestion.question}"</p>
                <p className="text-white/70">{interviewerInsights.bestFollowUpQuestion.effectiveReason}</p>
              </div>
            )}

            {interviewerInsights.unexploredAreas?.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <span className="font-bold text-white/50 uppercase text-[10px] block mb-1">Unexplored Areas</span>
                <ul className="space-y-1">
                  {interviewerInsights.unexploredAreas.map((area, i) => (
                    <li key={i} className="text-white/70 flex items-center gap-1.5">
                      <FiCornerDownRight className="h-3 w-3 text-lav-400" /> {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page Component ──────────────────────────────────────────────────────

const InterviewAnalytics = () => {
  const { id } = useParams();
  const { onMenuClick } = useOutletContext();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const a = await getAnalytics(id);
      setAnalytics(a);
      return a;
    } catch {
      return null;
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      try {
        const iData = await getInterviewById(id);
        setInterview(iData);
      } catch {
        navigate(ROUTES.INTERVIEWS);
        return;
      }
      await loadData();
      setLoading(false);
    };
    init();
  }, [id, navigate, loadData]);

  // Polling when processing
  useEffect(() => {
    if (analytics?.status !== "processing") return;
    const iv = setInterval(async () => {
      const a = await loadData();
      if (a?.status !== "processing") clearInterval(iv);
    }, 4000);
    return () => clearInterval(iv);
  }, [analytics?.status, loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateAnalytics(id);
      toast.success("Analytics generation started…");
      await loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to start analytics.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryAnalytics(id);
      toast.success("Retry started.");
      await loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || "Retry failed.");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <Loader label="Loading interview analytics" />;
  if (!interview) return null;

  const status = analytics?.status ?? "not_started";
  const statusUi = STATUS_UI[status] || STATUS_UI.not_started;
  const StatusIcon = statusUi.icon;
  const aj = analytics?.analyticsJson;

  return (
    <div>
      <Topbar onMenuClick={onMenuClick} title="Interview Analytics" subtitle={interview.candidate_name} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8 space-y-6">
        {/* Navigation & Header Links */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={ROUTES.interviewDetail(id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
            <FiArrowLeft className="h-4 w-4" /> Back to interview
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.candidateReport(id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-colors"
            >
              <FiAward className="h-3.5 w-3.5 text-emerald-400" /> Candidate Report
            </Link>
            <Link
              to={ROUTES.interviewerReport(id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-colors"
            >
              <FiUsers className="h-3.5 w-3.5 text-sky-400" /> Interviewer Report
            </Link>
            <Link
              to={ROUTES.transcript(id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08] transition-colors"
            >
              <FiFileText className="h-3.5 w-3.5 text-lav-400" /> Transcript
            </Link>
          </div>
        </div>

        {/* Status + Action Bar */}
        <div className="card-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <StatusIcon className={`h-4 w-4 ${statusUi.color} ${statusUi.spin ? "animate-spin" : ""}`} />
              <span className={`text-sm font-medium ${statusUi.color}`}>{statusUi.text}</span>
            </div>
            <div className="flex items-center gap-2">
              {(status === "not_started" || status === "failed") && (
                <Button icon={FiZap} isLoading={generating} onClick={handleGenerate}>
                  {status === "not_started" ? "Generate Analytics" : "Regenerate"}
                </Button>
              )}
              {status === "failed" && (
                <Button variant="secondary" icon={FiRefreshCw} isLoading={retrying} onClick={handleRetry}>
                  Retry
                </Button>
              )}
            </div>
          </div>
          {status === "failed" && analytics?.errorMessage && (
            <p className="mt-2 text-xs text-red-400/80">{analytics.errorMessage}</p>
          )}
        </div>

        {/* Processing State */}
        {status === "processing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FiLoader className="h-10 w-10 animate-spin text-lav-400" />
            <p className="text-sm font-medium text-white/60">Extracting speaking dynamics, pauses, and timeline…</p>
            <p className="text-xs text-white/30">Takes roughly 15–30 seconds. The dashboard updates automatically.</p>
          </div>
        )}

        {/* Not Started State */}
        {status === "not_started" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <FiBarChart2 className="h-12 w-12 text-white/10" />
            <p className="text-sm text-white/50">No analytics generated yet. Click "Generate Analytics" to extract detailed metrics.</p>
          </div>
        )}

        {/* Completed Analytics Dashboard */}
        {status === "completed" && aj && (
          <div className="space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                title="Total Duration"
                value={aj.duration?.formatted || formatTime(analytics.duration?.totalSeconds)}
                subtitle={`${aj.duration?.speakingSeconds ?? 0}s spoken`}
                icon={FiClock}
              />
              <StatCard
                title="Questions"
                value={aj.questions?.total ?? 0}
                subtitle={`${aj.questions?.followUps ?? 0} follow-ups`}
                icon={FiHelpCircle}
                color="text-sky-400"
              />
              <StatCard
                title="Total Turns"
                value={aj.turns?.total ?? 0}
                subtitle={`${aj.turns?.candidate ?? 0} candidate`}
                icon={FiActivity}
              />
              <StatCard
                title="Avg Response Latency"
                value={`${aj.pausesAndLatency?.avgResponseDelay ?? 0}s`}
                subtitle={`${aj.pausesAndLatency?.totalPauseEvents ?? 0} pauses`}
                icon={FiZap}
                color="text-emerald-400"
              />
            </div>

            {/* Speaking Balance */}
            <SpeakingBalanceVisualizer
              speakingTime={aj.speakingTime}
              speakingPercentage={aj.speakingPercentage}
              duration={aj.duration}
            />

            {/* Turn Taking & Dynamics */}
            <TurnTakingCard turns={aj.turns} />

            {/* Speech Patterns & Language Breakdown */}
            <SpeechPatternsCard
              fillers={aj.fillers}
              languages={aj.languages}
            />

            {/* Technical Topics */}
            <TopicsCard topics={aj.topics} interviewId={id} />

            {/* Timeline */}
            <TimelineCard timeline={aj.timeline} interviewId={id} />

            {/* Question-Answer Mappings */}
            <QAExplorerCard mappings={aj.questionAnswerMappings} interviewId={id} />

            {/* Evidence-Based Insights */}
            <InsightsCard
              candidateInsights={aj.candidateInsights}
              interviewerInsights={aj.interviewerInsights}
              interviewId={id}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewAnalytics;
