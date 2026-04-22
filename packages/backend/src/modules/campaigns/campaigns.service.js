class CampaignsService {
  constructor() {
    this.campaigns = [
      {
        id: "1",
        name: "Spring Launch",
        status: "active",
        budget: 5000,
        startDate: "2026-04-01",
        endDate: "2026-05-01",
      },
      {
        id: "2",
        name: "Summer Promo",
        status: "draft",
        budget: 2500,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
    ];
  }

  list() {
    return this.campaigns;
  }

  getById(id) {
    return this.campaigns.find((c) => c.id === id) || null;
  }

  create({ name, status = "draft", budget = 0, startDate, endDate }) {
    const campaign = {
      id: String(this.campaigns.length + 1),
      name,
      status,
      budget,
      startDate,
      endDate,
    };
    this.campaigns.push(campaign);
    return campaign;
  }

  update(id, patch) {
    const idx = this.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.campaigns[idx] = {
      ...this.campaigns[idx],
      ...patch,
      id: this.campaigns[idx].id,
    };
    return this.campaigns[idx];
  }

  delete(id) {
    const idx = this.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const [removed] = this.campaigns.splice(idx, 1);
    return removed;
  }
}

module.exports = CampaignsService;
