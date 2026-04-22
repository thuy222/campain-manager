const express = require('express');

const router = express.Router();

const campaigns = [
  {
    id: '1',
    name: 'Spring Launch',
    status: 'active',
    budget: 5000,
    startDate: '2026-04-01',
    endDate: '2026-05-01',
  },
  {
    id: '2',
    name: 'Summer Promo',
    status: 'draft',
    budget: 2500,
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  },
];

router.get('/', (req, res) => {
  res.json(campaigns);
});

router.get('/:id', (req, res) => {
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.post('/', (req, res) => {
  const { name, status = 'draft', budget = 0, startDate, endDate } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const campaign = {
    id: String(campaigns.length + 1),
    name,
    status,
    budget,
    startDate,
    endDate,
  };
  campaigns.push(campaign);
  res.status(201).json(campaign);
});

router.put('/:id', (req, res) => {
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  campaigns[idx] = { ...campaigns[idx], ...req.body, id: campaigns[idx].id };
  res.json(campaigns[idx]);
});

router.delete('/:id', (req, res) => {
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  const [removed] = campaigns.splice(idx, 1);
  res.json(removed);
});

module.exports = router;
