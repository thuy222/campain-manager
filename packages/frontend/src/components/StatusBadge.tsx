import type { CampaignStatus } from "../types/campaign";

type Props = { status: CampaignStatus };

const STATUS_CLASS: Record<CampaignStatus, string> = {
  draft: "badge badge-draft",
  scheduled: "badge badge-scheduled",
  sent: "badge badge-sent",
};

export default function StatusBadge({ status }: Props) {
  return <span className={STATUS_CLASS[status]}>{status}</span>;
}
