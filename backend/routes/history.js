import express from 'express';
import History from '../models/History.js';

const router = express.Router();

// GET all history logs
router.get('/', async (req, res) => {
  try {
    const history = await History.find({}).sort({ sentAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET history logs for a specific campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const history = await History.find({ campaignId: req.params.campaignId }).sort({ sentAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
