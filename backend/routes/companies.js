import express from 'express';
import mongoose from 'mongoose';
import Company from '../models/Company.js';

const router = express.Router();

// Setup local in-memory fallback list
let inMemoryCompanies = [
  {
    _id: 'mock-company-quillon-id',
    name: 'Quillon Markets',
    tagline: 'Global Trading & Liquidity Solutions',
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <rect width="400" height="400" fill="#000000"/>
      <circle cx="200" cy="180" r="85" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="500" stroke-dashoffset="10"/>
      <circle cx="200" cy="180" r="80" fill="none" stroke="#2a2a2a" stroke-width="2"/>
      <text x="200" y="305" font-family="'Inter', sans-serif" font-size="28" font-weight="300" fill="#ffffff" letter-spacing="12" text-anchor="middle">QUILLON</text>
      <text x="200" y="340" font-family="'Inter', sans-serif" font-size="12" font-weight="400" fill="#a0a0a0" letter-spacing="6" text-anchor="middle">MARKETS</text>
    </svg>`,
    address: 'Floor 24, One Financial Center, New York, NY 10011',
    email: 'hr@quillonmarkets.com',
    phone: '+1 (555) 019-2834',
    website: 'www.quillonmarkets.com',
    smtp: {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      user: '',
      pass: ''
    }
  },
  {
    _id: 'mock-company-aicte-id',
    name: 'AICTE Council',
    tagline: 'All India Council for Technical Education',
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <circle cx="100" cy="100" r="90" fill="#ffffff" stroke="#e05a10" stroke-width="6"/>
      <circle cx="100" cy="100" r="78" fill="none" stroke="#0b3c95" stroke-width="2" stroke-dasharray="6,4"/>
      <path d="M 60,115 C 60,145 140,145 140,115 C 140,105 120,90 100,90 C 80,90 60,105 60,115 Z" fill="#e05a10" />
      <path d="M 100,90 C 90,70 100,42 100,42 C 100,42 110,70 100,90 Z" fill="#ff9933" />
      <circle cx="100" cy="74" r="5" fill="#ffcc00"/>
      <text x="100" y="165" font-family="'Inter', sans-serif" font-size="22" font-weight="900" fill="#0b3c95" text-anchor="middle" letter-spacing="1">AICTE</text>
    </svg>`,
    address: 'Nelson Mandela Marg, Vasant Kunj, New Delhi, Delhi 110070',
    email: 'no-reply@aicte-india.org',
    phone: '+91 11-26131576',
    website: 'www.aicte-india.org',
    smtp: {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      user: '',
      pass: ''
    }
  }
];

// Seed default company profiles if none exist
const seedDefaults = async () => {
  try {
    const count = await Company.countDocuments();
    if (count === 0) {
      await Company.create(inMemoryCompanies);
      console.log('Seeded default companies: Quillon Markets & AICTE');
    }
  } catch (err) {
    console.error('Error seeding companies:', err);
  }
};

// GET all companies
router.get('/', async (req, res) => {
  // If database connection is not active, return the in-memory list directly
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Returning in-memory company list fallback.');
    return res.json(inMemoryCompanies);
  }

  try {
    await seedDefaults(); // Trigger seeding if empty
    
    // Check if any company has the old wikipedia logo URL, and migrate it to SVG
    const wikiLogo = 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/All_India_Council_for_Technical_Education_logo.png/220px-All_India_Council_for_Technical_Education_logo.png';
    const aicteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <circle cx="100" cy="100" r="90" fill="#ffffff" stroke="#e05a10" stroke-width="6"/>
      <circle cx="100" cy="100" r="78" fill="none" stroke="#0b3c95" stroke-width="2" stroke-dasharray="6,4"/>
      <path d="M 60,115 C 60,145 140,145 140,115 C 140,105 120,90 100,90 C 80,90 60,105 60,115 Z" fill="#e05a10" />
      <path d="M 100,90 C 90,70 100,42 100,42 C 100,42 110,70 100,90 Z" fill="#ff9933" />
      <circle cx="100" cy="74" r="5" fill="#ffcc00"/>
      <text x="100" y="165" font-family="'Inter', sans-serif" font-size="22" font-weight="900" fill="#0b3c95" text-anchor="middle" letter-spacing="1">AICTE</text>
    </svg>`;

    await Company.updateMany(
      { logo: wikiLogo },
      { $set: { logo: aicteSvg } }
    );

    const companies = await Company.find({});
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies from DB:', error);
    // Fall back to memory if DB query fails
    res.json(inMemoryCompanies);
  }
});

// POST new company
router.post('/', async (req, res) => {
  const { name, tagline, logo, address, email, phone, website, smtp } = req.body;

  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Creating company in memory.');
    const newCompany = {
      _id: 'mock-company-' + Date.now(),
      name,
      tagline,
      logo,
      address,
      email,
      phone,
      website,
      smtp
    };
    inMemoryCompanies.push(newCompany);
    return res.status(201).json(newCompany);
  }

  try {
    const company = new Company({
      name,
      tagline,
      logo,
      address,
      email,
      phone,
      website,
      smtp
    });
    const createdCompany = await company.save();
    res.status(201).json(createdCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update company
router.put('/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Updating company in memory.');
    const comp = inMemoryCompanies.find(c => c._id === req.params.id);
    if (comp) {
      comp.name = req.body.name || comp.name;
      comp.tagline = req.body.tagline !== undefined ? req.body.tagline : comp.tagline;
      comp.logo = req.body.logo !== undefined ? req.body.logo : comp.logo;
      comp.address = req.body.address !== undefined ? req.body.address : comp.address;
      comp.email = req.body.email !== undefined ? req.body.email : comp.email;
      comp.phone = req.body.phone !== undefined ? req.body.phone : comp.phone;
      comp.website = req.body.website !== undefined ? req.body.website : comp.website;
      comp.smtp = req.body.smtp !== undefined ? req.body.smtp : comp.smtp;
      return res.json(comp);
    } else {
      return res.status(404).json({ message: 'Company not found' });
    }
  }

  try {
    const company = await Company.findById(req.params.id);
    if (company) {
      company.name = req.body.name || company.name;
      company.tagline = req.body.tagline !== undefined ? req.body.tagline : company.tagline;
      company.logo = req.body.logo !== undefined ? req.body.logo : company.logo;
      company.address = req.body.address !== undefined ? req.body.address : company.address;
      company.email = req.body.email !== undefined ? req.body.email : company.email;
      company.phone = req.body.phone !== undefined ? req.body.phone : company.phone;
      company.website = req.body.website !== undefined ? req.body.website : company.website;
      company.smtp = req.body.smtp !== undefined ? req.body.smtp : company.smtp;

      const updatedCompany = await company.save();
      res.json(updatedCompany);
    } else {
      res.status(404).json({ message: 'Company not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE company
router.delete('/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Deleting company from memory.');
    const index = inMemoryCompanies.findIndex(c => c._id === req.params.id);
    if (index !== -1) {
      inMemoryCompanies.splice(index, 1);
      return res.json({ message: 'Company removed' });
    } else {
      return res.status(404).json({ message: 'Company not found' });
    }
  }

  try {
    const company = await Company.findById(req.params.id);
    if (company) {
      await Company.deleteOne({ _id: req.params.id });
      res.json({ message: 'Company removed' });
    } else {
      res.status(404).json({ message: 'Company not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export { inMemoryCompanies };
export default router;
