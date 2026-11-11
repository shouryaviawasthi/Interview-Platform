const BAR_COUNT = 5;

/**
 * A small equalizer-style indicator: pulsing amber bars while the mic is
 * live, a flat quiet line while muted. Purely decorative/status — the
 * accessible state is carried by the aria-label, not the animation.
 */
const Waveform = ({ active = false, size = "md" }) => {
  const containerHeight = size === "sm" ? "h-4" : "h-8";

  return (
    <div
      className={`flex items-end justify-center gap-1 ${containerHeight}`}
      role="img"
      aria-label={active ? "Microphone live" : "Microphone muted"}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          className={`w-1 origin-bottom rounded-full ${active ? "bg-amber animate-waveform" : "bg-ink-faint/30"}`}
          style={{
            height: "100%",
            animationDelay: `${i * 0.11}s`,
            transform: active ? undefined : "scaleY(0.25)",
          }}
        />
      ))}
    </div>
  );
};

export default Waveform;
