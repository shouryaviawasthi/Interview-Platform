import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { ROUTES } from "../constants/routes";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-lav-50 px-6 text-center">
    <p className="font-display text-6xl font-semibold text-lav-300">404</p>
    <h1 className="mt-3 font-display text-xl font-semibold text-ink-900">Page not found</h1>
    <p className="mt-1.5 max-w-sm text-sm text-ink-400">
      The page you're looking for doesn't exist or may have moved.
    </p>
    <Link
      to={ROUTES.HOME}
      className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-lav-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lav-700 transition-colors"
    >
      <FiArrowLeft className="h-4 w-4" />
      Back home
    </Link>
  </div>
);

export default NotFound;
