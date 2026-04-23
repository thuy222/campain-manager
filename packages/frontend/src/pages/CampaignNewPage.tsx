import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ZodError } from "zod";

import ErrorAlert from "../components/ErrorAlert";
import { useCreateCampaign } from "../hooks/useCampaigns";
import {
  MAX_RECIPIENTS,
  createCampaignSchema,
  zodIssuesToFieldErrors,
} from "../validation/campaign";

function parseRecipients(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/[\n,]/)) {
    const email = line.trim().toLowerCase();
    if (!email) continue;
    if (!seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

function resolveRecipientsError(errors: Record<string, string>): string | undefined {
  // Zod array-item errors arrive keyed like "recipients.0" (path joined by
  // `.`). Resolve "recipients" to include any nested item error.
  return (
    errors.recipients ?? Object.entries(errors).find(([k]) => k.startsWith("recipients."))?.[1]
  );
}

export default function CampaignNewPage() {
  const navigate = useNavigate();
  const create = useCreateCampaign();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientsInput, setRecipientsInput] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const recipients = useMemo(() => parseRecipients(recipientsInput), [recipientsInput]);

  // Client-side errors take precedence over server-side errors so the user
  // sees validation feedback the instant they hit submit without waiting for
  // the round-trip.
  const serverErrors = create.error?.details ?? {};
  const fieldErrors = { ...serverErrors, ...clientErrors };
  const recipientsError = resolveRecipientsError(fieldErrors);
  const hasVisibleFieldError = Boolean(
    fieldErrors.name || fieldErrors.subject || fieldErrors.body || recipientsError,
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = { name, subject, body, recipients };
    try {
      const parsed = createCampaignSchema.parse(input);
      setClientErrors({});
      create.mutate(parsed, {
        onSuccess: (campaign) => navigate(`/campaigns/${campaign.id}`),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        setClientErrors(zodIssuesToFieldErrors(err));
        return;
      }
      throw err;
    }
  };

  const onFieldChange =
    <T,>(setter: (v: T) => void, key: string) =>
    (value: T) => {
      setter(value);
      if (clientErrors[key]) {
        setClientErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    };

  return (
    <section>
      <h1>New campaign</h1>
      <form className="form form-wide" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onFieldChange(setName, "name")(e.target.value)}
            maxLength={255}
          />
          {fieldErrors.name && <small className="error-msg">{fieldErrors.name}</small>}
        </label>
        <label className="field">
          <span>Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => onFieldChange(setSubject, "subject")(e.target.value)}
            maxLength={255}
          />
          {fieldErrors.subject && <small className="error-msg">{fieldErrors.subject}</small>}
        </label>
        <label className="field">
          <span>Body</span>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => onFieldChange(setBody, "body")(e.target.value)}
          />
          {fieldErrors.body && <small className="error-msg">{fieldErrors.body}</small>}
        </label>
        <label className="field">
          <span>Recipients — one per line (normalized, deduped, max {MAX_RECIPIENTS})</span>
          <textarea
            rows={6}
            value={recipientsInput}
            onChange={(e) => {
              setRecipientsInput(e.target.value);
              // Clear any recipient error (including nested recipients.N keys).
              setClientErrors((prev) => {
                const next: Record<string, string> = {};
                for (const [k, v] of Object.entries(prev)) {
                  if (k !== "recipients" && !k.startsWith("recipients.")) {
                    next[k] = v;
                  }
                }
                return next;
              });
            }}
            placeholder="alice@example.com&#10;bob@example.com"
          />
          <small className="muted">
            {recipients.length} unique email{recipients.length === 1 ? "" : "s"}
            {recipients.length > MAX_RECIPIENTS && ` (exceeds ${MAX_RECIPIENTS})`}
          </small>
          {recipientsError && <small className="error-msg">{recipientsError}</small>}
        </label>

        {!hasVisibleFieldError && <ErrorAlert error={create.error} />}

        <div className="action-row">
          <button
            type="button"
            className="button button-muted"
            onClick={() => navigate("/campaigns")}
            disabled={create.isPending}
          >
            Cancel
          </button>
          <button type="submit" className="button" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </form>
    </section>
  );
}
