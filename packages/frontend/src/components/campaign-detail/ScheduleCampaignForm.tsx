import { useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function fromLocalDatetimeInput(value: string): string {
  // <input type="datetime-local"> is naive local time; toISOString() converts
  // it to UTC with a trailing "Z" — satisfies the server's explicit-offset rule.
  return new Date(value).toISOString();
}

type ScheduleFormProps = {
  busy: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  onCancel: () => void;
  onSubmit: (scheduledAtIso: string) => void;
};

export default function ScheduleCampaignForm({
  busy,
  error,
  fieldErrors = {},
  onCancel,
  onSubmit,
}: ScheduleFormProps) {
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
