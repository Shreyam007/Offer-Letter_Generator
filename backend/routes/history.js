import express from 'express';
import mongoose from 'mongoose';
import History from '../models/History.js';

const router = express.Router();

// GET all history logs
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Returning empty history array.');
    return res.json([]);
  }

  try {
    const history = await History.find({}).sort({ sentAt: -1 }).lean();
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET history logs for a specific campaign
router.get('/campaign/:campaignId', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Returning empty history array for campaign.');
    return res.json([]);
  }

  try {
    const history = await History.find({ campaignId: req.params.campaignId }).sort({ sentAt: -1 }).lean();
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
