import { Link } from "react-router-dom";
import { FiArrowRight, FiUsers, FiFileText, FiRadio } from "react-icons/fi";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: FiUsers,
    title: "Shareable join links",
    body: "Every interview gets a unique candidate link — no accounts, no friction, just click and join.",
  },
  {
    icon: FiRadio,
    title: "Live room presence",
    body: "See who's connected in real time over Socket.IO, from the waiting room to the wrap-up.",
  },
  {
    icon: FiFileText,
    title: "Resume parsing",
    body: "Upload a PDF resume and the platform extracts the text automatically, ready for review.",
  },
];

const Landing = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-lav-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to={ROUTES.HOME} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lav-600 text-white">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="13" r="5.5" fill="currentColor" />
              <path d="M6 27c0-6 4.5-9.5 10-9.5S26 21 26 27" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold text-ink-900">Amble</span>
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link to={ROUTES.DASHBOARD}>
              <span className="rounded-xl bg-lav-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_16px_-8px_rgba(110,89,232,0.7)] hover:bg-lav-700 transition-colors">
                Go to dashboard
              </span>
            </Link>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} className="text-sm font-medium text-ink-600 hover:text-ink-900">
                Sign in
              </Link>
              <Link to={ROUTES.REGISTER}>
                <span className="rounded-xl bg-lav-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_16px_-8px_rgba(110,89,232,0.7)] hover:bg-lav-700 transition-colors">
                  Get started
                </span>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center animate-rise-in">
          <span className="inline-flex items-center gap-2 rounded-full bg-lav-100 px-3.5 py-1.5 text-xs font-semibold text-lav-700">
            <span className="h-1.5 w-1.5 rounded-full bg-lav-600" />
            Now scheduling technical &amp; behavioral interviews
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">
            Interviews that run themselves, so you can focus on the conversation.
          </h1>
          <p className="mt-5 text-base text-ink-500 sm:text-lg">
            Schedule an interview, send one link, and watch the room fill in real time.
            Amble handles the logistics&mdash;resumes, join tokens, live status&mdash;while
            you focus on asking good questions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={isAuthenticated ? ROUTES.INTERVIEW_NEW : ROUTES.REGISTER}>
              <span className="inline-flex items-center gap-2 rounded-xl bg-lav-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(110,89,232,0.7)] hover:bg-lav-700 transition-colors">
                Schedule your first interview
                <FiArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link to={ROUTES.LOGIN}>
              <span className="rounded-xl border border-ink-100 bg-white px-6 py-3 text-sm font-semibold text-ink-700 hover:border-lav-300 transition-colors">
                Sign in
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="card-surface animate-rise-in p-6"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lav-100 text-lav-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-400">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Landing;
