import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiMic, FiMicOff, FiPhoneOff, FiUsers, FiWifiOff } from "react-icons/fi";
import { useInterviewSocket } from "../../hooks/useInterviewSocket";
import { useMicRecorder } from "../../hooks/useMicRecorder";
import { interviewApi } from "../../lib/api";
import Button from "../ui/Button";
import Waveform from "../ui/Waveform";
import StatusPill from "../ui/StatusPill";
import TranscriptFeed from "./TranscriptFeed";
import { formatDuration, truncate } from "../../utils/formatters";

/**
 * The live interview room, shared by the interviewer and candidate pages.
 * Both sides run the exact same mic-capture + live-transcript logic —
 * the only real difference is that the "End interview" control only
 * renders for the interviewer.
 */
const InterviewRoom = ({ interviewId, session, role, onEnded }) => {
  const isInterviewer = role === "interviewer";
  const [transcript, setTranscript] = useState([]);
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const wasConnectedRef = useRef(false);
  const uploadFailureStreakRef = useRef(0);

  const handleTranscriptChunk = useCallback((row) => {
    setTranscript((prev) => {
      if (row.id && prev.some((r) => r.id === row.id)) return prev; // guard against any accidental duplicate delivery
      return [...prev, row];
    });
  }, []);

  const handleInterviewEnded = useCallback(
    (payload) => {
      // The interviewer already gets a toast + navigation from their own
      // handleEnd() call below — this broadcast is for the *other*
      // participant, who didn't take the action themselves.
      if (!isInterviewer) {
        toast.success(payload?.reportReady ? "Interview ended — your report is ready." : "Interview ended.");
      }
      onEnded?.(payload);
    },
    [onEnded, isInterviewer]
  );

  const { connected, roomState, interviewMeta, socketError } = useInterviewSocket(interviewId, session, {
    onTranscriptChunk: handleTranscriptChunk,
    onInterviewEnded: handleInterviewEnded,
  });

  // Seed the transcript once from REST so a mid-interview refresh (or a
  // late join) doesn't start with a blank feed.
  useEffect(() => {
    let cancelled = false;
    interviewApi
      .getTranscript(session, interviewId)
      .then((res) => {
        if (!cancelled) setTranscript(res.transcript || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTranscriptLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId, session]);

  // Resync after a reconnect (not the initial connect) — anything
  // broadcast while the socket was down would otherwise be missed.
  useEffect(() => {
    if (connected && wasConnectedRef.current === false && transcriptLoaded) {
      interviewApi
        .getTranscript(session, interviewId)
        .then((res) => setTranscript(res.transcript || []))
        .catch(() => {});
    }
    wasConnectedRef.current = connected;
  }, [connected, interviewId, session, transcriptLoaded]);

  const handleChunk = useCallback(
    async (blob, mimeType, elapsedSeconds) => {
      try {
        await interviewApi.postTranscriptChunk(session, interviewId, blob, elapsedSeconds);
        uploadFailureStreakRef.current = 0;
      } catch (err) {
        uploadFailureStreakRef.current += 1;
        // Chunks upload every few seconds — only surface a toast on the
        // first miss in a streak, so a rough patch doesn't spam alerts.
        if (uploadFailureStreakRef.current === 1) {
          toast.error(err.message || "A moment of audio couldn't be transcribed.");
        }
      }
    },
    [interviewId, session]
  );

  const mic = useMicRecorder({ onChunk: handleChunk });
  const micStartedRef = useRef(false);
  useEffect(() => {
    if (!micStartedRef.current) {
      micStartedRef.current = true;
      mic.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live elapsed timer, ticking from the server-stamped start time so
  // both participants' clocks agree regardless of when each one's tab
  // happened to load.
  useEffect(() => {
    if (!interviewMeta?.startedAt) return undefined;
    const startedAtMs = new Date(interviewMeta.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [interviewMeta?.startedAt]);

  const handleEnd = async () => {
    if (!window.confirm("End this interview? This can't be undone, and your report will be generated right after.")) {
      return;
    }
    setEnding(true);
    try {
      mic.stop();
      const res = await interviewApi.end(session, interviewId);
      toast.success(res.reportGenerated ? "Interview ended and report generated." : "Interview ended — report generation is still catching up.");
      onEnded?.({ reportReady: res.reportGenerated });
    } catch (err) {
      toast.error(err.message || "Couldn't end the interview.");
      setEnding(false);
    }
  };

  const interviewerPresent = roomState.participants.some((p) => p.role === "interviewer");
  const candidatePresent = roomState.participants.some((p) => p.role === "candidate");
  const waitingOn = isInterviewer ? !candidatePresent : !interviewerPresent;

  return (
    <div className="flex h-screen flex-col bg-ink text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{interviewMeta?.candidateName || "Interview"}</p>
          <p className="truncate text-sm text-white/50">{truncate(interviewMeta?.jobDescription, 60)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/70 sm:inline-flex">
            <FiUsers size={14} /> {roomState.participantCount}
          </span>
          <span className="font-mono text-sm text-white/70">{formatDuration(elapsed)}</span>
          <StatusPill status="live" />
        </div>
      </div>

      {!connected && (
        <div className="flex items-center justify-center gap-2 bg-amber-soft px-4 py-2 text-sm font-medium text-amber">
          <FiWifiOff size={14} /> {socketError || "Reconnecting to the interview room…"}
        </div>
      )}

      {/* Main content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-white/10 lg:grid-cols-[360px_1fr]">
        {/* Mic panel */}
        <div className="flex flex-col items-center justify-center gap-6 bg-ink px-6 py-10">
          <Waveform active={mic.isLive} size="lg" />
          <div className="text-center">
            <p className="text-sm font-medium text-white">
              {mic.status === "error" ? "Microphone unavailable" : mic.status === "muted" ? "Muted" : mic.status === "requesting" ? "Requesting microphone…" : "Live — listening"}
            </p>
            {mic.error && <p className="mt-1 max-w-[240px] text-xs text-red-300">{mic.error}</p>}
            {waitingOn && !mic.error && (
              <p className="mt-1 text-xs text-white/50">Waiting for the {isInterviewer ? "candidate" : "interviewer"} to join…</p>
            )}
          </div>
          <button
            onClick={() => mic.setMuted(mic.status !== "muted")}
            disabled={mic.status === "error" || mic.status === "requesting"}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              mic.status === "muted" ? "bg-white/10 text-white hover:bg-white/20" : "bg-amber text-ink hover:bg-amber/90"
            }`}
            aria-label={mic.status === "muted" ? "Unmute microphone" : "Mute microphone"}
            title={mic.status === "muted" ? "Unmute" : "Mute"}
          >
            {mic.status === "muted" ? <FiMicOff size={20} /> : <FiMic size={20} />}
          </button>

          {isInterviewer && (
            <Button variant="danger" onClick={handleEnd} loading={ending} className="mt-4">
              <FiPhoneOff size={16} /> End interview
            </Button>
          )}
        </div>

        {/* Transcript */}
        <div className="min-h-0 bg-paper text-ink">
          <TranscriptFeed rows={transcript} emptyHint="Once the conversation starts, the live transcript will appear here." />
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;
