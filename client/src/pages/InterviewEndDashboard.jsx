import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiCheckCircle, FiLoader, FiDownload, FiBarChart2,
  FiMessageSquare, FiZap, FiAward, FiFileText,
  FiAlertTriangle, FiArrowRight, FiClock, FiUsers, FiHome,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  getInterviewerReport,
  getInterviewById,
  downloadInterviewerReportPdf,
  retryReports,
} from '../services/interview.service';
import { ROUTES } from '../constants/routes';

const formatDuration = (seconds) => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(h + 'h');
  if (m > 0) parts.push(m + 'm');
  if (s > 0 || parts.length === 0) parts.push(s + 's');
  return parts.join(' ');
};

const ScoreRing = ({ score, size = 90, strokeWidth = 8 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * circ;
  const color = pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={dash + ' ' + circ} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill="white" style={{ fontSize: size * 0.22, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {pct}
      </text>
    </svg>
  );
};

const ScoreBar = ({ label, score, icon: Icon }) => {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const bar = pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          {Icon && <Icon className="h-3 w-3" />} {label}
        </span>
        <span className="text-xs font-bold text-white">{pct}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={"h-full rounded-full " + bar + " transition-all duration-700"} style={{ width: pct + "%" }} />
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  if (status === 'completed') return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
      <FiCheckCircle className="h-3 w-3" /> Ready
    </span>
  );
  if (status === 'processing') return (
    <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
      <FiLoader className="h-3 w-3 animate-spin" /> Generating…
    </span>
  );
  if (status === 'failed') return (
    <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300">
      <FiAlertTriangle className="h-3 w-3" /> Failed
    </span>
  );
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/40">
      <FiClock className="h-3 w-3" /> Pending…
    </span>
  );
};

/**
 * InterviewEndDashboard
 *
 * Standalone interviewer dashboard shown after ending an interview.
 * Shows the interviewer's analysis and provides a downloadable PDF.
 */
const InterviewEndDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [interviewerReport, setInterviewerReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [reportLoadError, setReportLoadError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const report = await getInterviewerReport(id);
      setInterviewerReport(report);
      setReportLoadError(null);
      return report;
    } catch (error) {
      setReportLoadError(error.response?.data?.message || error.message || 'Could not load your interviewer report.');
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
      await loadReport();
      setLoading(false);
    };
    init();
  }, [id, navigate, loadReport]);

  // Poll until the interviewer's analysis is complete.
  useEffect(() => {
    const irStatus = interviewerReport?.status;
    const waitingForSpeakerAssignment = irStatus === 'not_started' && interviewerReport?.errorMessage;
    const stillPending = irStatus === 'processing' || (irStatus === 'not_started' && !waitingForSpeakerAssignment);
    if (reportLoadError) return;
    if (!stillPending) return;
    const iv = setInterval(async () => {
      const report = await loadReport();
      if (report?.status === 'completed' || report?.status === 'failed') clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [interviewerReport?.status, interviewerReport?.errorMessage, loadReport, reportLoadError]);

  const handleDownload = async () => {
    setDownloading(true);
    setPdfDownloaded(false);
    try {
      await downloadInterviewerReportPdf(id, 'Interviewer');
      setPdfDownloaded(true);
      toast.success('Your interviewer report PDF was downloaded.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not download the interviewer report PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setReportLoadError(null);
    try {
      await retryReports(id);
      toast.success('Report retry started. This page will update automatically.');
      await loadReport();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not retry the report.');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900">
        <FiLoader className="h-8 w-8 animate-spin text-lav-400" />
      </div>
    );
  }

  const irpt = interviewerReport?.reportJson ?? null;

  const durationSec = interview?.duration_seconds
    ?? (interview?.started_at && interview?.ended_at
      ? Math.round((new Date(interview.ended_at) - new Date(interview.started_at)) / 1000)
      : null);

  return (
    <div className="min-h-screen bg-ink-900 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-lav-500/15 text-lav-300">
            <FiCheckCircle className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Interview Completed</h1>
          <p className="mt-1.5 text-sm text-white/50">
            <span className="text-white/70">{interview?.candidate_name}</span>
            {durationSec && <span> · {formatDuration(durationSec)}</span>}
          </p>
        </div>

        {/* ── Quick stats row ─────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Duration', value: durationSec ? formatDuration(durationSec) : '—', icon: FiClock },
            { label: 'Your Interviewer Score', value: interviewerReport?.overallScore != null ? `${Math.round(interviewerReport.overallScore)}/100` : '—', icon: FiAward },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-center">
              <Icon className="mx-auto mb-1.5 h-4 w-4 text-white/30" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-white/40">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Interviewer Report ───────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiUsers className="h-4 w-4 text-sky-400" />
              <h2 className="font-display text-sm font-semibold text-white">Your Performance Report</h2>
            </div>
            <StatusBadge status={interviewerReport?.status ?? 'not_started'} />
          </div>

          {interviewerReport?.status === 'not_started' && interviewerReport?.errorMessage && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FiAlertTriangle className="h-8 w-8 text-amber-300" />
              <p className="text-sm text-white/70">{interviewerReport.errorMessage}</p>
              <Link
                to={ROUTES.transcript(id)}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/15"
              >
                Review transcript and assign speakers
              </Link>
            </div>
          )}

          {(interviewerReport?.status === 'processing'
            || (interviewerReport?.status === 'not_started' && !interviewerReport?.errorMessage)) && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FiLoader className="h-7 w-7 animate-spin text-sky-400/60" />
              <p className="text-xs text-white/40">AI is evaluating your interviewing technique…</p>
            </div>
          )}

          {reportLoadError && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
              {reportLoadError}
              <button
                type="button"
                onClick={loadReport}
                className="ml-3 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white/80 hover:bg-white/15"
              >
                Try again
              </button>
            </div>
          )}

          {interviewerReport?.status === 'failed' && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-200">
              <p className="font-semibold">The interviewer analysis could not be generated.</p>
              <p className="mt-1 text-red-100/75">
                {interviewerReport.errorMessage || 'Check that the transcript is ready, then retry the analysis.'}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 font-semibold text-red-100 hover:bg-red-500/30 disabled:opacity-50"
              >
                {retrying && <FiLoader className="h-3.5 w-3.5 animate-spin" />}
                {retrying ? 'Retrying analysis…' : 'Retry report generation'}
              </button>
            </div>
          )}

          {interviewerReport?.status === 'completed' && irpt && (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="shrink-0 text-center">
                  <ScoreRing score={irpt.overallScore} />
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/35">Your Score</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs leading-relaxed text-white/60">{irpt.summary}</p>
                </div>
              </div>
              <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
                <ScoreBar label="Question Quality" score={irpt.questionQuality?.score} icon={FiMessageSquare} />
                <ScoreBar label="Follow-up Quality" score={irpt.followUpQuality?.score} icon={FiZap} />
                <ScoreBar label="Interview Structure" score={irpt.interviewStructure?.score} icon={FiBarChart2} />
                <ScoreBar label="Candidate Engagement" score={irpt.candidateEngagement?.score} icon={FiUsers} />
                <ScoreBar label="Communication" score={irpt.communication?.score} icon={FiMessageSquare} />
              </div>
              {irpt.areasForImprovement?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sky-300/70">
                    Areas to Improve
                  </p>
                  <ul className="space-y-1.5">
                    {irpt.areasForImprovement.slice(0, 3).map((area, index) => (
                      <li key={`${area}-${index}`} className="text-xs text-white/60">
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-white/[0.06] pt-4">
            <button
              onClick={handleDownload}
              disabled={downloading || interviewerReport?.status !== 'completed'}
              className="flex items-center gap-2 rounded-xl bg-sky-600/20 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-600/30 transition-colors disabled:opacity-40"
            >
              {downloading ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : pdfDownloaded ? <FiCheckCircle className="h-3.5 w-3.5" /> : <FiDownload className="h-3.5 w-3.5" />}
              {downloading ? 'Preparing PDF…' : pdfDownloaded ? 'PDF Downloaded — Download Again' : 'Download My Report PDF'}
            </button>
            <Link
              to={ROUTES.interviewerReportSimple(id)}
              className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.1] transition-colors"
            >
              <FiFileText className="h-3.5 w-3.5" /> View My Report
            </Link>
          </div>
        </div>

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to={ROUTES.DASHBOARD}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08] transition-colors"
          >
            <FiHome className="h-4 w-4" /> Go to Dashboard
          </Link>
          <Link
            to={ROUTES.interviewDetail(id)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08] transition-colors"
          >
            Interview Details <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-6 text-center text-[10px] text-white/25">
          AI reports are generated by Groq LLM based on the interview transcript. They assist human evaluation and do not constitute automated hiring decisions.
        </p>
      </div>
    </div>
  );
};

export default InterviewEndDashboard;
