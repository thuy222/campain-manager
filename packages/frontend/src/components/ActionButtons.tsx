import type { CampaignStatus } from "../types/campaign";

type Props = {
  status: CampaignStatus;
  onEdit: () => void;
  onSchedule: () => void;
  onSend: () => void;
  onDelete: () => void;
  busy?: boolean;
};

export default function ActionButtons({
  status,
  onEdit,
  onSchedule,
  onSend,
  onDelete,
  busy,
}: Props) {
  if (status === "sent") {
    return <p className="muted">This campaign has been sent and is now frozen.</p>;
  }

  const isDraft = status === "draft";
  const isScheduled = status === "scheduled";

  return (
    <div className="action-row">
      {isDraft && (
        <button type="button" className="button button-muted" onClick={onEdit} disabled={busy}>
          Edit
        </button>
      )}
      {isDraft && (
        <button type="button" className="button button-muted" onClick={onSchedule} disabled={busy}>
          Schedule
        </button>
      )}
      {(isDraft || isScheduled) && (
        <button type="button" className="button" onClick={onSend} disabled={busy}>
          Send
        </button>
      )}
      {isDraft && (
        <button type="button" className="button button-danger" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      )}
    </div>
  );
}
