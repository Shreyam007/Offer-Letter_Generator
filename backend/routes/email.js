import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import Campaign from '../models/Campaign.js';
import Candidate from '../models/Candidate.js';
import Company from '../models/Company.js';
import Template from '../models/Template.js';
import History from '../models/History.js';
import { inMemoryCompanies } from './companies.js';
import { inMemoryTemplates } from './templates.js';
import { inMemoryCampaigns, inMemoryCandidates } from './campaigns.js';

const router = express.Router();

// Active SSE clients for real-time open notifications
let sseClients = [];

// Helper function to broadcast candidate updates (such as Sending, Sent, Failed, Opened)
function broadcastCandidateUpdate(candidateId, status, openedAt = null, error = '') {
  const data = JSON.stringify({ candidateId, status, openedAt, error });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[SSE] Error writing to client:', err);
    }
  });
}

const compileTemplate = (text, variables) => {
  if (!text) return '';
  let result = text;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, variables[key] !== undefined && variables[key] !== null ? variables[key] : '');
  });
  result = result.replace(/{{\s*(.*?)\s*}}/g, '$1');
  return result;
};

const generateOfferLetterPdf = (candidate, company, template, bodyText, style) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const currentDateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const candidateIdStr = candidate._id ? candidate._id.toString() : (candidate.id || 'TEMP');
      const refSuffix = candidateIdStr.slice(-4).toUpperCase();

      // Try to parse company logo if it's a base64 raster image
      let logoBuffer = null;
      if (company.logo && company.logo.startsWith('data:image/') && !company.logo.startsWith('data:image/svg+xml')) {
        const match = company.logo.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (match) {
          logoBuffer = Buffer.from(match[2].trim(), 'base64');
        }
      }

      if (style === 'Classic') {
        doc.font('Times-Roman');

        // Draw outer gold rectangle & inner gold rectangle frame
        doc.save();
        doc.rect(20, 20, 555.28, 801.89).strokeColor('#d4af37').lineWidth(2).stroke();
        doc.rect(26, 26, 543.28, 789.89).strokeColor('#d4af37').lineWidth(0.5).stroke();
        
        // Draw a light gold watermark crest in the background center
        doc.strokeColor('#d4af37').lineWidth(0.5).opacity(0.04);
        doc.circle(297.64, 420.94, 90).stroke();
        doc.circle(297.64, 420.94, 76).stroke();
        doc.moveTo(297.64, 345).lineTo(297.64, 495).stroke();
        doc.moveTo(222.64, 420.94).lineTo(372.64, 420.94).stroke();
        doc.restore();

        // Header
        doc.font('Times-Bold').fontSize(26).fillColor('#1e1b18');
        doc.text(company.name.toUpperCase(), 50, 45, { align: 'center', width: 495 });

        if (company.tagline) {
          doc.font('Times-Italic').fontSize(11).fillColor('#854d0e');
          doc.text(company.tagline, 50, 75, { align: 'center', width: 495 });
        }

        // Double lines below header
        doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#d4af37').lineWidth(1.5).stroke();
        doc.moveTo(50, 99).lineTo(545, 99).strokeColor('#d4af37').lineWidth(0.5).stroke();

        // Ref / Date table
        doc.font('Times-Roman').fontSize(10).fillColor('#475569');
        doc.text(`Ref: OF-${new Date().getFullYear()}-CLA-${refSuffix}`, 50, 115);
        doc.text(currentDateStr, 350, 115, { width: 195, align: 'right' });

        // Title: Letter of Appointment
        doc.font('Times-Bold').fontSize(14).fillColor('#1e1b18');
        doc.text('LETTER OF APPOINTMENT', 50, 135, { align: 'center', width: 495 });

        // Recipient
        doc.font('Times-Bold').fontSize(12).fillColor('#0f172a');
        doc.text(`Dear ${candidate.name},`, 50, 165);

        // Body content
        doc.font('Times-Roman').fontSize(11).fillColor('#1e293b');
        doc.text(bodyText, 50, 195, { width: 495, align: 'justify', lineGap: 5 });

        let currentY = doc.y + 25;

        // Stats grid
        if (currentY + 70 > 791) {
          doc.addPage();
          currentY = 50;
        }

        doc.save();
        doc.rect(50, currentY, 495, 52).fill('#fdfcf7');
        doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#d4af37').lineWidth(1.5).stroke();
        doc.moveTo(50, currentY + 3).lineTo(545, currentY + 3).strokeColor('#d4af37').lineWidth(0.5).stroke();
        doc.moveTo(50, currentY + 49).lineTo(545, currentY + 49).strokeColor('#d4af37').lineWidth(0.5).stroke();
        doc.moveTo(50, currentY + 52).lineTo(545, currentY + 52).strokeColor('#d4af37').lineWidth(1.5).stroke();
        doc.moveTo(297.64, currentY).lineTo(297.64, currentY + 52).strokeColor('#d4af37').lineWidth(0.5).stroke();
        doc.restore();

        doc.font('Times-Bold').fontSize(9).fillColor('#854d0e');
        doc.text('SALARY', 50, currentY + 12, { width: 247.64, align: 'center' });
        doc.font('Times-Bold').fontSize(14).fillColor('#1e1b18');
        doc.text(candidate.salary || '-', 50, currentY + 27, { width: 247.64, align: 'center' });

        doc.font('Times-Bold').fontSize(9).fillColor('#854d0e');
        doc.text('START DATE', 297.64, currentY + 12, { width: 247.64, align: 'center' });
        doc.font('Times-Bold').fontSize(14).fillColor('#1e1b18');
        doc.text(candidate.joiningDate || '-', 297.64, currentY + 27, { width: 247.64, align: 'center' });

        currentY += 75;

        // Sign-off
        if (currentY + 80 > 791) {
          doc.addPage();
          currentY = 50;
        }

        doc.font('Times-Roman').fontSize(11).fillColor('#1e1b18');
        doc.text('Sincerely,', 50, currentY);
        
        doc.font('Times-BoldItalic').fontSize(22).fillColor('#1e3a8a');
        doc.text('Emily Watson', 50, currentY + 20);

        doc.font('Times-Bold').fontSize(11).fillColor('#1e1b18');
        doc.text('Director of Talent Acquisition', 50, currentY + 45);
        doc.font('Times-Roman').fontSize(11).fillColor('#475569');
        doc.text(company.name, 50, currentY + 60);

        // Wax seal
        doc.save();
        doc.circle(480, currentY + 40, 28).fill('#b91c1c');
        doc.circle(480, currentY + 40, 24).strokeColor('#fca5a5').lineWidth(1).stroke();
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#fecaca');
        doc.text('OFFICIAL', 452, currentY + 33, { width: 56, align: 'center' });
        doc.text('SEAL', 452, currentY + 42, { width: 56, align: 'center' });
        doc.restore();

      } else if (style === 'Minimal') {
        doc.font('Helvetica');

        // Draw top brand bar (crimson)
        doc.save();
        doc.rect(0, 0, 595.28, 8).fill('#e11d48');
        doc.restore();

        // Minimal tag
        doc.font('Courier-Bold').fontSize(8).fillColor('#e11d48');
        doc.text('OFFER.MINIMAL.DOC', 50, 28);

        // Header logo & name
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 50, 45, { height: 30 });
          } catch (err) {
            console.error('Failed to embed logo in Minimal PDF:', err);
          }
        }
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#18181b');
        doc.text(company.name.toUpperCase(), 350, 50, { width: 195, align: 'right' });

        // Date and Ref in Courier
        doc.font('Courier').fontSize(10).fillColor('#71717a');
        doc.text(`${currentDateStr} / Ref: OF-${new Date().getFullYear()}-MIN-${refSuffix}`, 50, 90);

        // Line divider
        doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#f4f4f5').lineWidth(1).stroke();

        // Content
        doc.font('Helvetica').fontSize(10.5).fillColor('#3f3f46');
        doc.text(`Dear ${candidate.name},`, 50, 130);
        doc.text(bodyText, 50, 155, { width: 495, align: 'justify', lineGap: 5 });

        let currentY = doc.y + 20;

        // Stats grid
        if (currentY + 60 > 791) {
          doc.addPage();
          currentY = 50;
        }

        doc.save();
        doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#e4e4e7').lineWidth(1).stroke();
        doc.restore();

        doc.font('Courier-Bold').fontSize(9).fillColor('#71717a');
        doc.text('COMPENSATION', 50, currentY + 10);
        doc.font('Courier-Bold').fontSize(12).fillColor('#18181b');
        doc.text(candidate.salary || '-', 350, currentY + 10, { width: 195, align: 'right' });

        doc.font('Courier-Bold').fontSize(9).fillColor('#71717a');
        doc.text('START DATE', 50, currentY + 28);
        doc.font('Courier-Bold').fontSize(12).fillColor('#18181b');
        doc.text(candidate.joiningDate || '-', 350, currentY + 28, { width: 195, align: 'right' });

        currentY += 55;

        doc.save();
        doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#e4e4e7').lineWidth(1).stroke();
        doc.restore();

        currentY += 20;

        // Sign-off
        if (currentY + 50 > 791) {
          doc.addPage();
          currentY = 50;
        }

        doc.font('Helvetica').fontSize(10.5).fillColor('#3f3f46');
        doc.text('Warm regards,', 50, currentY);
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#18181b');
        doc.text(`${company.name} HR`, 50, currentY + 15);

        // Confidentiality footer in Courier
        doc.font('Courier').fontSize(8).fillColor('#a1a1aa');
        doc.text('CONFIDENTIALITY NOTICE: THE INFORMATION IN THIS DOCUMENT IS PRIVATE.', 50, 780, { width: 495, align: 'center' });

      } else {
        // Modern Style
        doc.font('Helvetica');

        // Left brand accent bar (indigo)
        doc.rect(0, 0, 12, 841.89).fill('#4f46e5');

        // Top Corner badge
        doc.save();
        doc.rect(395, 25, 150, 20).fill('#4f46e5');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
        doc.text('EMPLOYMENT OFFER', 395, 31, { width: 150, align: 'center' });
        doc.restore();

        // Header logo/name
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 50, 40, { height: 40 });
          } catch (err) {
            console.error('Failed to embed logo in Modern PDF:', err);
            doc.font('Helvetica-Bold').fontSize(22).fillColor('#4f46e5').text(company.name, 50, 40);
          }
        } else {
          doc.font('Helvetica-Bold').fontSize(22).fillColor('#4f46e5').text(company.name, 50, 40);
        }

        // Date and Ref
        doc.font('Helvetica').fontSize(10).fillColor('#64748b');
        doc.text(currentDateStr, 50, 90);
        doc.text(`Ref: OF-${new Date().getFullYear()}-MOD-${refSuffix}`, 350, 90, { width: 195, align: 'right' });

        // Divider
        doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#e2e8f0').lineWidth(1).stroke();

        // Recipient
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937');
        doc.text(`Dear ${candidate.name},`, 50, 120);
        doc.font('Helvetica').fontSize(10).fillColor('#64748b');
        doc.text(candidate.email || '', 50, 135);

        // Body Content
        doc.font('Helvetica').fontSize(11).fillColor('#334155');
        doc.text(bodyText, 50, 165, { width: 495, align: 'justify', lineGap: 5.5 });

        let currentY = doc.y + 25;

        // Stats grid
        if (currentY + 100 > 791) {
          doc.addPage();
          currentY = 50;
        }

        doc.save();
        doc.rect(50, currentY, 495, 55).fill('#eef2ff');
        doc.rect(50, currentY, 495, 55).strokeColor('#c7d2fe').lineWidth(1).stroke();
        doc.restore();

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#4f46e5');
        doc.text('ANNUAL SALARY', 70, currentY + 13);
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e1b4b');
        doc.text(candidate.salary || '-', 70, currentY + 27);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#4f46e5');
        doc.text('START DATE', 300, currentY + 13);
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e1b4b');
        doc.text(candidate.joiningDate || '-', 300, currentY + 27);

        currentY += 80;

        // Sign-off
        if (currentY + 60 > 791) {
          doc.addPage();
          currentY = 50;
        }

        doc.save();
        doc.moveTo(50, currentY).lineTo(200, currentY).strokeColor('#cbd5e1').lineWidth(1).stroke();
        doc.restore();

        doc.font('Helvetica').fontSize(11).fillColor('#64748b');
        doc.text('HR Team, Talent Acquisition', 50, currentY + 8);
        doc.font('Helvetica').fontSize(11).fillColor('#94a3b8');
        doc.text(company.name, 50, currentY + 23);

        // Security badge
        doc.save();
        doc.rect(380, currentY + 8, 165, 20).fill('#ecfdf5');
        doc.rect(380, currentY + 8, 165, 20).strokeColor('#a7f3d0').lineWidth(0.5).stroke();
        doc.font('Courier-Bold').fontSize(8).fillColor('#065f46');
        doc.text('✓ SECURE & VERIFIED DOCUMENT', 380, currentY + 14, { width: 165, align: 'center' });
        doc.restore();

        // Footer at bottom
        doc.font('Helvetica').fontSize(9).fillColor('#94a3b8');
        doc.text(`This is an official document from ${company.name} HR department.`, 50, 780, { width: 495, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Convert an SVG string to a base64 data URI that email clients can render as <img>.
// If the string is already a URL (http/data), return it as-is.
const svgToDataUri = (logoStr) => {
  if (!logoStr) return '';
  const trimmed = logoStr.trim();
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('<svg')) {
    const base64 = Buffer.from(trimmed).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
  return trimmed; // unknown format, pass through
};

const getSmtpConfig = (smtp) => {
  const host = smtp?.host || process.env.SMTP_HOST;
  const rawPort = smtp?.port ?? process.env.SMTP_PORT ?? 587;
  let port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    port = 587;
  }
  const secure = smtp?.secure !== undefined
    ? Boolean(smtp.secure)
    : (process.env.SMTP_SECURE === 'true') || port === 465;
  const user = smtp?.user || process.env.SMTP_USER;
  const pass = smtp?.pass || process.env.SMTP_PASS;
  const from = smtp?.from || process.env.SMTP_FROM;
  return { host, port, secure, user, pass, from };
};

const validateSmtpConfig = ({ host, port, secure, user, pass }) => {
  if (!host || !user || !pass) return 'Missing SMTP configuration. Enter host, port, user and password, or configure server environment variables.';
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return 'SMTP port must be a valid number between 1 and 65535.';
  if (port === 465 && secure === false) return 'Port 465 requires secure SSL/TLS to be enabled. Turn on Secure SSL/TLS or use port 587.';
  return null;
};

const createTransporter = (smtp) => {
  const { host, port, secure, user, pass } = getSmtpConfig(smtp);
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
};

const verifySmtp = async (smtp) => {
  const config = getSmtpConfig(smtp);
  const validationError = validateSmtpConfig(config);
  if (validationError) return { ok: false, reason: validationError };

  // SUPER SENIOR DEV BYPASS: If host is Resend, bypass SMTP entirely due to Render firewall block on standard SMTP ports.
  if (config.host.toLowerCase().includes('resend.com')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        headers: { 'Authorization': `Bearer ${config.pass}` }
      });
      // 401 or 403 means bad token. Any other error (like 400 bad request) means the key is valid but payload is empty, which is expected.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: 'Invalid Resend API Key. Check your SMTP Password.' };
      }
      return { ok: true, transporter: null, config };
    } catch (err) {
      return { ok: false, reason: `Resend API Error: ${err.message}` };
    }
  }

  const transporter = createTransporter(smtp);
  try {
    await transporter.verify();
    return { ok: true, transporter, config };
  } catch (err) {
    return { ok: false, reason: err.message || String(err), code: err.code };
  }
};

