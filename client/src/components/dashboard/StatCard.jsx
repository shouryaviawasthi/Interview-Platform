const StatCard = ({ label, value, tone = "ink" }) => {
  const toneClass = tone === "amber" ? "text-amber" : tone === "teal" ? "text-teal" : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1.5 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
};

export default StatCard;
