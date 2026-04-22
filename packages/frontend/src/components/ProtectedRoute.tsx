import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "../hooks/useAuth";

export default function ProtectedRoute() {
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <main className="app">
        <p>Loading…</p>
      </main>
    );
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
