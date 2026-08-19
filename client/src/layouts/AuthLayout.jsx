import { Link } from "react-router-dom";
import { FiCheck } from "react-icons/fi";
import { ROUTES } from "../constants/routes";

const perks = [
  "Schedule interviews and share a join link in one click",
  "Live room presence so you know exactly who's connected",
  "Resumes parsed automatically the moment they're uploaded",
];

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / hero panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 px-12 py-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(140,116,236,0.55) 0%, transparent 45%), radial-gradient(circle at 80% 85%, rgba(88,66,195,0.5) 0%, transparent 50%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <Link to={ROUTES.HOME} className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-500/90">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="13" r="5.5" fill="white" />
              <path
                d="M6 27c0-6 4.5-9.5 10-9.5S26 21 26 27"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold">Amble</span>
        </Link>

        <div className="relative max-w-md">
          <p className="font-display text-3xl font-semibold leading-tight text-white">
            Run interviews that feel calm on both sides of the call.
          </p>
          <ul className="mt-8 space-y-4">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-lav-100/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lav-500/30">
                  <FiCheck className="h-3 w-3" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-lav-200/60">
          &copy; {new Date().getFullYear()} Amble Interview Platform
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-lav-50 px-6 py-12">
        <div className="w-full max-w-sm animate-rise-in">
          <div className="mb-8 lg:hidden">
            <Link to={ROUTES.HOME} className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-600 text-white">
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
              <span className="font-display text-lg font-semibold text-ink-900">Amble</span>
            </Link>
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-ink-400">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
