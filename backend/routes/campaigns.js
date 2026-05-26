import express from 'express';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import Candidate from '../models/Candidate.js';
import History from '../models/History.js';
import { inMemoryCompanies } from './companies.js';
import { inMemoryTemplates } from './templates.js';

const router = express.Router();

// Local in-memory store for campaigns and candidates
const inMemoryCampaigns = [];
const inMemoryCandidates = [];

// Helper to filter in-memory candidates in-place to preserve references
const filterInMemoryCandidates = (predicate) => {
  for (let i = inMemoryCandidates.length - 1; i >= 0; i--) {
    if (!predicate(inMemoryCandidates[i])) {
      inMemoryCandidates.splice(i, 1);
    }
  }
};

// Helper to populate in-memory campaign
const populateCampaign = (camp) => {
  const targetCompanyId = typeof camp.companyId === 'object' ? camp.companyId._id : camp.companyId;
  const targetTemplateId = typeof camp.templateId === 'object' ? camp.templateId._id : camp.templateId;
  
  const comp = inMemoryCompanies.find(c => c._id === targetCompanyId);
  const temp = inMemoryTemplates.find(t => t._id === targetTemplateId);
  
  return { ...camp, companyId: comp || camp.companyId, templateId: temp || camp.templateId };
};

// GET all campaigns with their details
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Returning in-memory campaigns.');
    const populated = inMemoryCampaigns.map(populateCampaign);
    return res.json(populated);
  }

  try {
    const campaigns = await Campaign.find({})
      .populate('companyId')
      .populate('templateId')
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns from DB:', error);
    // Fall back to memory
    const populated = inMemoryCampaigns.map(populateCampaign);
    res.json(populated);
  }
});

