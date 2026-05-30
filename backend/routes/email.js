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

        const templateStyle = template ? (template.style || 'Modern') : 'Modern';
        const bodyHtml = mailBody.replace(/\n/g, '<br/>');
        const logoSrc = svgToDataUri(company.logo);
        let logoHtml = '';
        let emailAttachments = [];

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

        const isLocal = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
        const protocol = isLocal ? 'http' : 'https';
        const trackingHost = isLocal ? req.get('host') : 'offer-letter-generator-whu4.onrender.com';
        const trackingPixelUrl = `${protocol}://${trackingHost}/api/email/track/${candidate._id}.gif`;
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

// Active SSE clients for real-time open notifications
let sseClients = [];

// Helper function to broadcast open events
const notifyClientsOfOpen = (candidateId, status, openedAt) => {
  const data = JSON.stringify({ candidateId, status, openedAt });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[SSE] Error writing to client:', err);
    }
  });
};

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
router.get('/track/:candidateId.gif', async (req, res) => {
  const { candidateId } = req.params;
  console.log(`Tracking pixel requested for candidate: ${candidateId}`);
  
  try {
    const isOffline = mongoose.connection.readyState !== 1;
    
    if (isOffline) {
      const candidate = inMemoryCandidates.find(c => c._id === candidateId);
      if (candidate) {
        candidate.status = 'Opened';
        candidate.openedAt = new Date();
        console.log(`[Offline] Candidate ${candidate.name} (${candidate.email}) status updated to Opened`);
        notifyClientsOfOpen(candidateId, 'Opened', candidate.openedAt);
      }
    } else {
      if (mongoose.Types.ObjectId.isValid(candidateId)) {
        const candidate = await Candidate.findById(candidateId);
        if (candidate) {
          candidate.status = 'Opened';
          candidate.openedAt = new Date();
          await candidate.save();
          console.log(`[DB] Candidate ${candidate.name} (${candidate.email}) status updated to Opened`);
          notifyClientsOfOpen(candidate._id.toString(), 'Opened', candidate.openedAt);
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
    'Expires': '0'
  });
  res.end(trackingPixel);
});

export default router;