const sendMailViaTransporterOrApi = async (transporter, config, mailOptions) => {
  if (config.host.toLowerCase().includes('resend.com')) {
    let resendAttachments = undefined;
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      resendAttachments = mailOptions.attachments.map(att => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        contentId: att.cid
      }));
    }

    const payload = {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      attachments: resendAttachments
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.pass}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Resend HTTP API failed with status ${res.status}`);
    }
    return true;
  } else {
    if (!transporter) throw new Error('No valid SMTP transporter configured.');
    return await transporter.sendMail(mailOptions);
  }
};

router.post('/test-smtp', async (req, res) => {
  const { smtp } = req.body;
  const config = getSmtpConfig(smtp);
  const validationError = validateSmtpConfig(config);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  try {
    const result = await verifySmtp(smtp);
    if (result.ok) {
      return res.json({ success: true, message: 'SMTP connection verified successfully! (Bypassing Render firewall if Resend)' });
    }

    const configDetails = `Host=${config.host}, Port=${config.port}, Secure=${config.secure}`;
    let suggestion = '';
    if (result.reason && /535|Authentication|Invalid login|BadCredentials/i.test(result.reason)) {
      suggestion = 'If you are using Gmail, create an App Password. Alternatively, use a transactional email provider like Resend.';
    } else if (result.reason && /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(result.reason)) {
      suggestion = 'Render Free Tier blocks outbound SMTP (25, 465, 587). Use Resend (smtp.resend.com) and we will automatically route it via HTTP, or upgrade your Render plan.';
    }

    res.status(500).json({
      success: false,
      message: `SMTP connection failed: ${result.reason}`,
      details: configDetails,
      suggestion
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `SMTP connection failed: ${error.message}` });
  }
});

router.post('/send-campaign', async (req, res) => {
  const { campaignId, candidateIds, delayMs, retryOnFailure } = req.body;

  let campaign, company, template, targetCandidates;
  const isOffline = mongoose.connection.readyState !== 1;

  if (isOffline) {
    campaign = inMemoryCampaigns.find(c => c._id === campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    const companyIdStr = typeof campaign.companyId === 'object' ? campaign.companyId._id : campaign.companyId;
    company = inMemoryCompanies.find(c => c._id === companyIdStr);
    // Look up template by campaign.templateId first, then fallback to matching by companyId
    const templateIdStr = typeof campaign.templateId === 'object' ? campaign.templateId._id : campaign.templateId;
    template = inMemoryTemplates.find(t => t._id === templateIdStr);
    if (!template) {
      // Fallback: find template by companyId (matches preview behavior)
      template = inMemoryTemplates.find(t => {
        const tCompId = typeof t.companyId === 'object' ? t.companyId._id : t.companyId;
        return tCompId === companyIdStr;
      }) || inMemoryTemplates[0];
      console.log(`Template fallback: using template "${template?.name}" matched by companyId`);
    }
    targetCandidates = inMemoryCandidates.filter(c => candidateIds.includes(c._id) && c.campaignId === campaignId);
  } else {
    campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    company = await Company.findById(campaign.companyId);
    // Look up template by campaign.templateId first, then fallback to matching by companyId
    template = campaign.templateId ? await Template.findById(campaign.templateId) : null;
    if (!template && company) {
      // Fallback: find template by companyId (matches preview behavior)
      template = await Template.findOne({ companyId: company._id });
      if (!template) {
        // Last resort: use any available template
        template = await Template.findOne({});
      }
      console.log(`Template fallback: using template "${template?.name}" matched by companyId`);
    }
    targetCandidates = await Candidate.find({ _id: { $in: candidateIds }, campaignId: campaignId });
  }

  if (!company) return res.status(404).json({ message: 'Company profile not found for this campaign' });
  if (targetCandidates.length === 0) return res.status(400).json({ message: 'No candidates selected or found' });

  const hasCompanySmtp = company.smtp && company.smtp.host && company.smtp.user && company.smtp.pass;
  const hasGlobalSmtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!hasCompanySmtp && !hasGlobalSmtp) {
    return res.status(500).json({ message: 'SMTP configuration missing. Configure SMTP in the selected company profile or set SMTP environment variables on the server.' });
  }

  const verifyResult = await verifySmtp(hasCompanySmtp ? company.smtp : {});
  if (!verifyResult.ok) {
    return res.status(500).json({ message: `SMTP configuration invalid: ${verifyResult.reason}` });
  }

  const { transporter, config: activeConfig } = verifyResult;

  campaign.status = 'Sending';
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  if (isOffline) {
    targetCandidates.forEach(c => { c.status = 'Pending'; c.error = ''; });
  } else {
    await campaign.save();
    await Candidate.updateMany({ _id: { $in: candidateIds } }, { $set: { status: 'Pending', error: '' } });
  }

  res.json({ message: 'Offer letter dispatch started in background', total: targetCandidates.length });

  (async () => {
    const delay = Number(delayMs) || 1500;

    for (let i = 0; i < targetCandidates.length; i++) {
      const candidate = targetCandidates[i];
      candidate.status = 'Sending';
      if (!isOffline) await candidate.save();
      broadcastCandidateUpdate(candidate._id.toString(), 'Sending');

      const templateVariables = {
        Name: candidate.name,
        Role: candidate.role,
        Department: candidate.department,
        Salary: candidate.salary,
        StartDate: candidate.joiningDate,
        JoiningDate: candidate.joiningDate,
        Company: company.name,
        Manager: template && template.body.includes('{{Manager}}') ? 'HR Team' : '',
        ...(isOffline ? candidate.customFields : Object.fromEntries(candidate.customFields || new Map()))
      };

      const mailSubject = compileTemplate(template ? template.subject : 'Offer of Employment', templateVariables);
      const mailBody = compileTemplate(template ? template.body : 'Dear {{Name}}, Congratulations!', templateVariables);

      let sentSuccess = false;
      let errorMessage = '';
      const maxRetries = retryOnFailure ? 3 : 1;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt > 1) {
          candidate.status = 'Retrying';
          if (!isOffline) await candidate.save();
          broadcastCandidateUpdate(candidate._id.toString(), 'Retrying');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const templateStyle = template ? (template.style || 'Modern') : 'Modern';
        const bodyHtml = mailBody.replace(/\n/g, '<br/>');
        const logoSrc = svgToDataUri(company.logo);
        let logoHtml = '';
        let emailAttachments = [];

        try {
          const pdfBuffer = await generateOfferLetterPdf(candidate, company, template, mailBody, templateStyle);
          emailAttachments.push({
            filename: `${candidate.name.replace(/\s+/g, '_')}_Offer_Letter.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          });
        } catch (pdfErr) {
          console.error(`Failed to generate PDF for ${candidate.name}:`, pdfErr);
        }

        // Check if the logo is a PNG/JPEG/GIF data URI (Gmail blocks SVG inline/CID images, so we handle raster formats here)
        if (logoSrc && logoSrc.startsWith('data:image/') && !logoSrc.startsWith('data:image/svg+xml')) {
          const match = logoSrc.match(/^data:image\/([^;]+);base64,(.+)$/);
          if (match) {
            const ext = match[1]; // e.g. png, jpeg, gif
            const base64Data = match[2].trim();
            const logoBuffer = Buffer.from(base64Data, 'base64');
            const cidName = `company_logo`;
            
            emailAttachments.push({
              filename: `logo.${ext}`,
              content: logoBuffer,
              cid: cidName
            });
            
            logoHtml = `<img src="cid:${cidName}" style="height: 48px; object-fit: contain; max-width: 150px;" alt="${company.name}" />`;
          }
        } else if (logoSrc && (logoSrc.startsWith('http://') || logoSrc.startsWith('https://'))) {
          // If it's a web URL, we can use it directly
          logoHtml = `<img src="${logoSrc}" style="height: 48px; object-fit: contain; max-width: 150px;" alt="${company.name}" />`;
        }

        // Layout-specific HTML logo configurations
        // If logoHtml exists, use it. Otherwise, use an elegant text logo fallback for Modern, or render nothing for Classic/Minimal
        const logoBoxHtmlModern = logoHtml 
          ? `<div style="height: 48px; display: block;">${logoHtml}</div>`
          : `<div style="font-size: 22px; font-weight: bold; color: #0b3c95; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: 0.5px;">${company.name}</div>`;

        const logoBoxHtmlClassic = logoHtml
          ? `<div style="height: 48px; display: block; margin: 0 auto 16px auto;">${logoHtml}</div>`
          : ''; // Empty because company name is rendered right under it in Classic style

        const logoHtmlMinimal = logoHtml
          ? logoHtml.replace('height: 48px;', 'height: 36px; filter: grayscale(1);')
          : ''; // Empty because company name is rendered on the right
        
        let htmlEmail = '';

        if (templateStyle === 'Classic') {
          htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Georgia, serif; background-color: #f5f7fa; padding: 20px; color: #0f172a; }
                .letter-container { max-width: 650px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 4px; border: 1px solid #e2e8f0; }
                .header { text-align: center; border-bottom: 3px double #94a3b8; padding-bottom: 24px; margin-bottom: 36px; }
                .company-title { font-size: 24px; font-weight: bold; color: #1e293b; letter-spacing: 2px; text-transform: uppercase; margin-top: 16px; margin-bottom: 6px; }
                .date-ref { display: table; width: 100%; font-size: 12px; margin-bottom: 28px; color: #475569; }
                .content { text-align: justify; margin-bottom: 32px; white-space: pre-wrap; color: #1e293b; line-height: 1.7; }
                .stats-grid { display: table; width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #f8fafc; margin-bottom: 32px; }
                .stat-item { display: table-cell; text-align: center; padding: 12px; width: 50%; }
                .stat-item:first-child { border-right: 1px solid #cbd5e1; }
                .stat-label { font-size: 9px; text-transform: uppercase; font-weight: bold; color: #475569; letter-spacing: 1px; margin-bottom: 4px; }
                .stat-value { font-size: 15px; font-weight: bold; color: #0f172a; }
                .sign { margin-top: 40px; line-height: 1.6; color: #1e293b; }
              </style>
            </head>
            <body>
              <div class="letter-container">
                <div class="header">
                  ${logoBoxHtmlClassic}
                  <div class="company-title">${company.name}</div>
                  <div style="font-size: 11px; color: #64748b;">${company.tagline || ''}</div>
                </div>
                <div class="date-ref">
                  <div style="display: table-cell; text-align: left;">Ref: GC-2026-DIS-092</div>
                  <div style="display: table-cell; text-align: right;">October 24, 2026</div>
                </div>
                <div class="content">${bodyHtml}</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-label">Salary</div>
                    <div class="stat-value">${candidate.salary || '-'}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Start Date</div>
                    <div class="stat-value">${candidate.joiningDate || '-'}</div>
                  </div>
                </div>
                <div class="sign">
                  Sincerely,<br/><br/><br/>
                  <strong>HR Department</strong><br/>
                  ${company.name}
                </div>
              </div>
            </body>
            </html>
          `;
        } else if (templateStyle === 'Minimal') {
          htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f7fa; padding: 20px; color: #334155; }
                .letter-container { max-width: 650px; margin: 0 auto; background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; }
                .header { display: table; width: 100%; margin-bottom: 32px; }
                .date-ref { font-size: 12px; color: #94a3b8; margin-bottom: 20px; }
                .content { margin-bottom: 24px; white-space: pre-wrap; font-size: 12px; line-height: 1.6; }
                .stats-grid { display: table; width: 100%; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
                .stat-item { display: table-cell; width: 50%; }
                .stat-label { font-size: 10px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; }
                .stat-value { font-size: 13px; font-weight: bold; color: #0f172a; }
                .notice { font-size: 11px; color: #94a3b8; margin-top: 40px; }
              </style>
            </head>
            <body>
              <div class="letter-container">
                <div class="header">
                  <div style="display: table-cell; vertical-align: middle;">${logoHtmlMinimal}</div>
                  <div style="display: table-cell; vertical-align: middle; text-align: right; font-size: 12px; font-weight: bold; color: #0f172a;">${company.name}</div>
                </div>
                <div class="date-ref">
                  October 24, 2026 / Ref: GC-2026-DIS
                </div>
                <div class="content">${bodyHtml}</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-label">COMPENSATION</div>
                    <div class="stat-value">${candidate.salary || '-'}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">START DATE</div>
                    <div class="stat-value">${candidate.joiningDate || '-'}</div>
                  </div>
                </div>
                <div class="notice">
                  CONFIDENTIALITY NOTICE: The information in this document is private.
                </div>
              </div>
            </body>
            </html>
          `;
        } else {
          // Modern
          htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f7fa; padding: 20px; color: #0f172a; }
                .letter-container { max-width: 650px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0; border-top: 6px solid #0b3c95; }
                .header { display: table; width: 100%; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 32px; }
                .date-ref { text-align: right; font-size: 12px; color: #64748b; line-height: 1.5; }
                .recipient { margin-bottom: 24px; }
                .content { font-size: 14px; line-height: 1.6; color: #1e293b; margin-bottom: 32px; white-space: pre-wrap; }
                .stats-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 32px; background-color: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; }
                .stat-item { display: table-cell; padding: 16px; width: 50%; border-right: 1px solid #e2e8f0; }
                .stat-item:last-child { border-right: none; }
                .stat-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
                .stat-value { font-size: 14px; font-weight: bold; color: #0b3c95; }
                .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; }
              </style>
            </head>
            <body>
              <div class="letter-container">
                <div class="header">
                  <div style="display: table-cell; vertical-align: middle;">
                    ${logoBoxHtmlModern}
                  </div>
                  <div style="display: table-cell; vertical-align: middle;" class="date-ref">
                    <div>October 24, 2026</div>
                    <div>Ref: GC-2026-DIS-092</div>
                  </div>
                </div>
                <div class="recipient">
                  <strong style="font-size: 16px;">Dear ${candidate.name},</strong>
                  <div style="color: #64748b; font-size: 11px; margin-top: 2px;">${candidate.email}</div>
                </div>
                <div class="content">${bodyHtml}</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-label">Annual Salary</div>
                    <div class="stat-value">${candidate.salary || '-'}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Start Date</div>
                    <div class="stat-value">${candidate.joiningDate || '-'}</div>
                  </div>
                </div>
                <div class="footer">
                  This is an official document from ${company.name} HR department.
                </div>
              </div>
            </body>
            </html>
          `;
        }

        // Determine frontend URL for candidate interactive portal
        let frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) {
          const origin = req.get('origin') || req.get('referer');
          if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            try {
              frontendUrl = new URL(origin).origin;
            } catch (e) {
              frontendUrl = 'http://localhost:5173';
            }
          } else {
            frontendUrl = 'https://frontend-nine-eta-67.vercel.app';
          }
        }
        const portalUrl = `${frontendUrl.replace(/\/$/, '')}/?viewOffer=${candidate._id}`;

        // Use a publicly accessible tracking URL so that remote mail clients (like Gmail) can load the tracking pixel.
        // Falls back to local dynamically for developers, or the public Render backend URL.
        let trackingUrl = process.env.TRACKING_URL;
        if (!trackingUrl) {
          const host = req.get('host');
          if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
            trackingUrl = `${req.protocol}://${host}`;
          } else {
            trackingUrl = 'https://offer-letter-generator-whu4.onrender.com';
          }
        }
        const trackingPixelUrl = `${trackingUrl.replace(/\/$/, '')}/api/email/track/${candidate._id}.gif`;
        const pixelHtml = `<img src="${trackingPixelUrl}" width="1" height="1" border="0" style="margin:0; padding:0; border:none; display:block;" alt="" />`;
        
        if (htmlEmail.includes('<body>')) {
          htmlEmail = htmlEmail.replace('<body>', `<body>\n${pixelHtml}`);
        } else if (htmlEmail.includes('<body')) {
          const bodyIndex = htmlEmail.indexOf('<body');
          const closingTagIndex = htmlEmail.indexOf('>', bodyIndex);
          if (closingTagIndex !== -1) {
            htmlEmail = htmlEmail.slice(0, closingTagIndex + 1) + `\n${pixelHtml}` + htmlEmail.slice(closingTagIndex + 1);
          } else {
            htmlEmail = pixelHtml + htmlEmail;
          }
        } else {
          htmlEmail = pixelHtml + htmlEmail;
        }

        // Add a beautiful, polished CTA button inside the email body so the candidate can open the letter online
        const ctaHtml = `
          <div style="text-align: center; margin: 35px 0 20px 0; font-family: 'Inter', -apple-system, sans-serif;">
            <a href="${portalUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1); transition: all 0.2s ease;">
              View & Action Official Offer Letter
            </a>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
              Verify security signature and accept contract digitally.
            </div>
          </div>
        `;

        if (htmlEmail.includes('<div class="footer">')) {
          htmlEmail = htmlEmail.replace('<div class="footer">', `${ctaHtml}\n<div class="footer">`);
        } else if (htmlEmail.includes('</body>')) {
          htmlEmail = htmlEmail.replace('</body>', `${ctaHtml}\n</body>`);
        } else {
          htmlEmail = htmlEmail + ctaHtml;
        }

        try {
          const senderEmailCandidates = [company.smtp?.from, process.env.SMTP_FROM, company.email, process.env.SMTP_USER];
          const senderEmail = senderEmailCandidates.find(email => typeof email === 'string' && email.includes('@'));
          if (!senderEmail) throw new Error('No valid sender email found. Set SMTP_FROM or company careers email before sending.');

          const mailOptions = {
            from: `"${company.name}" <${senderEmail}>`,
            to: candidate.email,
            subject: mailSubject,
            text: mailBody,
            html: htmlEmail,
            attachments: emailAttachments.length > 0 ? emailAttachments : undefined
          };

          await sendMailViaTransporterOrApi(transporter, activeConfig, mailOptions);
          sentSuccess = true;
          break;
        } catch (err) {
          errorMessage = err.message;
          console.error(`Attempt ${attempt} failed for ${candidate.email}: ${errorMessage}`);
        }
      }

      if (sentSuccess) {
        candidate.status = 'Sent';
        candidate.error = '';
        campaign.sentCount += 1;
        if (!isOffline) {
          await candidate.save();
          await campaign.save();
          await History.create({ campaignId, candidateName: candidate.name, candidateEmail: candidate.email, status: 'Sent' });
        }
        broadcastCandidateUpdate(candidate._id.toString(), 'Sent');
      } else {
        candidate.status = 'Failed';
        candidate.error = errorMessage;
        campaign.failedCount += 1;
        if (!isOffline) {
          await candidate.save();
          await campaign.save();
          await History.create({ campaignId, candidateName: candidate.name, candidateEmail: candidate.email, status: 'Failed', error: errorMessage });
        }
        broadcastCandidateUpdate(candidate._id.toString(), 'Failed', null, errorMessage);
      }

      if (i < targetCandidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    campaign.status = 'Completed';
    if (!isOffline) await campaign.save();
    console.log(`Campaign ${campaign.name} dispatch completed!`);
  })();
});



// SSE stream endpoint
router.get('/track/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  sseClients.push(res);
  console.log(`[SSE] Client connected. Total clients: ${sseClients.length}`);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[SSE] Client disconnected. Total clients: ${sseClients.length}`);
  });
});

// Serve a 1x1 transparent tracking GIF and update candidate status to 'Opened'
router.get('/track/:candidateId', async (req, res) => {
  let { candidateId } = req.params;
  if (candidateId.endsWith('.gif')) {
    candidateId = candidateId.slice(0, -4);
  }
  console.log(`Tracking pixel requested for candidate: ${candidateId}`);
  
  try {
    const isOffline = mongoose.connection.readyState !== 1;
    
    if (isOffline) {
      const candidate = inMemoryCandidates.find(c => c._id === candidateId);
      if (candidate) {
        candidate.status = 'Opened';
        candidate.openedAt = new Date();
        console.log(`[Offline] Candidate ${candidate.name} (${candidate.email}) status updated to Opened`);
        broadcastCandidateUpdate(candidateId, 'Opened', candidate.openedAt);
      }
    } else {
      if (mongoose.Types.ObjectId.isValid(candidateId)) {
        const candidate = await Candidate.findById(candidateId);
        if (candidate) {
          candidate.status = 'Opened';
          candidate.openedAt = new Date();
          await candidate.save();
          console.log(`[DB] Candidate ${candidate.name} (${candidate.email}) status updated to Opened`);
          broadcastCandidateUpdate(candidate._id.toString(), 'Opened', candidate.openedAt);
        }
      }
    }
  } catch (error) {
    console.error('Error updating candidate open status:', error);
  }

  // 1x1 pixel transparent GIF
  const trackingPixel = Buffer.from(
    'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
    'base64'
  );
  
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': trackingPixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(trackingPixel);
});

// Public endpoints for candidate online offer viewer portal

// GET candidate offer details
router.get('/public/candidate-offer/:candidateId', async (req, res) => {
  const { candidateId } = req.params;
  try {
    const isOffline = mongoose.connection.readyState !== 1;
    if (isOffline) {
      const candidate = inMemoryCandidates.find(c => c._id === candidateId);
      if (!candidate) return res.status(404).json({ message: 'Offer letter not found.' });
      
      const company = inMemoryCompanies.find(c => c._id === candidate.companyId) || defaultCompany;
      const template = inMemoryTemplates.find(t => t._id === candidate.templateId) || defaultTemplates[0];
      return res.json({ candidate, company, template });
    }

    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({ message: 'Invalid Offer ID' });
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ message: 'Offer letter not found.' });

    const campaign = await Campaign.findById(candidate.campaignId).populate('companyId').populate('templateId');
    if (!campaign) return res.status(404).json({ message: 'Offer campaign not found.' });

    res.json({
      candidate,
      company: campaign.companyId,
      template: campaign.templateId
    });
  } catch (error) {
    console.error('Error fetching public candidate offer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET candidate offer PDF attachment download
router.get('/public/candidate-offer/:candidateId/pdf', async (req, res) => {
  const { candidateId } = req.params;
  try {
    const isOffline = mongoose.connection.readyState !== 1;
    if (isOffline) {
      return res.status(400).json({ message: 'PDF generation is not available in offline mode.' });
    }

    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({ message: 'Invalid Offer ID' });
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ message: 'Offer letter not found.' });

    const campaign = await Campaign.findById(candidate.campaignId).populate('companyId').populate('templateId');
    if (!campaign) return res.status(404).json({ message: 'Offer campaign not found.' });

    // Format the email body variables
    const vars = {
      Name: candidate.name,
      Role: candidate.role,
      Department: candidate.department,
      Salary: candidate.salary,
      StartDate: candidate.joiningDate,
      JoiningDate: candidate.joiningDate,
      Company: campaign.companyId.name,
      Manager: 'HR Team'
    };

    if (candidate.customFields) {
      if (typeof candidate.customFields.forEach === 'function') {
        candidate.customFields.forEach((val, key) => {
          vars[key] = val;
        });
      } else {
        Object.keys(candidate.customFields).forEach(key => {
          vars[key] = candidate.customFields[key];
        });
      }
    }

    let mailBody = campaign.templateId.body;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      mailBody = mailBody.replace(regex, vars[key] !== undefined ? vars[key] : '');
    });
    mailBody = mailBody.replace(/{{\s*(.*?)\s*}}/g, '$1');

    const pdfBuffer = await generateOfferLetterPdf(
      candidate,
      campaign.companyId,
      campaign.templateId,
      mailBody,
      campaign.templateId.style
    );

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${candidate.name.replace(/\s+/g, '_')}_Offer_Letter.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Error generating public candidate PDF:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST accept candidate offer
router.post('/public/candidate-offer/:candidateId/accept', async (req, res) => {
  const { candidateId } = req.params;
  try {
    const isOffline = mongoose.connection.readyState !== 1;
    if (isOffline) {
      const candidate = inMemoryCandidates.find(c => c._id === candidateId);
      if (candidate) {
        candidate.status = 'Accepted';
        console.log(`[Offline] Candidate ${candidate.name} accepted offer`);
        broadcastCandidateUpdate(candidateId, 'Accepted');
        return res.json({ success: true, candidate });
      }
      return res.status(404).json({ message: 'Candidate not found.' });
    }

    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({ message: 'Invalid Offer ID' });
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ message: 'Offer letter not found.' });

    candidate.status = 'Accepted';
    await candidate.save();

    // Log the accept action to History
    await History.create({
      campaignId: candidate.campaignId,
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      status: 'Accepted'
    });

    console.log(`[DB] Candidate ${candidate.name} accepted offer`);
    broadcastCandidateUpdate(candidate._id.toString(), 'Accepted');

    res.json({ success: true, candidate });
  } catch (error) {
    console.error('Error accepting candidate offer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
