import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

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

const LIST_KEY = ["campaigns"] as const;
const detailKey = (id: string) => ["campaigns", id] as const;
const statsKey = (id: string) => ["campaigns", id, "stats"] as const;

export function useCampaignsList(query: ListCampaignsQuery) {
  return useQuery<{ items: Campaign[]; meta: ListMeta }, ApiError>({
    queryKey: [...LIST_KEY, query],
    queryFn: () => listCampaigns(query),
    placeholderData: (prev) => prev,
  });
}

export function useCampaignDetail(id: string) {
  return useQuery<Campaign, ApiError>({
    queryKey: detailKey(id),
    queryFn: () => getCampaign(id),
    enabled: Boolean(id),
  });
}

export function useCampaignStats(id: string) {
  return useQuery<CampaignStats, ApiError>({
    queryKey: statsKey(id),
    queryFn: () => getCampaignStats(id),
    enabled: Boolean(id),
  });
}

function invalidateLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
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
      qc.setQueryData(detailKey(id), campaign);
      invalidateLists(qc);
    },
  });
}

export function useDeleteCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => deleteCampaign(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: detailKey(id) });
      qc.removeQueries({ queryKey: statsKey(id) });
      invalidateLists(qc);
    },
  });
}

export function useScheduleCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<Campaign, ApiError, ScheduleCampaignInput>({
    mutationFn: (input) => scheduleCampaign(id, input),
    onSuccess: (campaign) => {
      qc.setQueryData(detailKey(id), campaign);
      invalidateLists(qc);
    },
  });
}

export function useSendCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation<Campaign, ApiError, void>({
    mutationFn: () => sendCampaign(id),
    onSuccess: (campaign) => {
      qc.setQueryData(detailKey(id), campaign);
      qc.invalidateQueries({ queryKey: statsKey(id) });
      invalidateLists(qc);
    },
  });
}
