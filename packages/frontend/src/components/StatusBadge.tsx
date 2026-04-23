import type { CampaignStatus } from "../types/campaign";

type Props = { status: CampaignStatus };

export default function StatusBadge({ status }: Props) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}
