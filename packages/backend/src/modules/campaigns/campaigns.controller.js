const asyncHandler = require("../../lib/asyncHandler");

class CampaignsController {
  constructor(service) {
    this.service = service;
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(req.user.id, req.query);
    res.status(200).json(result);
  });

  create = asyncHandler(async (req, res) => {
    const campaign = await this.service.create(req.user.id, req.body);
    res.status(201).json({ data: campaign });
  });

  get = asyncHandler(async (req, res) => {
    const campaign = await this.service.get(req.user.id, req.params.id);
    res.status(200).json({ data: campaign });
  });

  update = asyncHandler(async (req, res) => {
    const campaign = await this.service.updateDraft(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: campaign });
  });

  remove = asyncHandler(async (req, res) => {
    await this.service.deleteDraft(req.user.id, req.params.id);
    res.status(204).end();
  });

  schedule = asyncHandler(async (req, res) => {
    const campaign = await this.service.schedule(req.user.id, req.params.id, req.body.scheduled_at);
    res.status(200).json({ data: campaign });
  });

  send = asyncHandler(async (req, res) => {
    const campaign = await this.service.send(req.user.id, req.params.id);
    res.status(200).json({ data: campaign });
  });

  stats = asyncHandler(async (req, res) => {
    const stats = await this.service.stats(req.user.id, req.params.id);
    res.status(200).json({ data: stats });
  });
}

module.exports = CampaignsController;
