import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
    <p className="font-display text-5xl font-semibold text-ink">404</p>
    <p className="text-sm text-ink-soft">That page doesn't exist.</p>
    <Link to="/" className="mt-3">
      <Button variant="secondary">Go home</Button>
    </Link>
  </div>
);

export default NotFoundPage;
