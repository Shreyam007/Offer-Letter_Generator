import express from 'express';
import nodemailer from 'nodemailer';
import Campaign from '../models/Campaign.js';
import Candidate from '../models/Candidate.js';
import Company from '../models/Company.js';
import Template from '../models/Template.js';
import History from '../models/History.js';

const router = express.Router();

// Helper to compile template variables
const compileTemplate = (text, variables) => {
  if (!text) return '';
  let result = text;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, variables[key] !== undefined && variables[key] !== null ? variables[key] : '');
  });
  // Strip out any remaining curly brackets {{ ... }} to leave only the inner text/value
  result = result.replace(/{{\s*(.*?)\s*}}/g, '$1');
  return result;
};


// Helper to create Nodemailer transporter
const createTransporter = (smtp) => {
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    return null; // Signals mock mode
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: smtp.secure || false,
    auth: {
      user: smtp.user,
      pass: smtp.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Helper to verify SMTP credentials and return a transporter if valid.
const verifySmtp = async (smtp) => {
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    return { ok: false, reason: 'Missing SMTP configuration' };
  }

  const transporter = createTransporter(smtp);
  try {
    await transporter.verify();
    return { ok: true, transporter };
  } catch (err) {
    // Normalize error message for frontend display
    const message = err && err.message ? err.message : String(err);
    return { ok: false, reason: message, code: err && err.code };
  }
};

// POST test SMTP connection
router.post('/test-smtp', async (req, res) => {
  const { smtp } = req.body;
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    return res.status(400).json({ message: 'SMTP credentials missing. Enter host, port, user and password.' });
  }

  try {
    const result = await verifySmtp(smtp);
    if (result.ok) {
      return res.json({ success: true, message: 'SMTP connection verified successfully!' });
    }

    // Provide actionable suggestions for common authentication errors
    let suggestion = '';
    if (result.reason && /535|Authentication|Invalid login|BadCredentials/i.test(result.reason)) {
      suggestion = 'If you are using Gmail, create an App Password and use it here (https://support.google.com/accounts/answer/185833). Alternatively, use a transactional email provider (SendGrid/Mailgun) or Mailtrap for testing.';
    }

    res.status(500).json({ message: `SMTP connection failed: ${result.reason}`, suggestion });
  } catch (error) {
    res.status(500).json({ message: `SMTP connection failed: ${error.message}` });
  }
});

// POST send campaign (Asynchronous sending loop)
router.post('/send-campaign', async (req, res) => {
  const { campaignId, candidateIds, delayMs, retryOnFailure } = req.body;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const company = await Company.findById(campaign.companyId);
    const template = await Template.findById(campaign.templateId);

    if (!company) {
      return res.status(404).json({ message: 'Company profile not found for this campaign' });
    }

    const targetCandidates = await Candidate.find({
      _id: { $in: candidateIds },
      campaignId: campaignId
    });

    if (targetCandidates.length === 0) {
      return res.status(400).json({ message: 'No candidates selected or found' });
    }

    // Verify SMTP (fail fast if credentials are invalid)
    const verifyResult = await verifySmtp(company.smtp);
    if (!verifyResult.ok) {
      let suggestion = '';
      if (/535|Authentication|Invalid login|BadCredentials/i.test(verifyResult.reason || '')) {
        suggestion = 'If you use Gmail, generate an App Password (https://support.google.com/accounts/answer/185833) or use a transactional email provider/Mailtrap for testing.';
      }

      return res.status(400).json({ message: `SMTP verification failed: ${verifyResult.reason}`, suggestion });
    }

    // Set campaign status to Sending
    campaign.status = 'Sending';
    campaign.sentCount = 0;
    campaign.failedCount = 0;
    await campaign.save();

    // Reset status of selected candidates to Pending before starting
    await Candidate.updateMany(
      { _id: { $in: candidateIds } },
      { $set: { status: 'Pending', error: '' } }
    );

    // Respond immediately to the frontend, processing runs in the background
    res.json({ message: 'Offer letter dispatch started in background', total: targetCandidates.length });

    // Asynchronous background execution
    (async () => {
      const transporter = verifyResult.transporter; // verified transporter
      const delay = Number(delayMs) || 1500;

      for (let i = 0; i < targetCandidates.length; i++) {
        const candidate = targetCandidates[i];
        
        // Update candidate status to Sending
        candidate.status = 'Sending';
        await candidate.save();

        // Prepare email content
        const templateVariables = {
          Name: candidate.name,
          Role: candidate.role,
          Department: candidate.department,
          Salary: candidate.salary,
          StartDate: candidate.joiningDate,
          JoiningDate: candidate.joiningDate,
          Company: company.name,
          Manager: template && template.body.includes('{{Manager}}') ? 'HR Team' : '', // default if placeholder
          ...Object.fromEntries(candidate.customFields || new Map())
        };

        const mailSubject = compileTemplate(template ? template.subject : 'Offer of Employment', templateVariables);
        const mailBody = compileTemplate(template ? template.body : 'Dear {{Name}}, Congratulations!', templateVariables);

        let sentSuccess = false;
        let errorMessage = '';
        const maxRetries = retryOnFailure ? 3 : 1;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (attempt > 1) {
            candidate.status = 'Retrying';
            await candidate.save();
            // Wait a short time before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          try {
            if (transporter) {
              // Real SMTP email sending
              await transporter.sendMail({
                from: `"${company.name}" <${company.smtp.user}>`,
                to: candidate.email,
                subject: mailSubject,
                text: mailBody,
                html: mailBody.replace(/\n/g, '<br/>') // Basic text to HTML formatting
              });
            } else {
              // MOCK SIMULATION MODE (if SMTP config is not fully set)
              await new Promise(resolve => setTimeout(resolve, 800)); // Simulate work
              
              // For simulation: inject a small chance of failure to test failed/retry UI
              if (candidate.email.includes('fail') || (i === 1 && Math.random() > 0.5)) {
                throw new Error('Simulated SMTP connection timeout');
              }
            }
            sentSuccess = true;
            break; // Break out of retry loop on success
          } catch (err) {
            errorMessage = err.message;
            console.error(`Attempt ${attempt} failed for ${candidate.email}: ${errorMessage}`);
          }
        }

        if (sentSuccess) {
          candidate.status = 'Sent';
          candidate.error = '';
          await candidate.save();

          campaign.sentCount += 1;
          await campaign.save();

          // Write to persistent History logs
          await History.create({
            campaignId,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            status: 'Sent'
          });
        } else {
          candidate.status = 'Failed';
          candidate.error = errorMessage;
          await candidate.save();

          campaign.failedCount += 1;
          await campaign.save();

          await History.create({
            campaignId,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            status: 'Failed',
            error: errorMessage
          });
        }

        // Wait between emails (unless it is the last candidate)
        if (i < targetCandidates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Mark campaign completed
      campaign.status = 'Completed';
      await campaign.save();
      console.log(`Campaign ${campaign.name} dispatch completed!`);
    })();

  } catch (error) {
    console.error('Error dispatching campaign:', error);
  }
});

export default router;
