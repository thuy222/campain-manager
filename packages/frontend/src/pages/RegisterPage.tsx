import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ZodError } from "zod";

import { useRegister } from "../hooks/useAuth";
import { registerSchema } from "../validation/auth";
import { zodIssuesToFieldErrors } from "../validation/campaign";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const register = useRegister();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const parsed = registerSchema.parse({ email, name, password });
      setClientErrors({});
      register.mutate(parsed);
    } catch (err) {
      if (err instanceof ZodError) {
        setClientErrors(zodIssuesToFieldErrors(err));
        return;
      }
      throw err;
    }
  };

  const clearError = (key: string) =>
    setClientErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const serverErrors = register.error?.details ?? {};
  const fieldErrors = { ...serverErrors, ...clientErrors };

  return (
    <main className="app">
      <div className="card">
        <h1>Create account</h1>
        <form className="form" onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
              }}
            />
            {fieldErrors.email && <small className="error-msg">{fieldErrors.email}</small>}
          </label>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
            />
            {fieldErrors.name && <small className="error-msg">{fieldErrors.name}</small>}
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
            />
            <small className="muted">At least 8 characters.</small>
            {fieldErrors.password && <small className="error-msg">{fieldErrors.password}</small>}
          </label>
          {register.isError && !Object.keys(fieldErrors).length && (
            <p className="error-msg">{register.error.message}</p>
          )}
          <button type="submit" className="button" disabled={register.isPending}>
            {register.isPending ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
