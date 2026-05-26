import express from 'express';
import mongoose from 'mongoose';
import Template from '../models/Template.js';
import Company from '../models/Company.js';
import { inMemoryCompanies } from './companies.js';

const router = express.Router();

// Local in-memory templates list
let inMemoryTemplates = [
  {
    _id: 'mock-template-quillon-id',
    name: 'Modern Offer Letter Template',
    subject: 'Offer of Employment at {{Company}} - {{Name}}',
    body: `Dear {{Name}},

We are thrilled to offer you the position of {{Role}} at {{Company}}. After our detailed interview process, our team was impressed by your expertise and we believe you will be a vital asset to our {{Department}} department.

As discussed, your starting annual base salary will be {{Salary}}, payable in accordance with the company's standard payroll schedule. Your official start date is scheduled for {{StartDate}}.

Attached you will find the complete benefits package and onboarding documentation. We look forward to having you on the team!

Best regards,

{{Manager}}
{{Company}} HR`,
    style: 'Modern',
    companyId: 'mock-company-quillon-id'
  },
  {
    _id: 'mock-template-aicte-id',
    name: 'Classic Appointment Letter Template',
    subject: 'Appointment as {{Role}} - AICTE Council',
    body: `Dear {{Name}},

On behalf of the All India Council for Technical Education (AICTE), I am pleased to offer you the position of {{Role}} in the {{Department}} department. We were highly impressed with your qualifications and experience during the review process.

Your annual salary for this position will be {{Salary}}, subject to applicable deductions as per government regulations. Your official start date is scheduled for {{StartDate}}.

Please review and confirm your acceptance by signing and returning a duplicate copy of this letter.

Yours sincerely,

{{Manager}}
Executive Director, AICTE`,
    style: 'Classic',
    companyId: 'mock-company-aicte-id'
  }
];

const seedDefaultTemplates = async () => {
  try {
    const count = await Template.countDocuments();
    if (count === 0) {
      const companies = await Company.find({});
      if (companies.length > 0) {
        // Create a default template for Quillon Markets
        await Template.create({
          name: 'Modern Offer Letter Template',
          subject: 'Offer of Employment at {{Company}} - {{Name}}',
          body: `Dear {{Name}},

We are thrilled to offer you the position of {{Role}} at {{Company}}. After our detailed interview process, our team was impressed by your expertise and we believe you will be a vital asset to our {{Department}} department.

As discussed, your starting annual base salary will be {{Salary}}, payable in accordance with the company's standard payroll schedule. Your official start date is scheduled for {{StartDate}}.

Attached you will find the complete benefits package and onboarding documentation. We look forward to having you on the team!

Best regards,

{{Manager}}
{{Company}} HR`,
          style: 'Modern',
          companyId: companies[0]._id
        });
        console.log('Seeded default offer letter template.');
      }
    }
  } catch (err) {
    console.error('Error seeding templates:', err);
  }
};

// GET all templates
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Returning populated in-memory templates.');
    const populated = inMemoryTemplates.map(t => {
      const targetCompanyId = typeof t.companyId === 'object' ? t.companyId._id : t.companyId;
      const comp = inMemoryCompanies.find(c => c._id === targetCompanyId);
      return { ...t, companyId: comp || t.companyId };
    });
    return res.json(populated);
  }

  try {
    await seedDefaultTemplates();
    const templates = await Template.find({}).populate('companyId');
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates from DB:', error);
    // Fall back to memory
    const populated = inMemoryTemplates.map(t => {
      const targetCompanyId = typeof t.companyId === 'object' ? t.companyId._id : t.companyId;
      const comp = inMemoryCompanies.find(c => c._id === targetCompanyId);
      return { ...t, companyId: comp || t.companyId };
    });
    res.json(populated);
  }
});

// GET templates for a company
router.get('/company/:companyId', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Filtering in-memory templates by company.');
    const filtered = inMemoryTemplates.filter(t => {
      const tCompId = typeof t.companyId === 'object' ? t.companyId._id : t.companyId;
      return tCompId === req.params.companyId;
    });
    const populated = filtered.map(t => {
      const targetCompanyId = typeof t.companyId === 'object' ? t.companyId._id : t.companyId;
      const comp = inMemoryCompanies.find(c => c._id === targetCompanyId);
      return { ...t, companyId: comp || t.companyId };
    });
    return res.json(populated);
  }

  try {
    const templates = await Template.find({ companyId: req.params.companyId });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST new template
router.post('/', async (req, res) => {
  const { name, subject, body, style, companyId } = req.body;

  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Saving template in memory.');
    const newTemplate = {
      _id: 'mock-template-' + Date.now(),
      name,
      subject,
      body,
      style,
      companyId
    };
    inMemoryTemplates.push(newTemplate);
    return res.status(201).json(newTemplate);
  }

  try {
    const template = new Template({
      name,
      subject,
      body,
      style,
      companyId
    });
    const createdTemplate = await template.save();
    res.status(201).json(createdTemplate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update template
router.put('/:id', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Database offline: Updating template in memory.');
    const template = inMemoryTemplates.find(t => t._id === req.params.id);
    if (template) {
      template.name = req.body.name || template.name;
      template.subject = req.body.subject || template.subject;
      template.body = req.body.body || template.body;
      template.style = req.body.style || template.style;
      template.companyId = req.body.companyId || template.companyId;
      return res.json(template);
    } else {
      return res.status(404).json({ message: 'Template not found' });
    }
  }

  try {
    const template = await Template.findById(req.params.id);
    if (template) {
      template.name = req.body.name || template.name;
      template.subject = req.body.subject || template.subject;
      template.body = req.body.body || template.body;
      template.style = req.body.style || template.style;
      template.companyId = req.body.companyId || template.companyId;

      const updatedTemplate = await template.save();
      res.json(updatedTemplate);
    } else {
      res.status(404).json({ message: 'Template not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export { inMemoryTemplates };
export default router;
