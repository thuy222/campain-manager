import { useEffect, useState } from 'react';

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setCampaigns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="app">
      <h1>Mini Campaign Manager</h1>
      {loading && <p>Loading…</p>}
      {error && <p className="error">Failed to load: {error}</p>}
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
    </main>
  );
}
