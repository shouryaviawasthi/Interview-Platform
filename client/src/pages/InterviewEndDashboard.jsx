import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiCheckCircle, FiLoader, FiDownload, FiUser, FiBarChart2,
  FiMessageSquare, FiZap, FiBriefcase, FiAward, FiFileText,
  FiAlertTriangle, FiArrowRight, FiClock, FiUsers, FiHome,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  getCandidateReport,
  getInterviewerReport,
  getInterviewById,
  downloadCandidateReportPdf,
  downloadInterviewerReportPdf,
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
 * Standalone page (no sidebar/layout) shown to the interviewer after ending an interview.
 * Polls both AI reports, shows score preview, and allows PDF download + links to full simple reports.
 */
const InterviewEndDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [candidateReport, setCandidateReport] = useState(null);
  const [interviewerReport, setInterviewerReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dlCandidate, setDlCandidate] = useState(false);
  const [dlInterviewer, setDlInterviewer] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const [cr, ir] = await Promise.all([
        getCandidateReport(id).catch(() => null),
        getInterviewerReport(id).catch(() => null),
      ]);
      setCandidateReport(cr);
      setInterviewerReport(ir);
      return { cr, ir };
    } catch { return { cr: null, ir: null }; }
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
      await loadReports();
      setLoading(false);
    };
    init();
  }, [id, navigate, loadReports]);

  // Poll while either report is processing
  useEffect(() => {
    const crStatus = candidateReport?.status;
    const irStatus = interviewerReport?.status;
    const stillPending = crStatus === 'processing' || crStatus === 'not_started' ||
                         irStatus === 'processing' || irStatus === 'not_started';
    if (!stillPending) return;
    const iv = setInterval(async () => {
      const { cr, ir } = await loadReports();
      const done = (cr?.status === 'completed' || cr?.status === 'failed') &&
                   (ir?.status === 'completed' || ir?.status === 'failed');
      if (done) clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [candidateReport?.status, interviewerReport?.status, loadReports]);

  const handleDlCandidate = async () => {
    setDlCandidate(true);
    try {
      await downloadCandidateReportPdf(id, interview?.candidate_name || 'Candidate');
      toast.success('Candidate PDF downloaded!');
    } catch { toast.error('PDF not ready yet.'); }
    finally { setDlCandidate(false); }
  };

  const handleDlInterviewer = async () => {
    setDlInterviewer(true);
    try {
      await downloadInterviewerReportPdf(id, 'Interviewer');
      toast.success('Interviewer PDF downloaded!');
    } catch { toast.error('PDF not ready yet.'); }
    finally { setDlInterviewer(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900">
        <FiLoader className="h-8 w-8 animate-spin text-lav-400" />
      </div>
    );
  }

  const crpt = candidateReport?.reportJson ?? null;
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
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Duration', value: durationSec ? formatDuration(durationSec) : '—', icon: FiClock },
            { label: 'Candidate Score', value: candidateReport?.overallScore ? (Math.round(candidateReport.overallScore) + '/100') : '—', icon: FiAward },
            { label: 'Interviewer Score', value: interviewerReport?.overallScore ? (Math.round(interviewerReport.overallScore) + '/100') : '—', icon: FiUsers },
            { label: 'Recommendation', value: crpt?.recommendation?.split(' ')[0] || '—', icon: FiBriefcase },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-center">
              <Icon className="mx-auto mb-1.5 h-4 w-4 text-white/30" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-white/40">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Candidate Report Card ────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiUser className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-sm font-semibold text-white">Candidate Report</h2>
            </div>
            <StatusBadge status={candidateReport?.status ?? 'not_started'} />
          </div>

          {(candidateReport?.status === 'not_started' || candidateReport?.status === 'processing') && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FiLoader className="h-7 w-7 animate-spin text-emerald-400/60" />
              <p className="text-xs text-white/40">AI is analyzing candidate performance…</p>
            </div>
          )}

          {candidateReport?.status === 'completed' && crpt && (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="shrink-0 text-center">
                  <ScoreRing score={crpt.overallScore} />
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/35">Overall</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs leading-relaxed text-white/60">{crpt.summary}</p>
                </div>
              </div>
              <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
                <ScoreBar label="Technical Skills" score={crpt.technicalEvaluation?.score} icon={FiZap} />
                <ScoreBar label="Problem Solving" score={crpt.problemSolving?.score} icon={FiBarChart2} />
                <ScoreBar label="Communication" score={crpt.communication?.score} icon={FiMessageSquare} />
                <ScoreBar label="Job Fit" score={crpt.jobFit?.score} icon={FiBriefcase} />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-white/[0.06] pt-4">
            <button
              onClick={handleDlCandidate}
              disabled={dlCandidate || candidateReport?.status !== 'completed'}
              className="flex items-center gap-2 rounded-xl bg-emerald-600/20 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors disabled:opacity-40"
            >
              {dlCandidate ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiDownload className="h-3.5 w-3.5" />}
              Download Candidate PDF
            </button>
            <Link
              to={ROUTES.candidateReportSimple(id)}
              className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.1] transition-colors"
            >
              <FiFileText className="h-3.5 w-3.5" /> View Candidate Report
            </Link>
          </div>
        </div>

        {/* ── Interviewer Report Card ──────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiUsers className="h-4 w-4 text-sky-400" />
              <h2 className="font-display text-sm font-semibold text-white">Your Performance Report</h2>
            </div>
            <StatusBadge status={interviewerReport?.status ?? 'not_started'} />
          </div>

          {(interviewerReport?.status === 'not_started' || interviewerReport?.status === 'processing') && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FiLoader className="h-7 w-7 animate-spin text-sky-400/60" />
              <p className="text-xs text-white/40">AI is evaluating your interviewing technique…</p>
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
                <ScoreBar label="Interview Structure" score={irpt.interviewStructure?.score} icon={FiBarChart2} />
                <ScoreBar label="Candidate Engagement" score={irpt.candidateEngagement?.score} icon={FiUsers} />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-white/[0.06] pt-4">
            <button
              onClick={handleDlInterviewer}
              disabled={dlInterviewer || interviewerReport?.status !== 'completed'}
              className="flex items-center gap-2 rounded-xl bg-sky-600/20 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-600/30 transition-colors disabled:opacity-40"
            >
              {dlInterviewer ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiDownload className="h-3.5 w-3.5" />}
              Download My Report PDF
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
