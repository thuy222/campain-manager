import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useLogin } from "../hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <main className="app">
      <div className="card">
        <h1>Sign in</h1>
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
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {login.isError && (
            <p className="error-msg">{login.error.message}</p>
          )}
          <button
            type="submit"
            className="button"
            disabled={login.isPending}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </main>
  );
}
