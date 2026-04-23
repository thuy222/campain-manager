import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";

import authReducer from "../store/authSlice";
import campaignsUiReducer from "../store/campaignsUiSlice";

type Options = {
  route?: string;
  path?: string;
};

export function renderWithProviders(
  ui: ReactElement,
  { route = "/campaigns/new", path = "/campaigns/new" }: Options = {},
) {
  const store = configureStore({
    reducer: { auth: authReducer, campaignsUi: campaignsUiReducer },
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="/" element={<div data-testid="home-probe" />} />
            <Route path="/campaigns" element={<div data-testid="campaigns-list-probe" />} />
            <Route path="/campaigns/:id" element={<div data-testid="campaign-detail-probe" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );

  return { ...utils, store, queryClient };
}
