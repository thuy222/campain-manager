import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ActionButtons from "../components/ActionButtons";
import ErrorAlert from "../components/ErrorAlert";
import { SkeletonDetail, SkeletonStats } from "../components/Skeleton";
import StatsPanel from "../components/StatsPanel";
import StatusBadge from "../components/StatusBadge";
import EditCampaignForm from "../components/campaign-detail/EditCampaignForm";
import ScheduleCampaignForm from "../components/campaign-detail/ScheduleCampaignForm";
import {
  useCampaignDetail,
  useCampaignStats,
  useDeleteCampaign,
  useScheduleCampaign,
  useSendCampaign,
  useUpdateCampaign,
} from "../hooks/useCampaigns";

export default function CampaignDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const detail = useCampaignDetail(id);
  const stats = useCampaignStats(id);
  const update = useUpdateCampaign(id);
  const send = useSendCampaign(id);
  const remove = useDeleteCampaign(id);
  const schedule = useScheduleCampaign(id);

  const [mode, setMode] = useState<"view" | "edit" | "schedule">("view");

  if (detail.isLoading) {
    return (
      <section>
        <SkeletonDetail />
      </section>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <section>
        <ErrorAlert error={detail.error} fallback="Not found" />
        <button className="button button-muted" onClick={() => navigate("/campaigns")}>
          Back to campaigns
        </button>
      </section>
    );
  }

  const campaign = detail.data;

  const busy = update.isPending || send.isPending || remove.isPending || schedule.isPending;

  return (
    <section>
      <div className="page-head">
        <div>
          <StatusBadge status={campaign.status} />
          <h1 style={{ marginTop: "0.25rem" }}>{campaign.name}</h1>
        </div>
        <button className="button button-muted" onClick={() => navigate("/campaigns")}>
          Back
        </button>
      </div>

      {mode === "edit" ? (
        <EditCampaignForm
          campaign={campaign}
          busy={update.isPending}
          error={update.error?.message}
          fieldErrors={update.error?.details}
          onCancel={() => {
            update.reset();
            setMode("view");
          }}
          onSubmit={(patch) =>
            update.mutate(patch, {
              onSuccess: () => setMode("view"),
            })
          }
        />
      ) : mode === "schedule" ? (
        <ScheduleCampaignForm
          busy={schedule.isPending}
          error={schedule.error?.message}
          fieldErrors={schedule.error?.details}
          onCancel={() => {
            schedule.reset();
            setMode("view");
          }}
          onSubmit={(scheduled_at) =>
            schedule.mutate({ scheduled_at }, { onSuccess: () => setMode("view") })
          }
        />
      ) : (
        <>
          <dl className="detail-grid">
            <dt>Subject</dt>
            <dd>{campaign.subject}</dd>
            <dt>Body</dt>
            <dd className="body-preview">{campaign.body}</dd>
            <dt>Recipients</dt>
            <dd>{campaign.recipient_count}</dd>
            {campaign.scheduled_at && (
              <>
                <dt>Scheduled</dt>
                <dd>{new Date(campaign.scheduled_at).toLocaleString()}</dd>
              </>
            )}
            <dt>Created</dt>
            <dd>{new Date(campaign.created_at).toLocaleString()}</dd>
          </dl>

          <h2>Stats</h2>
          {stats.isLoading && <SkeletonStats />}
          {stats.data && <StatsPanel stats={stats.data} />}
          {stats.isError && (
            <p className="error-msg">Failed to load stats: {stats.error.message}</p>
          )}

          <h2>Actions</h2>
          <ActionButtons
            status={campaign.status}
            busy={busy}
            onEdit={() => setMode("edit")}
            onSchedule={() => setMode("schedule")}
            onSend={() =>
              send.mutate(undefined, {
                onSuccess: () => setMode("view"),
              })
            }
            onDelete={() => {
              if (window.confirm(`Delete campaign "${campaign.name}"?`)) {
                remove.mutate(undefined, {
                  onSuccess: () => navigate("/campaigns"),
                });
              }
            }}
          />
          <ErrorAlert error={send.error} />
          <ErrorAlert error={remove.error} />
        </>
      )}
    </section>
  );
}
