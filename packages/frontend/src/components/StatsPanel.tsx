import type { CampaignStats } from "../types/campaign";

type Props = { stats: CampaignStats };

function formatRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export default function StatsPanel({ stats }: Props) {
  return (
    <div className="stats-panel">
      <div className="stats-grid">
        <Figure label="Total" value={stats.total} />
        <Figure label="Sent" value={stats.sent} />
        <Figure label="Failed" value={stats.failed} />
        <Figure label="Opened" value={stats.opened} />
      </div>
      <Bar label="Send rate" value={stats.send_rate} />
      <Bar label="Open rate" value={stats.open_rate} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="stats-figure">
      <div className="stats-label">{label}</div>
      <div className="stats-value">{value}</div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="stats-rate">
      <div className="stats-rate-head">
        <span>{label}</span>
        <span>{formatRate(pct)}</span>
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
