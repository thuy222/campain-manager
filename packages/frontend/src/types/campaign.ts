export type CampaignStatus = "draft" | "scheduled" | "sent";

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  recipient_count: number;
  recipients?: string[];
};

export type CampaignStats = {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  open_rate: number;
  send_rate: number;
};

export type ListMeta = {
  page: number;
  limit: number;
  total: number;
};

export type CreateCampaignInput = {
  name: string;
  subject: string;
  body: string;
  recipients: string[];
};

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

export type ScheduleCampaignInput = {
  scheduled_at: string;
};

export type ListCampaignsQuery = {
  page?: number;
  limit?: number;
  status?: CampaignStatus;
};
