import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useRegister } from "../hooks/useAuth";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const register = useRegister();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate({ email, name, password });
  };

  const fieldErrors = register.error?.details ?? {};

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
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email && (
              <small className="error-msg">{fieldErrors.email}</small>
            )}
          </label>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && (
              <small className="error-msg">{fieldErrors.name}</small>
            )}
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small className="muted">At least 8 characters.</small>
            {fieldErrors.password && (
              <small className="error-msg">{fieldErrors.password}</small>
            )}
          </label>
          {register.isError && !Object.keys(fieldErrors).length && (
            <p className="error-msg">{register.error.message}</p>
          )}
          <button
            type="submit"
            className="button"
            disabled={register.isPending}
          >
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
