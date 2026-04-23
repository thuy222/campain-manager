import { Link } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import { useCampaignsList } from "../hooks/useCampaigns";
import { useAppDispatch, useAppSelector } from "../store";
import { setPage, setStatusFilter, type CampaignStatusFilter } from "../store/campaignsUiSlice";
import type { CampaignStatus } from "../types/campaign";

const FILTERS: CampaignStatusFilter[] = ["all", "draft", "scheduled", "sent"];

export default function CampaignsListPage() {
  const dispatch = useAppDispatch();
  const { statusFilter, page, limit } = useAppSelector((s) => s.campaignsUi);

  const query = {
    page,
    limit,
    status: statusFilter === "all" ? undefined : (statusFilter as CampaignStatus),
  };

  const { data, isLoading, isError, error } = useCampaignsList(query);

  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / limit)) : 1;

  return (
    <section>
      <div className="page-head">
        <h1>Campaigns</h1>
        <Link to="/campaigns/new" className="button">
          New campaign
        </Link>
      </div>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${f === statusFilter ? "chip-active" : ""}`}
            onClick={() => dispatch(setStatusFilter(f))}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="error-msg">Failed to load: {error.message}</p>}

      {data && data.items.length === 0 && (
        <div className="empty-state">
          <p>You don't have any campaigns yet.</p>
          <Link to="/campaigns/new" className="button">
            Create your first campaign
          </Link>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Scheduled</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/campaigns/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{c.recipient_count}</td>
                  <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "—"}</td>
                  <td>{new Date(c.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              type="button"
              className="button button-muted"
              onClick={() => dispatch(setPage(page - 1))}
              disabled={page <= 1 || isLoading}
            >
              Prev
            </button>
            <span className="muted">
              Page {page} of {totalPages} · {data.meta.total} total
            </span>
            <button
              type="button"
              className="button button-muted"
              onClick={() => dispatch(setPage(page + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
