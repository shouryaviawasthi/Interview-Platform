import { useEffect, useState, useCallback } from 'react';
import {
  FiCheckCircle, FiLoader, FiDownload, FiAward,
  FiAlertTriangle, FiClock, FiUser, FiZap, FiBarChart2, FiMessageSquare, FiBookmark,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getPublicCandidateReport, downloadPublicCandidateReportPdf } from '../../services/interview.service';
import { ROUTES } from '../../constants/routes';

const formatDuration = (seconds) => {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(h + 'h');
  if (m > 0) parts.push(m + 'm');
  if (s > 0 || parts.length === 0) parts.push(s + 's');
  return parts.join(' ');
};

const ScoreRing = ({ score, size = 110, strokeWidth = 9 }) => {
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

const REC_LABEL = {
  'Strong Candidate': { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'Good Candidate': { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  'Average Candidate': { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  'Below Average Candidate': { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  'Not Recommended': { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30' },
};

/**
 * CandidateEndScreen
 *
 * Shown to the candidate (guest user) immediately after the interview ends.
 * Polls the public /interviews/public/:token/candidate-report API.
 * Shows score, recommendation, score bars, and a PDF download button.
 */
const CandidateEndScreen = ({ token, candidateName, durationSeconds }) => {
  const [report, setReport] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [reportCandidateName, setReportCandidateName] = useState(candidateName);
  const [reportLoadError, setReportLoadError] = useState(null);

  const loadReport = useCallback(async () => {
    try {
      const data = await getPublicCandidateReport(token);
      setReport(data.report);
      if (data.candidateName) setReportCandidateName(data.candidateName);
      setReportLoadError(null);
      return data.report;
    } catch (error) {
      setReportLoadError(error.response?.data?.message || error.message || 'Could not load your interview report.');
      return null;
    }
  }, [token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Poll while processing
  useEffect(() => {
    if (!report) return;
    const waitingForSpeakerAssignment = report.status === 'not_started' && report.errorMessage;
    if (!reportLoadError && (report.status === 'processing'
      || (report.status === 'not_started' && !waitingForSpeakerAssignment))) {
      const iv = setInterval(async () => {
        const r = await loadReport();
        if (r?.status === 'completed' || r?.status === 'failed') clearInterval(iv);
      }, 4000);
      return () => clearInterval(iv);
    }
  }, [report?.status, report?.errorMessage, reportLoadError, loadReport]);

  const handleDownload = async () => {
    if (!token) return;
    setDownloading(true);
    setPdfDownloaded(false);
    try {
      await downloadPublicCandidateReportPdf(token, reportCandidateName || 'Candidate');
      setPdfDownloaded(true);
      toast.success('Your candidate report PDF was downloaded.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not download your report PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const status = report?.status ?? 'not_started';
  const rpt = report?.reportJson ?? null;
  const recStyle = REC_LABEL[rpt?.recommendation] ?? REC_LABEL['Average Candidate'];

  return (
    <div className="min-h-screen bg-ink-900 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <FiCheckCircle className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Interview Complete
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            {reportCandidateName && <span className="text-white/70">{reportCandidateName} · </span>}
            {durationSeconds ? formatDuration(durationSeconds) : 'Session ended'}
          </p>
        </div>

        {/* Status card */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          {!reportLoadError && status === 'not_started' && report?.errorMessage && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FiClock className="h-8 w-8 text-amber-300" />
              <p className="text-sm font-medium text-white/70">
                Your interviewer is preparing the transcript before reports can be generated.
              </p>
            </div>
          )}

          {!reportLoadError && (status === 'processing'
            || (status === 'not_started' && !report?.errorMessage)) && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FiLoader className="h-9 w-9 animate-spin text-lav-400" />
              <p className="text-sm font-medium text-white/70">
                Analyzing your interview with Groq AI…
              </p>
              <p className="text-xs text-white/35">
                This usually takes 30–60 seconds. Hang tight!
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FiAlertTriangle className="h-9 w-9 text-red-400" />
              <p className="text-sm text-white/60">Your analysis could not be generated.</p>
              <p className="max-w-lg text-xs text-white/40">
                {report?.errorMessage || 'Please contact your interviewer and ask them to retry report generation.'}
              </p>
            </div>
          )}

          {reportLoadError && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FiAlertTriangle className="h-8 w-8 text-amber-300" />
              <p className="text-sm text-white/60">{reportLoadError}</p>
              <button
                type="button"
                onClick={loadReport}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/15"
              >
                Try loading report again
              </button>
            </div>
          )}

          {status === 'completed' && rpt && (
            <div className="space-y-6">
              {/* Hero */}
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div className="shrink-0 text-center">
                  <ScoreRing score={rpt.overallScore} />
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">
                    Overall Score
                  </p>
                </div>
                <div className="flex-1">
                  <div className={"mb-3 inline-flex rounded-xl border px-4 py-1.5 text-sm font-bold " + recStyle.bg + " " + recStyle.text + " " + recStyle.border}>
                    {rpt.recommendation}
                  </div>
                  <p className="text-sm leading-relaxed text-white/65">{rpt.summary}</p>
                </div>
              </div>

              {/* Score bars */}
              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                <ScoreBar label="Technical Skills" score={rpt.technicalEvaluation?.score} icon={FiZap} />
                <ScoreBar label="Problem Solving" score={rpt.problemSolving?.score} icon={FiBarChart2} />
                <ScoreBar label="Communication" score={rpt.communication?.score} icon={FiMessageSquare} />
                <ScoreBar label="Behavioral" score={rpt.behavioralPerformance?.score} icon={FiUser} />
                <ScoreBar label="Job Fit" score={rpt.jobFit?.score} icon={FiAward} />
              </div>

              {(rpt.technicalEvaluation?.strengths?.length > 0 || rpt.strengths?.length > 0) && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300/70">
                    Strengths
                  </p>
                  <ul className="space-y-1.5">
                    {(rpt.technicalEvaluation?.strengths ?? rpt.strengths).slice(0, 3).map((strength, index) => (
                      <li key={`${strength}-${index}`} className="text-xs text-white/60">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths/Improvements quick view */}
              {rpt.areasForImprovement?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-lav-400/70">
                    Areas to Improve
                  </p>
                  <ol className="space-y-1.5">
                    {rpt.areasForImprovement.slice(0, 3).map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <span className="shrink-0 rounded-full bg-lav-500/20 px-1.5 py-0.5 text-[9px] font-bold text-lav-300">
                          {i + 1}
                        </span>
                        {a}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Download */}
              <div className="border-t border-white/[0.06] pt-4">
                <button
                  onClick={handleDownload}
                  disabled={downloading || status !== 'completed'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-lav-600 py-3 text-sm font-semibold text-white hover:bg-lav-700 transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : pdfDownloaded ? (
                    <FiCheckCircle className="h-4 w-4" />
                  ) : (
                    <FiDownload className="h-4 w-4" />
                  )}
                  {downloading ? 'Preparing PDF…' : pdfDownloaded ? 'PDF Downloaded — Download Again' : 'Download My Report PDF'}
                </button>
              </div>

              {/* Bookmark Message */}
              <div className="border-t border-white/[0.06] pt-4">
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <FiBookmark className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1">Save This Report</h3>
                      <p className="text-xs text-white/70 mb-3">
                        Bookmark this page to access your interview report anytime. Your personalized dashboard link:
                      </p>
                      <div className="bg-ink-800/50 rounded-lg p-2 border border-white/10">
                        <code className="text-xs text-blue-300 break-all">
                          {window.location.origin}{ROUTES.candidateDashboard(token)}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-center text-[10px] text-white/25 leading-relaxed">
                This report is AI-generated from the interview transcript and is intended to assist human review. It does not constitute an automated hiring decision.
              </p>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-white/30">You can close this tab now or keep it open to download your report.</p>
        </div>
      </div>
    </div>
  );
};

export default CandidateEndScreen;
