import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type CampaignStatusFilter = "all" | "draft" | "scheduled" | "sent";

type CampaignsUiState = {
  statusFilter: CampaignStatusFilter;
  page: number;
  limit: number;
};

const initialState: CampaignsUiState = {
  statusFilter: "all",
  page: 1,
  limit: 20,
};

const campaignsUiSlice = createSlice({
  name: "campaignsUi",
  initialState,
  reducers: {
    setStatusFilter(state, action: PayloadAction<CampaignStatusFilter>) {
      state.statusFilter = action.payload;
      state.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
    },
  },
});

export const { setStatusFilter, setPage } = campaignsUiSlice.actions;
export default campaignsUiSlice.reducer;
