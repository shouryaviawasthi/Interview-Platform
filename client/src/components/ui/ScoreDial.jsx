const TONE_COLORS = {
  teal: "var(--color-teal)",
  amber: "var(--color-amber)",
  green: "var(--color-green)",
  red: "var(--color-red)",
};

/**
 * A circular "signal meter" — the same visual idea as the live waveform,
 * but showing a settled reading instead of a moving one. Used both in
 * the web report views and echoed in the PDF export.
 */
const ScoreDial = ({ score, tone = "teal", size = 128, label }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const clamped = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;
  const offset = clamped === null ? circumference : circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="10" />
          {clamped !== null && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={TONE_COLORS[tone] || TONE_COLORS.teal}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold text-ink">{clamped === null ? "—" : Math.round(clamped)}</span>
          <span className="text-[11px] text-ink-faint">/ 100</span>
        </div>
      </div>
      {label && <span className="mt-2 text-sm font-medium text-ink-soft text-center">{label}</span>}
    </div>
  );
};

export default ScoreDial;
