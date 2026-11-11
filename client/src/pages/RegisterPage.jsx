import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Couldn't create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-amber animate-pulse" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-soft">Set up interviews and get AI-generated feedback.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Name</span>
            <input
              type="text"
              name="name"
              required
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-teal"
              placeholder="Jordan Lee"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-teal"
              placeholder="you@company.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-teal"
              placeholder="At least 6 characters"
            />
          </label>
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-teal hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
