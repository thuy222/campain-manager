import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RegisterPage from "./RegisterPage";
import { renderWithProviders } from "../test/renderWithProviders";
import { buildFetchMock, jsonResponse } from "../test/fetchMock";

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RegisterPage — sign-up flow", () => {
  it("blocks the API call when inputs fail client-side validation", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<RegisterPage />, {
      route: "/register",
      path: "/register",
    });

    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/name/i), "Demo");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByText("Must be a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("registers with valid input and navigates home", async () => {
    const user = userEvent.setup();
    const captured: { body?: { email: string; name: string; password: string } } = {};

    const fetchSpy = buildFetchMock({
      "POST /api/auth/register": async (init) => {
        captured.body = JSON.parse(init!.body as string);
        return jsonResponse(201, {
          data: {
            id: "u-1",
            email: captured.body!.email,
            name: captured.body!.name,
            created_at: new Date().toISOString(),
          },
        });
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(<RegisterPage />, {
      route: "/register",
      path: "/register",
    });

    await user.type(screen.getByLabelText(/email/i), "demo@example.com");
    await user.type(screen.getByLabelText(/name/i), "Demo User");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByTestId("home-probe")).toBeInTheDocument();
    });
    expect(captured.body).toEqual({
      email: "demo@example.com",
      name: "Demo User",
      password: "password123",
    });
  });
});
