import { FiMenu } from "react-icons/fi";

const Topbar = ({ onMenuClick, title, subtitle, actions }) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-ink-100 bg-lav-50/80 backdrop-blur-xl px-4 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-ink-600 hover:bg-lav-100 lg:hidden"
          aria-label="Open menu"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </header>
  );
};

export default Topbar;
