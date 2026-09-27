export interface CampaignRun {
  id: string;
  name: string;
  templateName: string;
  segment: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  estimatedCostUSD: number;
  status: "completed" | "running" | "failed";
  createdAt: string;
}

export const initialCampaignRuns: CampaignRun[] = [
  {
    id: "camp_1",
    name: "Q4 Enterprise Follow-up",
    templateName: "reengage_24h_window_expired",
    segment: "leads",
    totalRecipients: 84,
    sentCount: 84,
    deliveredCount: 83,
    readCount: 71,
    failedCount: 1,
    estimatedCostUSD: 6.3,
    status: "completed",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "camp_2",
    name: "Flash Sale VIP Announcement",
    templateName: "flash_sale_announcement",
    segment: "customers",
    totalRecipients: 166,
    sentCount: 166,
    deliveredCount: 164,
    readCount: 142,
    failedCount: 2,
    estimatedCostUSD: 12.45,
    status: "completed",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

let localCampaigns: CampaignRun[] = [...initialCampaignRuns];

export class CampaignStore {
  public static getAll(): CampaignRun[] {
    return localCampaigns;
  }

  public static add(run: Omit<CampaignRun, "id" | "createdAt">): CampaignRun {
    const newRun: CampaignRun = {
      ...run,
      id: `camp_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    localCampaigns.unshift(newRun);
    return newRun;
  }
}
