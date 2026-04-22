import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../lib/api";
import { useAuthStore, type User } from "../stores/auth";

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery<User | null, ApiError>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const user = await api<User>("/auth/me");
        setUser(user);
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  return useMutation<User, ApiError, { email: string; password: string }>({
    mutationFn: (body) => api<User>("/auth/login", { method: "POST", body }),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(["me"], user);
      navigate("/");
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  return useMutation<
    User,
    ApiError,
    { email: string; name: string; password: string }
  >({
    mutationFn: (body) => api<User>("/auth/register", { method: "POST", body }),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(["me"], user);
      navigate("/");
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      clear();
      qc.setQueryData(["me"], null);
      qc.removeQueries({ queryKey: ["me"] });
      navigate("/login");
    },
  });
}
