import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CampaignNewPage from "./CampaignNewPage";
import { renderWithProviders } from "../test/renderWithProviders";
import { buildFetchMock, jsonResponse } from "../test/fetchMock";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name$/i), "Spring Promo");
  await user.type(screen.getByLabelText(/^subject$/i), "Big news");
  await user.type(screen.getByLabelText(/^body$/i), "Hello there");
  await user.type(screen.getByLabelText(/recipients/i), "alice@example.com\nbob@example.com");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignNewPage — create campaign flow", () => {
  it("normalizes recipients, POSTs to /api/campaigns, and navigates to the detail page", async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    const fetchSpy = buildFetchMock({
      "POST /api/campaigns": async (init) => {
        capturedBody = JSON.parse(init!.body as string);
        return jsonResponse(201, {
          data: {
            id: "new-campaign-id",
            name: "Spring Promo",
            subject: "Big news",
            body: "Hello there",
            status: "draft",
            scheduled_at: null,
            created_by: "user-id",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            recipient_count: 2,
          },
        });
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignNewPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId("campaign-detail-probe")).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(capturedBody).toEqual({
      name: "Spring Promo",
      subject: "Big news",
      body: "Hello there",
      recipients: ["alice@example.com", "bob@example.com"],
    });
  });

  it("dedupes and lowercases recipient emails before submitting", async () => {
    const user = userEvent.setup();
    const captured: { body?: { recipients: string[] } } = {};

    const fetchSpy = buildFetchMock({
      "POST /api/campaigns": async (init) => {
        captured.body = JSON.parse(init!.body as string);
        return jsonResponse(201, {
          data: {
            id: "c1",
            name: "n",
            subject: "s",
            body: "b",
            status: "draft",
            scheduled_at: null,
            created_by: "u",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            recipient_count: 2,
          },
        });
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignNewPage />);

    await user.type(screen.getByLabelText(/^name$/i), "n");
    await user.type(screen.getByLabelText(/^subject$/i), "s");
    await user.type(screen.getByLabelText(/^body$/i), "b");
    await user.type(
      screen.getByLabelText(/recipients/i),
      "Alice@Example.com\nalice@example.com\nBOB@example.com",
    );
    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => {
      expect(screen.getByTestId("campaign-detail-probe")).toBeInTheDocument();
    });

    expect(captured.body?.recipients).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("surfaces server 422 field errors inline and stays on the form", async () => {
    const user = userEvent.setup();

    const fetchSpy = buildFetchMock({
      "POST /api/campaigns": async () =>
        jsonResponse(422, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request",
            details: { recipients: "At least one recipient required" },
          },
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignNewPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => {
      expect(screen.getByText("At least one recipient required")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("campaign-detail-probe")).toBeNull();
  });

  it("blocks submission client-side when required fields are empty", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignNewPage />);

    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Subject is required")).toBeInTheDocument();
    expect(screen.getByText("Body is required")).toBeInTheDocument();
    expect(screen.getByText("At least one recipient required")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
