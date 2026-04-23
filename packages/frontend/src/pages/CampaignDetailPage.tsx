import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ZodError } from "zod";

import ActionButtons from "../components/ActionButtons";
import StatsPanel from "../components/StatsPanel";
import StatusBadge from "../components/StatusBadge";
import {
  useCampaignDetail,
  useCampaignStats,
  useDeleteCampaign,
  useScheduleCampaign,
  useSendCampaign,
  useUpdateCampaign,
} from "../hooks/useCampaigns";
import {
  updateCampaignSchema,
  zodIssuesToFieldErrors,
} from "../validation/campaign";

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function fromLocalDatetimeInput(value: string): string {
  // The <input type="datetime-local"> value is naive local time. new Date()
  // interprets it in the browser's TZ, and toISOString() converts to UTC with
  // a "Z" offset — satisfies the server's "explicit offset" requirement.
  return new Date(value).toISOString();
}

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

  if (detail.isLoading) return <p>Loading…</p>;
  if (detail.isError || !detail.data) {
    return (
      <section>
        <p className="error-msg">{detail.error?.message ?? "Not found"}</p>
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
        <EditForm
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
        <ScheduleForm
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
          {stats.isLoading && <p>Loading stats…</p>}
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
          {send.isError && <p className="error-msg">{send.error.message}</p>}
          {remove.isError && <p className="error-msg">{remove.error.message}</p>}
        </>
      )}
    </section>
  );
}

type EditFormProps = {
  campaign: {
    name: string;
    subject: string;
    body: string;
  };
  busy: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  onCancel: () => void;
  onSubmit: (patch: {
    name?: string;
    subject?: string;
    body?: string;
    recipients?: string[];
  }) => void;
};

function EditForm({ campaign, busy, error, fieldErrors = {}, onCancel, onSubmit }: EditFormProps) {
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [body, setBody] = useState(campaign.body);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const merged = { ...fieldErrors, ...clientErrors };

  const clearError = (key: string) =>
    setClientErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  return (
    <form
      className="form form-wide"
      onSubmit={(e) => {
        e.preventDefault();
        const patch: {
          name?: string;
          subject?: string;
          body?: string;
        } = {};
        if (name !== campaign.name) patch.name = name;
        if (subject !== campaign.subject) patch.subject = subject;
        if (body !== campaign.body) patch.body = body;
        if (Object.keys(patch).length === 0) {
          setClientErrors({ _: "No changes to save" });
          return;
        }
        try {
          const parsed = updateCampaignSchema.parse(patch);
          setClientErrors({});
          onSubmit(parsed);
        } catch (err) {
          if (err instanceof ZodError) {
            setClientErrors(zodIssuesToFieldErrors(err));
            return;
          }
          throw err;
        }
      }}
    >
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
          }}
        />
        {merged.name && <small className="error-msg">{merged.name}</small>}
      </label>
      <label className="field">
        <span>Subject</span>
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            clearError("subject");
          }}
        />
        {merged.subject && (
          <small className="error-msg">{merged.subject}</small>
        )}
      </label>
      <label className="field">
        <span>Body</span>
        <textarea
          rows={6}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            clearError("body");
          }}
        />
        {merged.body && <small className="error-msg">{merged.body}</small>}
      </label>
      {merged._ && <p className="error-msg">{merged._}</p>}
      {error && !Object.keys(merged).length && (
        <p className="error-msg">{error}</p>
      )}
      <div className="action-row">
        <button type="button" className="button button-muted" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

type ScheduleFormProps = {
  busy: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  onCancel: () => void;
  onSubmit: (scheduledAtIso: string) => void;
};

function ScheduleForm({ busy, error, fieldErrors = {}, onCancel, onSubmit }: ScheduleFormProps) {
  const defaultLocal = toLocalDatetimeInputValue(new Date(Date.now() + 60 * 60 * 1000));
  const [value, setValue] = useState(defaultLocal);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <form
      className="form form-wide"
      onSubmit={(e) => {
        e.preventDefault();
        const when = new Date(value);
        if (Number.isNaN(when.getTime())) {
          setLocalError("Please pick a valid date and time.");
          return;
        }
        if (when.getTime() <= Date.now()) {
          setLocalError("Scheduled time must be in the future.");
          return;
        }
        setLocalError(null);
        onSubmit(fromLocalDatetimeInput(value));
      }}
    >
      <label className="field">
        <span>Scheduled for</span>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        {fieldErrors.scheduled_at && (
          <small className="error-msg">{fieldErrors.scheduled_at}</small>
        )}
        {localError && <small className="error-msg">{localError}</small>}
      </label>
      {error && !Object.keys(fieldErrors).length && <p className="error-msg">{error}</p>}
      <div className="action-row">
        <button type="button" className="button button-muted" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Scheduling…" : "Schedule"}
        </button>
      </div>
    </form>
  );
}
