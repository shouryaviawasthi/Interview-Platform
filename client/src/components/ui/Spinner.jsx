export const Spinner = ({ size = 20, className = "" }) => (
  <span
    className={`inline-block animate-spin rounded-full border-2 border-teal/25 border-t-teal ${className}`}
    style={{ width: size, height: size }}
    role="status"
    aria-label="Loading"
  />
);

export const PageSpinner = ({ label = "Loading…" }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-faint">
    <Spinner size={28} />
    <p className="text-sm">{label}</p>
  </div>
);

export const EmptyState = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
    <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
