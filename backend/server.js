import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB, { getConnectionError, dbReady } from './config/db.js';
import seedDatabase from './config/seed.js';
import mongoose from 'mongoose';
import { inMemoryCampaigns, inMemoryCandidates } from './routes/campaigns.js';


// Route imports
import companyRoutes from './routes/companies.js';
import campaignRoutes from './routes/campaigns.js';
import templateRoutes from './routes/templates.js';
import historyRoutes from './routes/history.js';
import emailRoutes from './routes/email.js';

dotenv.config();

// Start DB asynchronously (no await) – it will set dbReady when connected
connectDB().then(() => seedDatabase()).catch(console.error);


const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger SVG logos or CSVs

// API Routes
app.use('/api/companies', companyRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/email', emailRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('TalentDraft API is running...');
});

// New ready endpoint for frontend to know when DB is connected
app.get('/api/ready', (req, res) => {
  res.json({ ready: dbReady.value });
});

// Diagnostics endpoint
app.get('/api/debug-state', (req, res) => {
  const rawUri = process.env.MONGO_URI || '';
  const maskedUri = rawUri.replace(/:([^@]+)@/, ':****@');
  res.json({
    mongooseReadyState: mongoose.connection.readyState,
    mongooseHost: mongoose.connection.host,
    mongooseError: getConnectionError(),
    inMemoryCampaignsCount: inMemoryCampaigns.length,
    inMemoryCandidatesCount: inMemoryCandidates.length,
    hasMongoUri: !!process.env.MONGO_URI,
    mongoUri: maskedUri || 'NOT_SET'
  });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
