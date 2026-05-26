import express from 'express';
import Template from '../models/Template.js';
import Company from '../models/Company.js';

const router = express.Router();

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
  try {
    await seedDefaultTemplates();
    const templates = await Template.find({}).populate('companyId');
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET templates for a company
router.get('/company/:companyId', async (req, res) => {
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

export default router;
