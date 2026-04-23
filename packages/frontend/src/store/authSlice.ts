import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

type AuthState = {
  user: User | null;
};

const initialState: AuthState = { user: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    clearUser(state) {
      state.user = null;
    },
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;
