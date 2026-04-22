import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { useAuthStore } from "../stores/auth";

type Campaign = {
  id: string;
  name: string;
  status: string;
  budget: number;
  startDate: string;
  endDate: string;
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Campaign[]>("/campaigns")
      .then((data) => {
        if (!cancelled) setCampaigns(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h1>Welcome, {user?.name}</h1>
      <p className="muted">Signed in as {user?.email}</p>
      <h2>Campaigns</h2>
      {loading && <p>Loading…</p>}
      {error && <p className="error-msg">Failed to load: {error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td>${c.budget.toLocaleString()}</td>
                <td>{c.startDate}</td>
                <td>{c.endDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
