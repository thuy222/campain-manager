import { useState } from "react";
import { ZodError } from "zod";

import { updateCampaignSchema, zodIssuesToFieldErrors } from "../../validation/campaign";

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

export default function EditCampaignForm({
  campaign,
  busy,
  error,
  fieldErrors = {},
  onCancel,
  onSubmit,
}: EditFormProps) {
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
        {merged.subject && <small className="error-msg">{merged.subject}</small>}
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
      {error && !Object.keys(merged).length && <p className="error-msg">{error}</p>}
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
