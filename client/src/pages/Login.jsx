import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiMail, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "../layouts/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { ROUTES } from "../constants/routes";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const next = {};
    if (!form.email) next.email = "Email is required";
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(form);
      toast.success("Welcome back!");
      const redirectTo = location.state?.from || ROUTES.DASHBOARD;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to manage your interviews">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email address"
          name="email"
          type="email"
          icon={FiMail}
          placeholder="you@company.com"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          icon={FiLock}
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full" isLoading={submitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-400">
        New to Amble?{" "}
        <Link to={ROUTES.REGISTER} className="font-semibold text-lav-600 hover:text-lav-700">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
