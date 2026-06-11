import React, { useState, useEffect } from 'react';
import { useApp, AICTE_LOGO_SVG, API_BASE } from '../context/AppContext';
import { 
  FileText, 
  Download, 
  X, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Percent, 
  TrendingUp, 
  Layers,
  ChevronRight,
  Eye,
  RefreshCw,
  Clock
} from 'lucide-react';

const HistoryTab = () => {
  const { campaigns, templates, loadCampaigns } = useApp();
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignCandidates, setCampaignCandidates] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleOpenDrawer = async (campaign) => {
    setSelectedCampaign(campaign);
    setDrawerOpen(true);
    setLoadingCandidates(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaign._id}/candidates`);
      const data = await res.json();
      setCampaignCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Real-time automatic polling and Server-Sent Events when candidate details log drawer is open
  useEffect(() => {
    if (!drawerOpen || !selectedCampaign) return;

    // 1. Establish SSE connection for instant real-time updates
    const eventSource = new EventSource(`${API_BASE}/email/track/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const updatedCandidate = JSON.parse(event.data);
        console.log("[SSE] Received candidate status update:", updatedCandidate);
        
        // Instantly update the candidate in the local state
        setCampaignCandidates(prev => prev.map(c => 
          c._id === updatedCandidate.candidateId 
            ? { 
                ...c, 
                status: updatedCandidate.status, 
                openedAt: updatedCandidate.openedAt || c.openedAt,
                error: updatedCandidate.error !== undefined ? updatedCandidate.error : c.error
              }
            : c
        ));
      } catch (err) {
        console.error("[SSE] Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.log("[SSE] EventSource connection closed or failed. Polling fallback remains active.");
    };

    // 2. Set up fallback polling with cache-busting to bypass any intermediary caching
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/campaigns/${selectedCampaign._id}/candidates?t=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setCampaignCandidates(data);
        }
      } catch (err) {
        console.error("Error polling candidates:", err);
      }
    }, 3000); // Poll every 3 seconds as a safety fallback

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [drawerOpen, selectedCampaign]);

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedCampaign(null);
    setCampaignCandidates([]);
  };

  // Compile letter variables (helper to print PDF in history)
  const compileText = (text, candidate, companyName) => {
    if (!text || !candidate) return '';
    const vars = {
      Name: candidate.name,
      Role: candidate.role,
      Department: candidate.department,
      Salary: candidate.salary,
      StartDate: candidate.joiningDate,
      JoiningDate: candidate.joiningDate,
      Company: companyName || 'Global Corp',
      Manager: 'HR Team'
    };

    // Add candidate custom fields to vars
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

    let result = text;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, vars[key] !== undefined && vars[key] !== null ? vars[key] : '');
    });

    // Strip out any remaining curly brackets {{ ... }} to leave only the inner text/value
    result = result.replace(/{{\s*(.*?)\s*}}/g, '$1');

    return result;
  };


  // Download PDF from History details
  const handleDownloadPDF = (candidate) => {
    if (!selectedCampaign) return;
    
    const company = selectedCampaign.companyId || {};
    // Find the campaign template
    const template = templates.find(t => t._id === selectedCampaign.templateId?._id) || templates[0];
    const style = template?.style || 'Modern';

    const getLogoHtml = (logoStr) => {
      if (!logoStr) return `<span style="font-weight: bold; color: #0b3c95; font-size: 20px;">${company.name || 'Company'}</span>`;
      if (logoStr.trim().startsWith('<svg')) {
        return logoStr;
      }
      return `<img src="${logoStr}" style="width: 100%; height: 100%; object-fit: contain;" />`;
    };

    let headerHtml = '';
    if (style === 'Classic') {
      headerHtml = `
        <div class="letter-header" style="text-align: center; border-bottom: 3px double #94a3b8; padding-bottom: 24px; margin-bottom: 36px; width: 100%;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 16px;">
            <div class="letter-logo-box" style="height: 48px; display: flex; align-items: center; justify-content: center;">
              ${getLogoHtml(company.logo)}
            </div>
            <div style="width: 1px; height: 32px; background-color: #cbd5e1;"></div>
            <div class="letter-logo-box" style="height: 48px; display: flex; align-items: center; justify-content: center;">
              ${getLogoHtml(AICTE_LOGO_SVG)}
            </div>
          </div>
          <div class="company-title" style="font-size: 24px; font-family: Georgia, serif; font-weight: bold; color: #1e293b; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">${company.name || 'Company'}</div>
          <div style="font-size: 11px; color: #64748b; font-family: Georgia, serif;">${company.tagline || ''}</div>
        </div>
      `;
    } else if (style === 'Minimal') {
      headerHtml = `
        <div class="letter-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; width: 100%;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="letter-logo-box" style="height: 36px; display: flex; align-items: center; justify-content: center;">
              ${getLogoHtml(company.logo)}
            </div>
            <div style="width: 1px; height: 24px; background-color: #cbd5e1;"></div>
            <div class="letter-logo-box" style="height: 36px; display: flex; align-items: center; justify-content: center;">
              ${getLogoHtml(AICTE_LOGO_SVG)}
            </div>
          </div>
          <span style="font-size: 12px; font-weight: 600; color: #334155;">${company.name || 'Company'}</span>
        </div>
      `;
    } else {
      // Modern style
      headerHtml = `
        <div class="letter-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; width: 100%; border-top: 6px solid #0b3c95; padding-top: 20px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="letter-logo-box" style="height: 44px; display: flex; align-items: center; justify-content: center;">
              ${getLogoHtml(company.logo)}
            </div>
            <div style="width: 1px; height: 28px; background-color: #e2e8f0;"></div>
            <div class="letter-logo-box" style="height: 44px; display: flex; align-items: center; justify-content: center;">
              ${getLogoHtml(AICTE_LOGO_SVG)}
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div>October 24, 2026</div>
            <div>Ref: HIST-${candidate._id.substring(0, 6).toUpperCase()}</div>
          </div>
        </div>
      `;
    }

    // Create a temporary element off-screen to render and compile the PDF
    const printEl = document.createElement('div');
    printEl.style.position = 'fixed';
    printEl.style.left = '-9999px';
    printEl.style.top = '-9999px';

    let innerHtml = '';
    if (style === 'Classic') {
      innerHtml = `
        <div class="classic-watermark" style="position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); width: 180px; height: 180px; opacity: 0.04; pointer-events: none; z-index: 0;">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="50" cy="50" r="45" stroke-dasharray="3 3"></circle>
            <circle cx="50" cy="50" r="38"></circle>
            <path d="M50 22 L58 38 L76 41 L63 54 L66 72 L50 64 L34 72 L37 54 L24 41 L42 38 Z" fill="currentColor"></path>
          </svg>
        </div>
        ${headerHtml}
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 24px; color: #475569; font-family: Georgia, serif;">
          <span>Ref: HIST-${candidate._id.substring(0, 6).toUpperCase()}</span>
          <span>October 24, 2026</span>
        </div>
        <div style="text-align: center; margin: 24px 0 16px 0;">
          <h3 style="font-family: Georgia, serif; letter-spacing: 3px; font-size: 15px; text-transform: uppercase; color: #1e1b18; border-bottom: 1px solid #c5a059; padding-bottom: 8px; display: inline-block;">Letter of Appointment</h3>
        </div>
        <div style="margin-bottom: 24px; font-family: Georgia, serif; font-weight: bold; color: #1e1b18;">
          Dear ${candidate.name},
        </div>
        <div style="margin-bottom: 24px; white-space: pre-wrap; font-size: 13px; line-height: 1.7; font-family: Georgia, serif; color: #1e1b18; text-align: justify;">
          ${compileText(template?.body, candidate)}
        </div>
        <div class="letter-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; border-top: 3px double #d4af37; border-bottom: 3px double #d4af37; margin-bottom: 24px; padding: 8px 0; background-color: rgba(253, 252, 247, 0.4); font-family: Georgia, serif;">
          <div style="text-align: center; padding: 8px; border-right: 1px solid rgba(212, 175, 55, 0.3);">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #854d0e; letter-spacing: 1px; margin-bottom: 4px;">Salary</div>
            <div style="font-size: 16px; font-weight: bold; color: #1e1b18;">${candidate.salary}</div>
          </div>
          <div style="text-align: center; padding: 8px;">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #854d0e; letter-spacing: 1px; margin-bottom: 4px;">Start Date</div>
            <div style="font-size: 16px; font-weight: bold; color: #1e1b18;">${candidate.joiningDate}</div>
          </div>
        </div>
        <div class="classic-signature-area" style="margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; font-family: Georgia, serif;">
          <div style="line-height: 1.6; color: #1e1b18; font-size: 13px;">
            Sincerely,<br/><br/>
            <div style="font-family: 'Brush Script MT', 'Dancing Script', Georgia, cursive, serif; font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; letter-spacing: 1.5px;">Emily Watson</div>
            <strong>Director of Talent Acquisition</strong><br/>
            ${company.name || 'Company'}
          </div>
          <div style="width: 60px; height: 60px; background: radial-gradient(circle, #b91c1c 60%, #991b1b 100%); border-radius: 50%; border: 3px double #fca5a5; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; color: #fecaca; font-size: 8px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; transform: rotate(-10deg); opacity: 0.95; margin-right: 12px;">
            OFFICIAL SEAL
          </div>
        </div>
      `;
    } else if (style === 'Minimal') {
      innerHtml = `
        <div class="minimal-tag" style="font-family: monospace; font-size: 8px; color: #e11d48; letter-spacing: 2.5px; margin-bottom: 24px; font-weight: bold; text-transform: uppercase;">OFFER.MINIMAL.DOC</div>
        ${headerHtml}
        <div style="font-family: monospace; font-size: 10px; color: #71717a; margin-bottom: 24px; border-bottom: 1px solid #f4f4f5; padding-bottom: 10px; letter-spacing: 0.5px; text-transform: uppercase;">
          October 24, 2026 / Ref: HIST-${candidate._id.substring(0, 6).toUpperCase()}
        </div>
        <div style="margin-bottom: 24px; font-family: Inter, sans-serif; font-size: 12.5px; color: #3f3f46; line-height: 1.8; white-space: pre-wrap;">
          Dear ${candidate.name},<br/><br/>
          ${compileText(template?.body, candidate)}
        </div>
        <div class="minimal-stats-container" style="margin-top: 24px; margin-bottom: 24px; border-top: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7; padding: 16px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 11px; color: #3f3f46; margin-bottom: 8px;">
            <span style="font-weight: bold; color: #71717a; text-transform: uppercase;">COMPENSATION</span>
            <span style="font-weight: bold; color: #18181b;">${candidate.salary}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 11px; color: #3f3f46;">
            <span style="font-weight: bold; color: #71717a; text-transform: uppercase;">START DATE</span>
            <span style="font-weight: bold; color: #18181b;">${candidate.joiningDate}</span>
          </div>
        </div>
        <div style="margin-top: 24px; font-family: Inter, sans-serif; font-size: 12px; color: #3f3f46;">
          Warm regards,<br/><br/>
          <strong>${company.name || 'Company'} HR</strong>
        </div>
        <div class="minimal-footer" style="font-family: monospace; font-size: 8px; color: #a1a1aa; margin-top: auto; letter-spacing: 0.5px; border-top: 1px solid #f4f4f5; padding-top: 12px; text-transform: uppercase;">
          CONFIDENTIALITY NOTICE: The information in this document is private.
        </div>
      `;
    } else {
      innerHtml = `
        ${headerHtml}
        <div class="modern-badge" style="align-self: flex-start; background-color: #4f46e5; color: #ffffff; font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); display: inline-block;">Employment Offer</div>
        <div style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; font-family: Inter, sans-serif;">
          <strong>Dear ${candidate.name},</strong>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">${candidate.email}</div>
        </div>
        <div style="margin-bottom: 24px; white-space: pre-wrap; font-size: 13px; line-height: 1.7; font-family: Inter, sans-serif; color: #334155;">
          ${compileText(template?.body, candidate)}
        </div>
        <div class="letter-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); padding: 20px; border-radius: 12px; border: 1px solid #c7d2fe; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.05); font-family: Inter, sans-serif;">
          <div>
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #4f46e5; letter-spacing: 1px; margin-bottom: 6px;">Annual Salary</div>
            <div style="font-size: 18px; font-weight: 800; color: #1e1b4b;">${candidate.salary}</div>
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #4f46e5; letter-spacing: 1px; margin-bottom: 6px;">Start Date</div>
            <div style="font-size: 18px; font-weight: 800; color: #1e1b4b;">${candidate.joiningDate}</div>
          </div>
        </div>
        <div class="modern-signature" style="margin-top: 24px; display: flex; flex-direction: column; gap: 4px; font-family: Inter, sans-serif;">
          <div class="sig-line" style="width: 150px; height: 1px; background-color: #cbd5e1; margin-bottom: 4px;"></div>
          <div class="sig-text" style="font-size: 11px; color: #64748b;">HR Team, Talent Acquisition</div>
          <div style="font-size: 10px; color: #94a3b8;">${company.name || 'Company'}</div>
        </div>
        <div class="modern-security-seal" style="margin-left: auto; margin-top: 10px; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-family: monospace; font-size: 9px; font-weight: bold; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
          <svg width="10" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>SECURE & VERIFIED DOCUMENT</span>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; margin-top: auto; font-family: Inter, sans-serif;">
          This is a computer-generated offer letter from ${company.name || 'Company'} HR department.
        </div>
      `;
    }

    printEl.innerHTML = `
      <div id="print-letter-content" class="letter-sheet style-${style.toLowerCase()}" style="width: 8.5in; min-height: 11in; padding: 40px; background-color: #ffffff; font-family: 'Inter', sans-serif; position: relative;">
        ${innerHtml}
      </div>
    `;

    document.body.appendChild(printEl);

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `${candidate.name.replace(/\s+/g, '_')}_Offer_Letter.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    window.html2pdf().from(printEl.querySelector('#print-letter-content')).set(opt).save().then(() => {
      document.body.removeChild(printEl);
    });
  };

  // Aggregate Metrics Calculations
  const completedCampaigns = campaigns.filter(c => c.status === 'Completed' || c.status === 'Sending');
  const totalDispatched = completedCampaigns.reduce((acc, c) => acc + (c.sentCount || 0) + (c.failedCount || 0), 0);
  const totalSent = completedCampaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalFailed = completedCampaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
  
  const deliveryRate = totalDispatched > 0 
    ? Math.round((totalSent / totalDispatched) * 100) 
    : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Campaign Archives & History</h2>
        <p className="text-slate-500 text-sm mt-1">Audit log of all dispatched campaigns, statuses, and generated documents.</p>
      </div>

      {/* Aggregate Statistics Row */}
      <div className="history-stats-row">
        <div className="stat-box" style={{ borderLeftColor: 'var(--primary-color)' }}>
          <div className="flex justify-between items-center">
            <div className="stat-label">Letters Dispatched</div>
            <Users size={16} className="text-blue-500" />
          </div>
          <div className="stat-value">{totalDispatched}</div>
        </div>

        <div className="stat-box success">
          <div className="flex justify-between items-center">
            <div className="stat-label">Delivery Success</div>
            <Percent size={16} className="text-emerald-500" />
          </div>
          <div className="stat-value">{deliveryRate}%</div>
        </div>

        <div className="stat-box" style={{ borderLeftColor: 'var(--warning-color)' }}>
          <div className="flex justify-between items-center">
            <div className="stat-label">Campaigns Sent</div>
            <Layers size={16} className="text-amber-500" />
          </div>
          <div className="stat-value">{completedCampaigns.length}</div>
        </div>

        <div className="stat-box danger">
          <div className="flex justify-between items-center">
            <div className="stat-label">Failed Deliveries</div>
            <XCircle size={16} className="text-red-500" />
          </div>
          <div className="stat-value text-red-600">{totalFailed}</div>
        </div>
      </div>

      {/* Campaigns list */}
      <div className="flex flex-col gap-4">
        <span className="settings-label">All Sends</span>
        
        {campaigns.length > 0 ? (
          campaigns.map((camp) => (
            <div 
              key={camp._id} 
              className="history-campaign-item"
              onClick={() => handleOpenDrawer(camp)}
            >
              <div className="hist-camp-left">
                <div className="hist-camp-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="hist-camp-name">{camp.name}</div>
                  <div className="hist-camp-meta">
                    Company: <strong>{camp.companyId?.name || 'Global Corp'}</strong> • Sent: {new Date(camp.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="hist-camp-right">
                <div className="hist-camp-stats">
                  <div className="hist-camp-stat-box">
                    <span className="hist-camp-stat-val">{camp.totalCount || 0}</span>
                    <span className="hist-camp-stat-lbl">Candidates</span>
                  </div>
                  <div className="hist-camp-stat-box">
                    <span className="hist-camp-stat-val text-emerald-600">{camp.sentCount || 0}</span>
                    <span className="hist-camp-stat-lbl">Sent</span>
                  </div>
                  <div className="hist-camp-stat-box">
                    <span className="hist-camp-stat-val text-red-500">{camp.failedCount || 0}</span>
                    <span className="hist-camp-stat-lbl">Failed</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </div>
            </div>
          ))
        ) : (
          <div className="card text-center p-12 text-slate-400">
            No campaigns found. Upload a CSV to get started.
          </div>
        )}
      </div>

      {/* Slide-out Drawer Detail Panel */}
      {drawerOpen && selectedCampaign && (
        <div className="drawer-backdrop" onClick={handleCloseDrawer}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 className="drawer-title">{selectedCampaign.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sent on {new Date(selectedCampaign.createdAt).toLocaleString()}
                </p>
              </div>
              <button className="drawer-close-btn" onClick={handleCloseDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-100 rounded-lg">
                <div style={{ fontSize: '12px' }}>
                  Company: <strong>{selectedCampaign.companyId?.name || 'Global Corp'}</strong><br/>
                  Template used: <strong>{selectedCampaign.templateId?.name || 'Default Template'}</strong>
                </div>
                
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                  Total Candidates: <strong>{selectedCampaign.totalCount || 0}</strong><br/>
                  Success rate: <strong className="text-emerald-600">
                    {selectedCampaign.totalCount > 0 
                      ? Math.round(((selectedCampaign.sentCount || 0) / selectedCampaign.totalCount) * 100) 
                      : 0}%
                  </strong>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="settings-label">Candidates Logs</span>
                
                {loadingCandidates ? (
                  <div className="text-center p-8">
                    <RefreshCw className="animate-spin text-blue-600 inline-block mr-2" />
                    <span className="text-sm font-semibold">Loading logs...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                    {campaignCandidates.map((cand) => (
                      <div 
                        key={cand._id}
                        className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="font-semibold text-sm truncate">{cand.name}</div>
                          <div className="text-xs text-slate-400 truncate">{cand.email}</div>
                          {cand.openedAt && (
                            <div className="text-xs text-blue-500 mt-1 font-medium">
                              Opened: {new Date(cand.openedAt).toLocaleString()}
                            </div>
                          )}
                          {cand.error && (
                            <div className="text-xs text-red-600 mt-1.5 bg-red-50 p-2 rounded border border-red-100 font-medium">
                              <strong>Error:</strong> {cand.error}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {cand.status === 'Opened' ? (
                            <span className="text-blue-600 flex items-center gap-1 text-xs font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full" title={cand.openedAt ? `Opened at: ${new Date(cand.openedAt).toLocaleString()}` : ''}>
                              <Eye size={12} />
                              <span>Opened</span>
                            </span>
                          ) : cand.status === 'Sent' ? (
                            <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} />
                              <span>Sent</span>
                            </span>
                          ) : cand.status === 'Failed' ? (
                            <span className="text-pink-600 flex items-center gap-1 text-xs font-bold bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-full" title={cand.error}>
                              <XCircle size={12} />
                              <span>Failed</span>
                            </span>
                          ) : ['Sending', 'Retrying'].includes(cand.status) ? (
                            <span className="text-blue-600 flex items-center gap-1 text-xs font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                              <RefreshCw size={12} className="animate-spin" />
                              <span>{cand.status}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center gap-1 text-xs font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              <Clock size={12} />
                              <span>Pending</span>
                            </span>
                          )}

                          <button 
                            className="header-icon-btn text-slate-500 hover:text-blue-600 hover:bg-white" 
                            title="Download Historical PDF"
                            onClick={() => handleDownloadPDF(cand)}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {campaignCandidates.length === 0 && (
                      <div className="text-slate-400 text-center py-6 text-sm">
                        No candidates listed in this campaign history.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn btn-secondary" onClick={handleCloseDrawer}>
                Close Audit Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryTab;
