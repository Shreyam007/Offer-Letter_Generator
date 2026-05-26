import { AICTE_LOGO_SVG } from './constants.js';
import Company from '../models/Company.js';
import Template from '../models/Template.js';

const seedDatabase = async () => {
  try {
    // 1. Seed Company Profiles if none exist
    const companyCount = await Company.countDocuments();
    let quillon = null;
    let aicte = null;

    const quillonSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <rect width="400" height="400" fill="#000000"/>
      <circle cx="200" cy="180" r="85" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="500" stroke-dashoffset="10"/>
      <circle cx="200" cy="180" r="80" fill="none" stroke="#2a2a2a" stroke-width="2"/>
      <text x="200" y="305" font-family="'Inter', sans-serif" font-size="28" font-weight="300" fill="#ffffff" letter-spacing="12" text-anchor="middle">QUILLON</text>
      <text x="200" y="340" font-family="'Inter', sans-serif" font-size="12" font-weight="400" fill="#a0a0a0" letter-spacing="6" text-anchor="middle">MARKETS</text>
    </svg>`;

    const aicteSvg = AICTE_LOGO_SVG;

    if (companyCount === 0) {
      const companies = await Company.create([
        {
          name: 'Quillon Markets',
          tagline: 'Global Trading & Liquidity Solutions',
          logo: quillonSvg,
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
          name: 'AICTE Council',
          tagline: 'All India Council for Technical Education',
          logo: aicteSvg,
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
      ]);
      console.log('Database Seeder: Seeded companies Quillon Markets and AICTE Council');
      quillon = companies[0];
      aicte = companies[1];
    } else {
      quillon = await Company.findOne({ name: 'Quillon Markets' });
      aicte = await Company.findOne({ name: 'AICTE Council' });
    }

    // 2. Seed Templates if none exist
    const templateCount = await Template.countDocuments();
    if (templateCount === 0) {
      if (quillon) {
        // Modern template for Quillon
        await Template.create({
          name: 'Modern Offer Letter Template',
          subject: 'Offer of Employment at Quillon Markets - {{Name}}',
          body: `Dear {{Name}},

We are thrilled to offer you the position of {{Role}} at Quillon Markets. After our detailed interview process, our team was impressed by your expertise and we believe you will be a vital asset to our {{Department}} department.

As discussed, your starting annual base salary will be {{Salary}}, payable in accordance with the company's standard payroll schedule. Your official start date is scheduled for {{StartDate}}.

Attached you will find the complete benefits package and onboarding documentation. We look forward to having you on the team!

Best regards,

{{Manager}}
Quillon Markets HR`,
          style: 'Modern',
          companyId: quillon._id
        });
      }

      if (aicte) {
        // Classic template for AICTE
        await Template.create({
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
          companyId: aicte._id
        });
      }

      console.log('Database Seeder: Seeded default template styles (Modern, Classic) for companies');
    }
  } catch (error) {
    console.error('Database Seeder Error:', error);
  }
};

export default seedDatabase;