// POST a new campaign
router.post('/', async (req, res) => {
  const { name, companyId, templateId } = req.body;

  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Creating campaign in memory.');
    const campaign = {
      _id: 'mock-campaign-' + Date.now(),
      name,
      companyId,
      templateId,
      status: 'Draft',
      totalCount: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString()
    };
    inMemoryCampaigns.push(campaign);
    return res.status(201).json(campaign);
  }

  try {
    const campaign = new Campaign({
      name,
      companyId,
      templateId,
      status: 'Draft'
    });
    const createdCampaign = await campaign.save();
    res.status(201).json(createdCampaign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET campaign by ID
router.get('/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Finding campaign in memory by ID.');
    const campaign = inMemoryCampaigns.find(c => c._id === req.params.id);
    if (campaign) {
      return res.json(populateCampaign(campaign));
    } else {
      return res.status(404).json({ message: 'Campaign not found' });
    }
  }

  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('companyId')
      .populate('templateId');
    if (campaign) {
      res.json(campaign);
    } else {
      res.status(404).json({ message: 'Campaign not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE a campaign
router.delete('/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Deleting campaign and data from memory.');
    const index = inMemoryCampaigns.findIndex(c => c._id === req.params.id);
    if (index !== -1) {
      inMemoryCampaigns.splice(index, 1);
      filterInMemoryCandidates(c => c.campaignId !== req.params.id);
      return res.json({ message: 'Campaign and associated data removed' });
    } else {
      return res.status(404).json({ message: 'Campaign not found' });
    }
  }

  try {
    const campaign = await Campaign.findById(req.params.id);
    if (campaign) {
      // Delete candidates and history as well
      await Candidate.deleteMany({ campaignId: req.params.id });
      await History.deleteMany({ campaignId: req.params.id });
      await Campaign.deleteOne({ _id: req.params.id });
      res.json({ message: 'Campaign and associated data removed' });
    } else {
      res.status(404).json({ message: 'Campaign not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET candidates of a campaign
router.get('/:id/candidates', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Getting candidates from memory.');
    const filtered = inMemoryCandidates.filter(c => c.campaignId === req.params.id);
    return res.json(filtered);
  }

  try {
    const candidates = await Candidate.find({ campaignId: req.params.id });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST batch upload candidates for a campaign
router.post('/:id/candidates', async (req, res) => {
  const campaignId = req.params.id;
  const candidatesData = req.body; // Expects array of candidate objects

  if (mongoose.connection.readyState !== 1) {
    try {
      console.log('Database offline: Uploading candidates to memory.');
      const campaign = inMemoryCampaigns.find(c => c._id === campaignId);
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Clear existing candidates
      filterInMemoryCandidates(c => c.campaignId !== campaignId);

      // Map and insert
      const mapped = candidatesData.map(c => {
        if (!c) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailVal = c.email || '';
        const isValidEmail = emailRegex.test(emailVal.trim());
        const status = isValidEmail ? 'Validated' : 'Invalid Email';

        const name = c.name || '';
        const email = emailVal;
        const role = c.Role || c.role || '';
        const department = c.Organization || c.department || '';
        const salary = ''; 
        const joiningDate = c['Start Date'] || c.joiningDate || '';

        const customFields = {};
        Object.keys(c).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (!['name', 'email', 'role', 'department', 'salary', 'joining date', 'joiningdate', 'start date'].includes(lowerKey)) {
            customFields[key] = c[key] ? c[key].toString() : '';
          }
        });

        return {
          _id: 'mock-cand-' + Math.random().toString(36).substr(2, 9),
          campaignId,
          name,
          email,
          role,
          department,
          salary,
          joiningDate,
          status,
          customFields
        };
      }).filter(c => c !== null);

      inMemoryCandidates.push(...mapped);

      // Update campaign metrics
      campaign.totalCount = mapped.length;
      campaign.sentCount = 0;
      campaign.failedCount = 0;

      return res.status(201).json(mapped);
    } catch (err) {
      console.error('Error in offline upload candidates:', err);
      return res.status(500).json({ message: err.message });
    }
  }

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Delete existing candidates if overwriting (optional, let's keep clean)
    await Candidate.deleteMany({ campaignId });

    // Map and insert
    const candidates = candidatesData.map(c => {
      if (!c) return null;
      // Standard email regex validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailVal = c.email || '';
      const isValidEmail = emailRegex.test(emailVal.trim());
      const status = isValidEmail ? 'Validated' : 'Invalid Email';

      // Map fields strictly to schema
      const name = c.name || '';
      const email = emailVal;
      const role = c.Role || c.role || '';
      const department = c.Organization || c.department || '';
      const salary = ''; // No salary column in strict format, leave empty
      const joiningDate = c['Start Date'] || c.joiningDate || '';

      // Any remaining fields put in customFields
      const customFields = {};
      Object.keys(c).forEach(key => {
        const lowerKey = key.toLowerCase();
        // Exclude properties mapped to top-level fields
        if (!['name', 'email', 'role', 'department', 'salary', 'joining date', 'joiningdate', 'start date'].includes(lowerKey)) {
          customFields[key] = c[key] ? c[key].toString() : '';
        }
      });

      return {
        campaignId,
        name,
        email,
        role,
        department,
        salary,
        joiningDate,
        status,
        customFields
      };
    }).filter(c => c !== null);

    const inserted = await Candidate.insertMany(candidates);

    // Update campaign totalCount
    campaign.totalCount = inserted.length;
    campaign.sentCount = 0;
    campaign.failedCount = 0;
    await campaign.save();

    res.status(201).json(inserted);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST create a single candidate (Add Row)
router.post('/candidates', async (req, res) => {
  const { campaignId, name, email, role, department, salary, joiningDate, customFields } = req.body;

  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Creating candidate in memory.');
    const campaign = inMemoryCampaigns.find(c => c._id === campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(email);
    const status = isValidEmail ? 'Validated' : 'Invalid Email';

    const candidate = {
      _id: 'mock-cand-' + Math.random().toString(36).substr(2, 9),
      campaignId,
      name,
      email,
      role,
      department,
      salary,
      joiningDate,
      status,
      customFields: customFields || {}
    };

    inMemoryCandidates.push(candidate);
    campaign.totalCount += 1;

    return res.status(201).json(candidate);
  }

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(email);
    const status = isValidEmail ? 'Validated' : 'Invalid Email';

    const candidate = new Candidate({
      campaignId,
      name,
      email,
      role,
      department,
      salary,
      joiningDate,
      status,
      customFields: customFields || {}
    });

    const savedCandidate = await candidate.save();

    // Increment campaign totalCount
    campaign.totalCount += 1;
    await campaign.save();

    res.status(201).json(savedCandidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update inline candidate details
router.put('/candidates/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Updating candidate details in memory.');
    const candidate = inMemoryCandidates.find(c => c._id === req.params.id);
    if (candidate) {
      candidate.name = req.body.name || candidate.name;
      candidate.email = req.body.email || candidate.email;
      candidate.role = req.body.role !== undefined ? req.body.role : candidate.role;
      candidate.department = req.body.department !== undefined ? req.body.department : candidate.department;
      candidate.salary = req.body.salary !== undefined ? req.body.salary : candidate.salary;
      candidate.joiningDate = req.body.joiningDate !== undefined ? req.body.joiningDate : candidate.joiningDate;
      candidate.customFields = req.body.customFields !== undefined ? req.body.customFields : candidate.customFields;

      // Re-validate email on change
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = emailRegex.test(candidate.email);
      candidate.status = isValidEmail ? 'Validated' : 'Invalid Email';

      return res.json(candidate);
    } else {
      return res.status(404).json({ message: 'Candidate not found' });
    }
  }

  try {
    const candidate = await Candidate.findById(req.params.id);
    if (candidate) {
      candidate.name = req.body.name || candidate.name;
      candidate.email = req.body.email || candidate.email;
      candidate.role = req.body.role !== undefined ? req.body.role : candidate.role;
      candidate.department = req.body.department !== undefined ? req.body.department : candidate.department;
      candidate.salary = req.body.salary !== undefined ? req.body.salary : candidate.salary;
      candidate.joiningDate = req.body.joiningDate !== undefined ? req.body.joiningDate : candidate.joiningDate;
      candidate.customFields = req.body.customFields !== undefined ? req.body.customFields : candidate.customFields;

      // Re-validate email on change
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = emailRegex.test(candidate.email);
      candidate.status = isValidEmail ? 'Validated' : 'Invalid Email';

      const updatedCandidate = await candidate.save();
      res.json(updatedCandidate);
    } else {
      res.status(404).json({ message: 'Candidate not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE a candidate
router.delete('/candidates/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Deleting candidate from memory.');
    const index = inMemoryCandidates.findIndex(c => c._id === req.params.id);
    if (index !== -1) {
      const candidate = inMemoryCandidates[index];
      const campaign = inMemoryCampaigns.find(c => c._id === candidate.campaignId);
      inMemoryCandidates.splice(index, 1);

      if (campaign) {
        campaign.totalCount = Math.max(0, campaign.totalCount - 1);
      }

      return res.json({ message: 'Candidate removed' });
    } else {
      return res.status(404).json({ message: 'Candidate not found' });
    }
  }

  try {
    const candidate = await Candidate.findById(req.params.id);
    if (candidate) {
      const campaign = await Campaign.findById(candidate.campaignId);
      await Candidate.deleteOne({ _id: req.params.id });

      if (campaign) {
        campaign.totalCount = Math.max(0, campaign.totalCount - 1);
        await campaign.save();
      }

      res.json({ message: 'Candidate removed' });
    } else {
      res.status(404).json({ message: 'Candidate not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export { inMemoryCampaigns, inMemoryCandidates };
export default router;
