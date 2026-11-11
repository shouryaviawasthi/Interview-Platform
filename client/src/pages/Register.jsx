import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiUser, FiMail, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "../layouts/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { ROUTES } from "../constants/routes";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const next = {};
    if (!form.name) next.name = "Name is required";
    if (!form.email) next.email = "Email is required";
    if (!form.password) next.password = "Password is required";
    else if (form.password.length < 6) next.password = "Use at least 6 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({ ...form, role: "interviewer" });
      toast.success("Account created — you're in!");
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Could not create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start scheduling interviews in minutes">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Full name"
          name="name"
          icon={FiUser}
          placeholder="Ada Lovelace"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          autoComplete="name"
        />
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
          placeholder="At least 6 characters"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" isLoading={submitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-400">
        Already have an account?{" "}
        <Link to={ROUTES.LOGIN} className="font-semibold text-lav-600 hover:text-lav-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
