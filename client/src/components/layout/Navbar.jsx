import { Link, useNavigate } from "react-router-dom";
import { FiLogOut, FiPlus } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../utils/formatters";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-amber animate-pulse" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Interview Signal</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <Link
              to="/interviews/new"
              className="hidden items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-deep sm:inline-flex"
            >
              <FiPlus size={16} /> New interview
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-soft text-xs font-semibold text-teal-deep">
                {initials(user.name)}
              </span>
              <span className="hidden text-ink-soft sm:inline">{user.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-black/5 hover:text-ink"
              aria-label="Log out"
              title="Log out"
            >
              <FiLogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
