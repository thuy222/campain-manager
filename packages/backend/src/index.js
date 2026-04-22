require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const campaignsRouter = require('./routes/campaigns');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'campaign-manager-backend' });
});

app.use('/api/campaigns', campaignsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
