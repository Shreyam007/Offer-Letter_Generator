import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Campaign from '../models/Campaign.js';
import Candidate from '../models/Candidate.js';
import Company from '../models/Company.js';
import Template from '../models/Template.js';
import History from '../models/History.js';
import { inMemoryCompanies } from './companies.js';
import { inMemoryTemplates } from './templates.js';
import { inMemoryCampaigns, inMemoryCandidates } from './campaigns.js';

const router = express.Router();

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
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.pass}`
      },
      body: JSON.stringify(mailOptions)
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
    company = inMemoryCompanies.find(c => c._id === (typeof campaign.companyId === 'object' ? campaign.companyId._id : campaign.companyId));
    template = inMemoryTemplates.find(t => t._id === (typeof campaign.templateId === 'object' ? campaign.templateId._id : campaign.templateId));
    targetCandidates = inMemoryCandidates.filter(c => candidateIds.includes(c._id) && c.campaignId === campaignId);
  } else {
    campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    company = await Company.findById(campaign.companyId);
    template = await Template.findById(campaign.templateId);
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
          await new Promise(resolve => setTimeout(resolve, 1000));
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
            html: mailBody.replace(/\n/g, '<br/>')
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
      } else {
        candidate.status = 'Failed';
        candidate.error = errorMessage;
        campaign.failedCount += 1;
        if (!isOffline) {
          await candidate.save();
          await campaign.save();
          await History.create({ campaignId, candidateName: candidate.name, candidateEmail: candidate.email, status: 'Failed', error: errorMessage });
        }
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

export default router;
