import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CampaignDetailPage from "./CampaignDetailPage";
import { renderWithProviders } from "../test/renderWithProviders";
import { buildFetchMock, jsonResponse } from "../test/fetchMock";
import type { Campaign } from "../types/campaign";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";

function draftCampaign(): Campaign {
  return {
    id: CAMPAIGN_ID,
    name: "Spring Promo",
    subject: "Big news",
    body: "Hello there",
    status: "draft",
    scheduled_at: null,
    created_by: "u-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    recipient_count: 3,
  };
}

function emptyStats() {
  return {
    total: 3,
    sent: 0,
    failed: 0,
    opened: 0,
    send_rate: 0,
    open_rate: 0,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDatetimeLocalValue(date: Date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CampaignDetailPage — schedule flow", () => {
  it("POSTs a future datetime as ISO-8601 with a timezone offset and flips the campaign to scheduled", async () => {
    const user = userEvent.setup();
    const captured: { body?: { scheduled_at: string } } = {};
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    let currentCampaign: Campaign = draftCampaign();

    const fetchSpy = buildFetchMock({
      [`GET /api/campaigns/${CAMPAIGN_ID}`]: async () =>
        jsonResponse(200, { data: currentCampaign }),
      [`GET /api/campaigns/${CAMPAIGN_ID}/stats`]: async () =>
        jsonResponse(200, { data: emptyStats() }),
      [`POST /api/campaigns/${CAMPAIGN_ID}/schedule`]: async (init) => {
        captured.body = JSON.parse(init!.body as string);
        currentCampaign = {
          ...draftCampaign(),
          status: "scheduled",
          scheduled_at: future.toISOString(),
        };
        return jsonResponse(200, { data: currentCampaign });
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignDetailPage />, {
      route: `/campaigns/${CAMPAIGN_ID}`,
      path: "/campaigns/:id",
    });

    await user.click(await screen.findByRole("button", { name: "Schedule" }));

    const datetimeInput = await screen.findByLabelText(/scheduled for/i);
    fireEvent.change(datetimeInput, {
      target: { value: toDatetimeLocalValue(future) },
    });

    await user.click(screen.getByRole("button", { name: "Schedule" }));

    await waitFor(() => {
      expect(captured.body?.scheduled_at).toBeDefined();
    });
    expect(captured.body!.scheduled_at).toMatch(/(Z|[+-]\d{2}:\d{2})$/);

    await waitFor(() => {
      expect(screen.getByText("scheduled")).toBeInTheDocument();
    });
  });

  it("rejects a past datetime client-side without calling the schedule endpoint", async () => {
    const user = userEvent.setup();

    const fetchSpy = buildFetchMock({
      [`GET /api/campaigns/${CAMPAIGN_ID}`]: async () =>
        jsonResponse(200, { data: draftCampaign() }),
      [`GET /api/campaigns/${CAMPAIGN_ID}/stats`]: async () =>
        jsonResponse(200, { data: emptyStats() }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignDetailPage />, {
      route: `/campaigns/${CAMPAIGN_ID}`,
      path: "/campaigns/:id",
    });

    await user.click(await screen.findByRole("button", { name: "Schedule" }));

    const datetimeInput = await screen.findByLabelText(/scheduled for/i);
    fireEvent.change(datetimeInput, { target: { value: "2020-01-01T12:00" } });

    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByText(/must be in the future/i)).toBeInTheDocument();

    const postCalls = fetchSpy.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
  });

  it("surfaces a server 409 state conflict inline without navigating away", async () => {
    const user = userEvent.setup();
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const fetchSpy = buildFetchMock({
      [`GET /api/campaigns/${CAMPAIGN_ID}`]: async () =>
        jsonResponse(200, { data: draftCampaign() }),
      [`GET /api/campaigns/${CAMPAIGN_ID}/stats`]: async () =>
        jsonResponse(200, { data: emptyStats() }),
      [`POST /api/campaigns/${CAMPAIGN_ID}/schedule`]: async () =>
        jsonResponse(409, {
          error: {
            code: "STATE_CONFLICT",
            message: "only draft campaigns can be scheduled",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<CampaignDetailPage />, {
      route: `/campaigns/${CAMPAIGN_ID}`,
      path: "/campaigns/:id",
    });

    await user.click(await screen.findByRole("button", { name: "Schedule" }));

    const datetimeInput = await screen.findByLabelText(/scheduled for/i);
    fireEvent.change(datetimeInput, {
      target: { value: toDatetimeLocalValue(future) },
    });

    await user.click(screen.getByRole("button", { name: "Schedule" }));

    expect(await screen.findByText(/only draft campaigns can be scheduled/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument();
  });
});
