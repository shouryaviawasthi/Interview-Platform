const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-lav-200 bg-lav-50/60 px-6 py-16 text-center">
    {Icon && (
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lav-500 shadow-[var(--shadow-soft)]">
        <Icon className="h-6 w-6" />
      </span>
    )}
    <h3 className="font-display text-lg font-semibold text-ink-800">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState;
