const StatCard = ({ label, value, icon: Icon, tone = "lavender" }) => {
  const tones = {
    lavender: "bg-lav-600 text-white",
    soft: "bg-white text-ink-900 border border-ink-100",
  };

  return (
    <div className={`rounded-2xl p-5 shadow-[var(--shadow-soft)] ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "lavender" ? "text-lav-100" : "text-ink-400"}`}>
          {label}
        </p>
        {Icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              tone === "lavender" ? "bg-white/15" : "bg-lav-100 text-lav-600"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
};

export default StatCard;
