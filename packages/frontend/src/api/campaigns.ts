import { api, apiWithMeta } from "../lib/api";
import type {
  Campaign,
  CampaignStats,
  CreateCampaignInput,
  ListCampaignsQuery,
  ListMeta,
  ScheduleCampaignInput,
  UpdateCampaignInput,
} from "../types/campaign";

function toQueryString(query: ListCampaignsQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.status !== undefined) params.set("status", query.status);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listCampaigns(
  query: ListCampaignsQuery = {},
): Promise<{ items: Campaign[]; meta: ListMeta }> {
  const { data, meta } = await apiWithMeta<Campaign[], ListMeta>(
    `/campaigns${toQueryString(query)}`,
  );
  return { items: data, meta };
}

export function getCampaign(id: string): Promise<Campaign> {
  return api<Campaign>(`/campaigns/${id}`);
}

export function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return api<Campaign>("/campaigns", { method: "POST", body: input });
}

export function updateCampaign(
  id: string,
  patch: UpdateCampaignInput,
): Promise<Campaign> {
  return api<Campaign>(`/campaigns/${id}`, { method: "PATCH", body: patch });
}

export function deleteCampaign(id: string): Promise<void> {
  return api<void>(`/campaigns/${id}`, { method: "DELETE" });
}

export function scheduleCampaign(
  id: string,
  input: ScheduleCampaignInput,
): Promise<Campaign> {
  return api<Campaign>(`/campaigns/${id}/schedule`, {
    method: "POST",
    body: input,
  });
}

export function sendCampaign(id: string): Promise<Campaign> {
  return api<Campaign>(`/campaigns/${id}/send`, { method: "POST" });
}

export function getCampaignStats(id: string): Promise<CampaignStats> {
  return api<CampaignStats>(`/campaigns/${id}/stats`);
}
