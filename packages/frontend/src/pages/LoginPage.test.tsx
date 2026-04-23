import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LoginPage from "./LoginPage";
import { renderWithProviders } from "../test/renderWithProviders";
import { buildFetchMock, jsonResponse } from "../test/fetchMock";

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage — sign-in flow", () => {
  it("signs in with valid credentials, seeds the auth user in Redux, and redirects home", async () => {
    const user = userEvent.setup();
    const captured: { body?: { email: string; password: string } } = {};

    const fetchSpy = buildFetchMock({
      "POST /api/auth/login": async (init) => {
        captured.body = JSON.parse(init!.body as string);
        return jsonResponse(200, {
          data: {
            id: "u-1",
            email: "demo@example.com",
            name: "Demo User",
            created_at: new Date().toISOString(),
          },
        });
      },
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { store } = renderWithProviders(<LoginPage />, {
      route: "/login",
      path: "/login",
    });

    await user.type(screen.getByLabelText(/email/i), "demo@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("home-probe")).toBeInTheDocument();
    });

    expect(captured.body).toEqual({
      email: "demo@example.com",
      password: "password123",
    });
    expect(store.getState().auth.user).toEqual(
      expect.objectContaining({ id: "u-1", email: "demo@example.com" }),
    );
  });

  it("shows the server error on 401 and does not navigate away", async () => {
    const user = userEvent.setup();

    const fetchSpy = buildFetchMock({
      "POST /api/auth/login": async () =>
        jsonResponse(401, {
          error: {
            code: "AUTH_FAILED",
            message: "Invalid email or password",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { store } = renderWithProviders(<LoginPage />, {
      route: "/login",
      path: "/login",
    });

    await user.type(screen.getByLabelText(/email/i), "demo@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("home-probe")).toBeNull();
    expect(store.getState().auth.user).toBeNull();
  });
});
