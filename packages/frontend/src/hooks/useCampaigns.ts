import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignStats,
  listCampaigns,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
} from "../api/campaigns";
import type { ApiError } from "../lib/api";
import type {
  Campaign,
  CampaignStats,
  CreateCampaignInput,
  ListCampaignsQuery,
  ListMeta,
  ScheduleCampaignInput,
  UpdateCampaignInput,
} from "../types/campaign";

// Centralised key factory. Normalises the list query so callers can pass
// fields in any order / leave them undefined without creating duplicate
// cache entries.
export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  list: (q: ListCampaignsQuery) =>
    [
      ...campaignKeys.lists(),
      {
        page: q.page ?? 1,
        limit: q.limit ?? 20,
        status: q.status ?? null,
      },
    ] as const,
  detail: (id: string) => [...campaignKeys.all, "detail", id] as const,
  stats: (id: string) => [...campaignKeys.all, "detail", id, "stats"] as const,
};

export function useCampaignsList(query: ListCampaignsQuery) {
  return useQuery<{ items: Campaign[]; meta: ListMeta }, ApiError>({
    queryKey: campaignKeys.list(query),
    queryFn: () => listCampaigns(query),
    placeholderData: (prev) => prev,
  });
}

export function useCampaignDetail(id: string) {
  return useQuery<Campaign, ApiError>({
    queryKey: campaignKeys.detail(id),
    queryFn: () => getCampaign(id),
    enabled: Boolean(id),
  });
}

export function useCampaignStats(id: string) {
  return useQuery<CampaignStats, ApiError>({
    queryKey: campaignKeys.stats(id),
    queryFn: () => getCampaignStats(id),
    enabled: Boolean(id),
  });
}

function invalidateLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: campaignKeys.lists() });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation<Campaign, ApiError, CreateCampaignInput>({
    mutationFn: createCampaign,
    onSuccess: () => invalidateLists(qc),
  });
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<Campaign, ApiError, UpdateCampaignInput>({
    mutationFn: (patch) => updateCampaign(id, patch),
    onSuccess: (campaign) => {
      qc.setQueryData(campaignKeys.detail(id), campaign);
      invalidateLists(qc);
    },
  });
}

export function useDeleteCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => deleteCampaign(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: campaignKeys.detail(id) });
      qc.removeQueries({ queryKey: campaignKeys.stats(id) });
      invalidateLists(qc);
    },
  });
}

export function useScheduleCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<Campaign, ApiError, ScheduleCampaignInput>({
    mutationFn: (input) => scheduleCampaign(id, input),
    onSuccess: (campaign) => {
      qc.setQueryData(campaignKeys.detail(id), campaign);
      invalidateLists(qc);
    },
  });
}

export function useSendCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<Campaign, ApiError, void>({
    mutationFn: () => sendCampaign(id),
    onSuccess: (campaign) => {
      qc.setQueryData(campaignKeys.detail(id), campaign);
      qc.invalidateQueries({ queryKey: campaignKeys.stats(id) });
      invalidateLists(qc);
    },
  });
}
