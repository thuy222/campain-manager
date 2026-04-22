import { Outlet } from "react-router-dom";

import { useLogout } from "../hooks/useAuth";
import { useAuthStore } from "../stores/auth";

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="layout">
      <header className="navbar">
        <div className="navbar-brand">Campaign Manager</div>
        <div className="navbar-user">
          {user && <span className="navbar-name">{user.name}</span>}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <main className="app">
        <Outlet />
      </main>
    </div>
  );
}
