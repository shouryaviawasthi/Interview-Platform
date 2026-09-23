import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import {
  FiArrowLeft,
  FiClock,
  FiUser,
  FiRefreshCw,
  FiAlertTriangle,
  FiCheckCircle,
  FiLoader,
  FiUsers,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Topbar from "../components/layout/Topbar";
import Button from "../components/ui/Button";
import Loader from "../components/ui/Loader";
import {
  getTranscript,
  retryTranscript,
  assignSpeakers,
  getInterviewById,
} from "../services/interview.service";
import { ROUTES } from "../constants/routes";

// ── Helpers ────────────────────────────────────────────────────────────────

const formatTime = (seconds) => {
  if (seconds == null) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const SPEAKER_COLORS = {
  interviewer: {
    label: "INTERVIEWER",
    bg: "bg-lav-500/10",
    border: "border-lav-400/30",
    name: "text-lav-300",
    badge: "bg-lav-500/20 text-lav-300",
  },
  candidate: {
    label: "CANDIDATE",
    bg: "bg-emerald-500/10",
    border: "border-emerald-400/30",
    name: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  unknown: {
    label: "UNASSIGNED",
    bg: "bg-white/[0.03]",
    border: "border-white/10",
    name: "text-white/50",
    badge: "bg-white/10 text-white/50",
  },
};

const STATUS_UI = {
  not_started: { icon: FiClock, text: "Not started", color: "text-white/40" },
  uploaded: { icon: FiClock, text: "Uploaded, waiting…", color: "text-amber-300" },
  processing: { icon: FiLoader, text: "Processing transcript…", color: "text-blue-300", spin: true },
  completed: { icon: FiCheckCircle, text: "Transcript ready", color: "text-emerald-400" },
  failed: { icon: FiAlertTriangle, text: "Processing failed", color: "text-red-400" },
};

// ── Speaker Assignment Modal ────────────────────────────────────────────────

const SpeakerAssignModal = ({ speakerMap, onSave, onClose, isSaving }) => {
  const rawSpeakers = speakerMap ? Object.keys(speakerMap) : [];
  const [assignments, setAssignments] = useState(() => {
    const init = {};
    for (const spk of rawSpeakers) {
      init[spk] = speakerMap[spk] ?? "";
    }
    return init;
  });

  const handleAssign = (rawSpeaker, role) => {
    setAssignments((prev) => {
      const next = { ...prev };
      // Clear other speakers assigned to this role (each role can only have one)
      for (const k of Object.keys(next)) {
        if (next[k] === role && k !== rawSpeaker) {
          next[k] = "";
        }
      }
      next[rawSpeaker] = role;
      return next;
    });
  };

  const isValid = rawSpeakers.every((spk) =>
    ["interviewer", "candidate"].includes(assignments[spk])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[#1A1630] border border-white/10 p-6 shadow-2xl">
        <h2 className="mb-1 font-display text-lg font-semibold text-white">Assign Speakers</h2>
        <p className="mb-5 text-sm text-white/50">
          Deepgram detected {rawSpeakers.length} speaker(s). Assign each to the correct participant.
        </p>

        <div className="space-y-4">
          {rawSpeakers.map((rawSpk) => (
            <div key={rawSpk} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-white/40">
                {rawSpk.replace("_", " ").toUpperCase()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAssign(rawSpk, "interviewer")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    assignments[rawSpk] === "interviewer"
                      ? "bg-lav-600 text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Interviewer
                </button>
                <button
                  onClick={() => handleAssign(rawSpk, "candidate")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    assignments[rawSpk] === "candidate"
                      ? "bg-emerald-600 text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Candidate
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
          >
            Cancel
          </button>
          <Button disabled={!isValid || isSaving} isLoading={isSaving} onClick={() => onSave(assignments)}>
            Save Assignment
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Transcript Segment Card ─────────────────────────────────────────────────

const SegmentCard = ({ segment }) => {
  const type = segment.speaker || "unknown";
  const style = SPEAKER_COLORS[type] || SPEAKER_COLORS.unknown;

  return (
    <div className={`rounded-2xl border p-4 ${style.bg} ${style.border}`}>
      <div className="mb-2 flex items-center gap-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest ${style.badge}`}>
          {style.label}
        </span>
        {segment.startTime != null && (
          <span className="font-mono text-[11px] text-white/30">
            {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
          </span>
        )}
        {segment.confidence != null && (
          <span className="ml-auto font-mono text-[10px] text-white/20">
            {Math.round(segment.confidence * 100)}%
          </span>
        )}
        {segment.language && (
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/20">
            {segment.language}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-white/85">{segment.text}</p>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────

const Transcript = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { onMenuClick } = useOutletContext();

  const [interview, setInterview] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pollInterval, setPollInterval] = useState(null);

  const loadTranscript = useCallback(async () => {
    try {
      const data = await getTranscript(id);
      setTranscript(data);
      return data;
    } catch (err) {
      console.error("[Transcript] Failed to load:", err.message);
      return null;
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        const [iData] = await Promise.all([getInterviewById(id)]);
        setInterview(iData);
      } catch {
        navigate(ROUTES.INTERVIEWS);
        return;
      }
      await loadTranscript();
      setLoading(false);
    };
    init();
  }, [id, navigate, loadTranscript]);

  // Poll while processing
  useEffect(() => {
    if (!transcript) return;
    if (transcript.status === "processing" || transcript.status === "uploaded") {
      const interval = setInterval(async () => {
        const updated = await loadTranscript();
        if (updated?.status === "completed" || updated?.status === "failed") {
          clearInterval(interval);
        }
      }, 4000);
      setPollInterval(interval);
      return () => clearInterval(interval);
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript?.status]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryTranscript(id);
      toast.success("Retry started. Transcription is processing…");
      await loadTranscript();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not retry.");
    } finally {
      setRetrying(false);
    }
  };

  const handleAssignSave = async (speakerMap) => {
    setAssigning(true);
    try {
      await assignSpeakers(id, speakerMap);
      toast.success("Speaker assignment saved.");
      await loadTranscript();
      setShowAssignModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save assignment.");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <Loader label="Loading transcript" />;
  if (!interview) return null;

  const status = transcript?.status ?? "not_started";
  const statusUi = STATUS_UI[status] || STATUS_UI.not_started;
  const StatusIcon = statusUi.icon;
  const segments = transcript?.segments ?? [];
  const speakerMap = transcript?.speakerMap;

  // Determine if assignment is needed
  const hasUnassigned =
    speakerMap && Object.values(speakerMap).some((v) => v === null);

  return (
    <div>
      <Topbar
        onMenuClick={onMenuClick}
        title="Transcript"
        subtitle={interview.candidate_name}
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <Link
          to={ROUTES.interviewDetail(id)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to interview
        </Link>

        {/* ── Status card ─────────────────────────────────────────────── */}
        <div className="card-surface mb-5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <StatusIcon
                className={`h-4 w-4 ${statusUi.color} ${statusUi.spin ? "animate-spin" : ""}`}
              />
              <span className={`text-sm font-medium ${statusUi.color}`}>
                {statusUi.text}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status === "failed" && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FiRefreshCw}
                  isLoading={retrying}
                  onClick={handleRetry}
                >
                  Retry
                </Button>
              )}
              {status === "completed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FiUsers}
                  onClick={() => setShowAssignModal(true)}
                >
                  {hasUnassigned ? "Assign Speakers" : "Reassign Speakers"}
                </Button>
              )}
            </div>
          </div>

          {status === "failed" && transcript?.errorMessage && (
            <p className="mt-2 text-xs text-red-400/80">{transcript.errorMessage}</p>
          )}

          {status === "completed" && hasUnassigned && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Speaker labels are unassigned. Click "Assign Speakers" to identify who is the interviewer and who is the candidate.
            </div>
          )}
        </div>

        {/* ── Processing placeholder ──────────────────────────────────── */}
        {(status === "processing" || status === "uploaded") && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FiLoader className="h-8 w-8 animate-spin text-lav-400" />
            <p className="text-sm font-medium text-white/60">
              Transcription in progress — this may take a minute…
            </p>
            <p className="text-xs text-white/30">This page will update automatically.</p>
          </div>
        )}

        {/* ── Not started ─────────────────────────────────────────────── */}
        {status === "not_started" && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FiClock className="h-8 w-8 text-white/20" />
            <p className="text-sm text-white/50">
              No transcript available yet. Audio is uploaded automatically when the interview ends.
            </p>
          </div>
        )}

        {/* ── Segments ────────────────────────────────────────────────── */}
        {status === "completed" && segments.length > 0 && (
          <div className="space-y-3">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {segments.length} segment{segments.length !== 1 ? "s" : ""}
              </p>
              {transcript?.processedAt && (
                <p className="text-xs text-ink-400">
                  Generated {new Date(transcript.processedAt).toLocaleString()}
                </p>
              )}
            </div>
            {segments.map((seg, i) => (
              <SegmentCard key={seg.id ?? i} segment={seg} />
            ))}
          </div>
        )}

        {/* ── Empty transcript ────────────────────────────────────────── */}
        {status === "completed" && segments.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FiUser className="h-8 w-8 text-white/20" />
            <p className="text-sm text-white/50">
              The transcript is empty. The audio may have been silent or too short.
            </p>
          </div>
        )}
      </div>

      {/* ── Speaker Assignment Modal ────────────────────────────────── */}
      {showAssignModal && (
        <SpeakerAssignModal
          speakerMap={speakerMap ?? {}}
          onSave={handleAssignSave}
          onClose={() => setShowAssignModal(false)}
          isSaving={assigning}
        />
      )}
    </div>
  );
};

export default Transcript;
