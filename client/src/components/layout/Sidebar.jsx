import { NavLink } from "react-router-dom";
import { FiGrid, FiVideo, FiPlusCircle, FiLogOut } from "react-icons/fi";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../context/AuthContext";

const links = [
  { to: ROUTES.DASHBOARD, label: "Overview", icon: FiGrid },
  { to: ROUTES.INTERVIEWS, label: "Interviews", icon: FiVideo },
];

const Sidebar = ({ onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-ink-100 bg-white/70 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-600 text-white shadow-[0_8px_16px_-6px_rgba(110,89,232,0.6)]">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="13" r="5.5" fill="currentColor" />
            <path
              d="M6 27c0-6 4.5-9.5 10-9.5S26 21 26 27"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <p className="font-display text-base font-semibold leading-tight text-ink-900">Amble</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
            Interview Platform
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-lav-600 text-white shadow-[0_8px_16px_-8px_rgba(110,89,232,0.7)]"
                  : "text-ink-600 hover:bg-lav-100/80 hover:text-ink-900"
              }`
            }
            end={to === ROUTES.DASHBOARD}
          >
            <Icon className="h-4.5 w-4.5" />
            {label}
          </NavLink>
        ))}

        <NavLink
          to={ROUTES.INTERVIEW_NEW}
          onClick={onNavigate}
          className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-lav-300 px-3.5 py-2.5 text-sm font-semibold text-lav-700 hover:bg-lav-100/70 transition-colors"
        >
          <FiPlusCircle className="h-4.5 w-4.5" />
          Schedule interview
        </NavLink>
      </nav>

      <div className="border-t border-ink-100 px-3 py-4">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lav-100 font-display text-sm font-semibold text-lav-700">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-800">{user?.name}</p>
            <p className="truncate text-xs text-ink-400">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-500 hover:bg-[#FCE9EB] hover:text-[#D14D5B] transition-colors"
        >
          <FiLogOut className="h-4.5 w-4.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
