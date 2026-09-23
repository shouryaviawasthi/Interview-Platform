import { useEffect, useRef } from "react";
import { formatDuration } from "../../utils/formatters";

/**
 * Reads like an actual transcript (consistent left alignment, top to
 * bottom) rather than a chat app's alternating bubbles — the speaker
 * color + label is what carries who's-talking, since that's the thing
 * that actually needs distinguishing.
 */
const TranscriptFeed = ({ rows, emptyHint, autoScroll = true }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rows.length, autoScroll]);

  if (!rows || rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-faint">
        {emptyHint || "The transcript will appear here as the conversation happens."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-4">
      {rows.map((row, idx) => {
        const isInterviewer = row.speaker === "interviewer";
        return (
          <div key={row.id || idx} className="flex gap-3">
            <div className={`mt-0.5 w-1 shrink-0 self-stretch rounded-full ${isInterviewer ? "bg-teal" : "bg-amber"}`} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 text-xs">
                <span className={`font-semibold uppercase tracking-wide ${isInterviewer ? "text-teal-deep" : "text-amber"}`}>
                  {isInterviewer ? "Interviewer" : "Candidate"}
                </span>
                <span className="font-mono text-ink-faint">{formatDuration(row.time_offset_seconds)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink">{row.transcript_text}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default TranscriptFeed;
