export const CompetencyBars = ({ items }) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-ink-faint italic">No competency breakdown available.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.skill}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink">{item.skill}</span>
            <span className="font-mono text-ink-soft">{Math.round(item.score)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-teal transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }}
            />
          </div>
          {item.justification && <p className="mt-1 text-xs text-ink-faint">{item.justification}</p>}
        </div>
      ))}
    </div>
  );
};

export const BulletList = ({ items, emptyText = "None noted.", tone = "teal" }) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-ink-faint italic">{emptyText}</p>;
  }
  const dotClass = tone === "red" ? "bg-red" : tone === "amber" ? "bg-amber" : "bg-teal";
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-sm text-ink-soft">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};
