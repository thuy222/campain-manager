class CampaignsController {
  constructor(service) {
    this.service = service;
  }

  list = (req, res) => {
    res.json(this.service.list());
  };

  getById = (req, res) => {
    const campaign = this.service.getById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  };

  create = (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const campaign = this.service.create(req.body);
    res.status(201).json(campaign);
  };

  update = (req, res) => {
    const campaign = this.service.update(req.params.id, req.body || {});
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  };

  remove = (req, res) => {
    const campaign = this.service.delete(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  };
}

module.exports = CampaignsController;
