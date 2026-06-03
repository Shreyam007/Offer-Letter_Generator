import React, { useState, useEffect, useRef } from 'react';
import { useApp, AICTE_LOGO_SVG, API_BASE } from '../context/AppContext';
import { 
  ArrowLeft, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Eye
} from 'lucide-react';

const PreviewSend = () => {
  const { 
    currentCampaign, 
    selectedCompany, 
    templates, 
    candidates, 
    selectedCandidateIds,
    triggerEmailDispatch,
    loadCandidates,
    loadCampaigns,
    setStep 
  } = useApp();

  const [previewIndex, setPreviewIndex] = useState(0);
  const [delayMs, setDelayMs] = useState(1500);
  const [retryOnFailure, setRetryOnFailure] = useState(true);
  const [sending, setSending] = useState(false);
  const [pollIntervalId, setPollIntervalId] = useState(null);

  // Get only selected candidates
  const selectedCandidates = candidates.filter(c => selectedCandidateIds.includes(c._id));
  const activeCandidate = selectedCandidates[previewIndex];
  
  // Find current template
  const template = templates.find(t => t.companyId?._id === selectedCompany?._id) || templates[0];
  const style = template?.style || 'Modern';

  // Store candidate statuses to track transitions and alert on updates
  const prevStatusesRef = useRef({});

  // Keep selectedCandidateIds in a ref to avoid stale closure issues in setInterval
  const selectedCandidateIdsRef = useRef(selectedCandidateIds);
  useEffect(() => {
    selectedCandidateIdsRef.current = selectedCandidateIds;
  }, [selectedCandidateIds]);

  // Initialize/reset previous statuses whenever sending starts/stops or candidates change
  useEffect(() => {
    const initialStatuses = {};
    selectedCandidates.forEach(c => {
      initialStatuses[c._id] = c.status;
    });
    prevStatusesRef.current = initialStatuses;
  }, [sending]);

  // Poll for progress updates if sending
  useEffect(() => {
    if (sending) {
      const interval = setInterval(async () => {
        await loadCandidates(currentCampaign._id);
        await loadCampaigns();
        
        // Check if sending completed
        const freshCandidates = await fetch(`${API_BASE}/campaigns/${currentCampaign._id}/candidates`).then(r => r.json());
        const targetCandidates = freshCandidates.filter(c => selectedCandidateIdsRef.current.includes(c._id));
        
        // Alert on status transitions
        targetCandidates.forEach(cand => {
          const oldStatus = prevStatusesRef.current[cand._id];
          if (oldStatus !== undefined && oldStatus !== cand.status) {
            if (cand.status === 'Sent') {
              alert(`Email sent successfully to ${cand.name}`);
            } else if (cand.status === 'Failed') {
              alert(`Failed to send email to ${cand.name}${cand.error ? ': ' + cand.error : ''}`);
            }
          }
          prevStatusesRef.current[cand._id] = cand.status;
        });

        const allDone = targetCandidates.every(c => ['Sent', 'Failed', 'Opened'].includes(c.status));
        
        if (allDone) {
          setSending(false);
          clearInterval(interval);
        }
      }, 1000);
      
      setPollIntervalId(interval);
      return () => clearInterval(interval);
    } else {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
    }
  }, [sending]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, [pollIntervalId]);

  // Compile letter template for current preview candidate
  const compileText = (text, candidate) => {
    if (!text || !candidate) return '';
    
    const vars = {
      Name: candidate.name,
      Role: candidate.role,
      Department: candidate.department,
      Salary: candidate.salary,
      StartDate: candidate.joiningDate,
      JoiningDate: candidate.joiningDate,
      Company: selectedCompany?.name || 'Global Corp',
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


  // Auto-detect HTML and convert newlines for plain text
  const renderLetterBody = (bodyText, activeCand) => {
    const compiled = compileText(bodyText, activeCand);
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(compiled);
    if (isHtml) {
      return { __html: compiled };
    }
    return { __html: compiled.replace(/\n/g, '<br/>') };
  };

  // Download PDF of the currently selected candidate letter
  const handleDownloadPDF = () => {
    if (!activeCandidate) return;

    const element = document.getElementById('letter-preview-sheet');
    if (!element) {
      alert('Letter preview element not found.');
      return;
    }

    // Clone the element to render full dimensions off-screen and prevent scroll truncation
    const clone = element.cloneNode(true);
    clone.style.width = '800px';
    clone.style.minHeight = '1050px';
    clone.style.padding = '40px';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '-9999px';
    clone.style.backgroundColor = '#ffffff';

    document.body.appendChild(clone);

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `${activeCandidate.name.replace(/\s+/g, '_')}_Offer_Letter.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Trigger html2pdf and clean up clone element
    window.html2pdf()
      .from(clone)
      .set(opt)
      .save()
      .then(() => {
        document.body.removeChild(clone);
      })
      .catch((err) => {
        console.error('Failed to download PDF:', err);
        if (document.body.contains(clone)) {
          document.body.removeChild(clone);
        }
        alert('Failed to generate PDF. Please try again.');
      });
  };

  const handleStartSending = async () => {
    if (selectedCandidates.length === 0) {
      alert('No candidates selected to send to.');
      return;
    }
    
    if (sending) return;

    try {
      setSending(true);
      await triggerEmailDispatch(
        currentCampaign._id,
        selectedCandidateIds,
        delayMs,
        retryOnFailure
      );
    } catch (err) {
      alert(`Failed to start sending: ${err.message}`);
      setSending(false);
    }
  };

  // Render company logo safely
  const renderLogo = (logoStr) => {
    if (!logoStr) return null;
    if (logoStr.trim().startsWith('<svg')) {
      return <div dangerouslySetInnerHTML={{ __html: logoStr }} className="w-full h-full" />;
    }
    return <img src={logoStr} alt="Company Logo" className="w-full h-full object-contain" />;
  };

  // Send Progress Metrics
  const sentCount = selectedCandidates.filter(c => ['Sent', 'Opened'].includes(c.status)).length;
  const failedCount = selectedCandidates.filter(c => c.status === 'Failed').length;
  const inProgressCount = selectedCandidates.filter(c => ['Sending', 'Retrying'].includes(c.status)).length;
  
  const progressPct = selectedCandidates.length > 0 
    ? Math.round(((sentCount + failedCount) / selectedCandidates.length) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      
      {/* Wizard Progress Steps Indicator */}
      <div className="wizard-steps">
        <div className="step-node completed">
          <div className="step-circle">✓</div>
          <span className="step-label">Upload CSV</span>
        </div>
        <div className="step-line completed"></div>
        <div className="step-node completed">
          <div className="step-circle">✓</div>
          <span className="step-label">Data Review</span>
        </div>
        <div className="step-line completed"></div>
        <div className="step-node completed">
          <div className="step-circle">✓</div>
          <span className="step-label">Edit Template</span>
        </div>
        <div className="step-line completed"></div>
        <div className="step-node active">
          <div className="step-circle">4</div>
          <span className="step-label">Send Offers</span>
        </div>
      </div>

      {/* Title Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Finalize Offer Dispatch</h2>
          <p className="text-slate-500 text-sm mt-1">Review generated documents and configure sending parameters.</p>
        </div>
        
        {/* Connection status tag */}
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>SMTP VERIFIED</span>
        </div>
      </div>

      {/* Main Grid: Left preview, right dispatch settings & progress */}
      <div className="preview-send-grid">
        
        {/* Left Column: Letter Preview */}
        <div className="flex flex-col gap-4">
          {selectedCandidates.length > 0 ? (
            <>
              {/* Pagination Selector bar */}
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-sm font-semibold text-slate-700">
                  PREVIEW {previewIndex + 1} OF {selectedCandidates.length} : <strong>Candidate: {activeCandidate.name}</strong>
                </span>
                
                <div className="flex items-center gap-2">
                  <button 
                    className="pagination-btn"
                    disabled={previewIndex === 0}
                    onClick={() => setPreviewIndex(prev => prev - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    className="pagination-btn"
                    disabled={previewIndex === selectedCandidates.length - 1}
                    onClick={() => setPreviewIndex(prev => prev + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                  
                  <button 
                    className="btn btn-secondary flex items-center gap-1.5 ml-2" 
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                    onClick={handleDownloadPDF}
                  >
                    <Download size={14} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Letter Preview Sheet */}
              <div className="preview-scroller" style={{ maxHeight: '560px' }}>
                <div id="letter-preview-sheet" className={`letter-sheet style-${style.toLowerCase()}`}>
                  {/* Modern Style Layout */}
                  {style === 'Modern' && (
                    <>
                      <div className="letter-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div className="letter-logo-box">
                            {renderLogo(selectedCompany?.logo)}
                          </div>
                          <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-color)' }}></div>
                          <div className="letter-logo-box">
                            {renderLogo(AICTE_LOGO_SVG)}
                          </div>
                        </div>
                        <div className="letter-date-ref">
                          <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                          <div>Ref: OF-{new Date().getFullYear()}-MOD-{activeCandidate._id ? activeCandidate._id.toString().slice(-4).toUpperCase() : 'TEMP'}</div>
                        </div>
                      </div>
                      
                      <div className="letter-recipient">
                        <strong>Dear {activeCandidate.name},</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{activeCandidate.email}</div>
                      </div>
                      
                      <div className="letter-content" dangerouslySetInnerHTML={renderLetterBody(template?.body, activeCandidate)} />

                      <div className="letter-stats-grid">
                        <div className="letter-stat-item">
                          <div className="letter-stat-label">Annual Salary</div>
                          <div className="letter-stat-value">{activeCandidate.salary}</div>
                        </div>
                        <div className="letter-stat-item">
                          <div className="letter-stat-label">Start Date</div>
                          <div className="letter-stat-value">{activeCandidate.joiningDate}</div>
                        </div>
                      </div>

                      <div className="letter-footer">
                        This is an official document from {selectedCompany?.name || 'Global Corp'} HR department.
                      </div>
                    </>
                  )}

                  {/* Classic Style Layout */}
                  {style === 'Classic' && (
                    <>
                      <div className="letter-header">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '16px' }}>
                          <div className="letter-logo-box" style={{ height: '48px' }}>
                            {renderLogo(selectedCompany?.logo)}
                          </div>
                          <div style={{ width: '1px', height: '32px', backgroundColor: '#cbd5e1' }}></div>
                          <div className="letter-logo-box" style={{ height: '48px' }}>
                            {renderLogo(AICTE_LOGO_SVG)}
                          </div>
                        </div>
                        <div className="company-title">{selectedCompany?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedCompany?.tagline}</div>
                      </div>
                      
                      <div className="letter-date-ref">
                        <span>Ref: OF-{new Date().getFullYear()}-CLA-{activeCandidate._id ? activeCandidate._id.toString().slice(-4).toUpperCase() : 'TEMP'}</span>
                        <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>

                      <div className="letter-content" dangerouslySetInnerHTML={renderLetterBody(template?.body, activeCandidate)} />

                      <div className="letter-stats-grid">
                        <div className="letter-stat-item">
                          <div className="letter-stat-label">Salary</div>
                          <div className="letter-stat-value">{activeCandidate.salary}</div>
                        </div>
                        <div className="letter-stat-item">
                          <div className="letter-stat-label">Start Date</div>
                          <div className="letter-stat-value">{activeCandidate.joiningDate}</div>
                        </div>
                      </div>

                      <div className="letter-sign">
                        Sincerely,<br/><br/><br/>
                        <strong>HR Department</strong><br/>
                        {selectedCompany?.name}
                      </div>
                    </>
                  )}

                  {/* Minimal Style Layout */}
                  {style === 'Minimal' && (
                    <>
                      <div className="letter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="letter-logo-box" style={{ height: '36px' }}>
                            {renderLogo(selectedCompany?.logo)}
                          </div>
                          <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
                          <div className="letter-logo-box" style={{ height: '36px' }}>
                            {renderLogo(AICTE_LOGO_SVG)}
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{selectedCompany?.name}</span>
                      </div>
                      
                      <div className="letter-date-ref">
                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} / Ref: OF-{new Date().getFullYear()}-MIN-{activeCandidate._id ? activeCandidate._id.toString().slice(-4).toUpperCase() : 'TEMP'}
                      </div>

                      <div className="letter-content" style={{ fontSize: '12px' }} dangerouslySetInnerHTML={renderLetterBody(template?.body, activeCandidate)} />

                      <div className="letter-stats-grid">
                        <div className="letter-stat-item">
                          <div className="letter-stat-label">COMPENSATION</div>
                          <div className="letter-stat-value">{activeCandidate.salary}</div>
                        </div>
                        <div className="letter-stat-item">
                          <div className="letter-stat-label">START DATE</div>
                          <div className="letter-stat-value">{activeCandidate.joiningDate}</div>
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: 'auto' }}>
                        CONFIDENTIALITY NOTICE: The information in this document is private.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center p-8 text-slate-400">
              No candidates selected. Go back to Data Review.
            </div>
          )}

          <div className="mt-4">
            <button className="btn btn-secondary" onClick={() => setStep(3)}>
              <ArrowLeft size={16} />
              <span>Back to Template Editor</span>
            </button>
          </div>
        </div>

        {/* Right Column: Dispatch Panel & Send Queue Progress */}
        <div className="flex flex-col gap-6">
          
          {/* Dispatch Settings Box */}
          <div className="dispatch-settings-box">
            <div className="dispatch-title-row">
              <Send size={18} className="text-blue-600" />
              <span>Dispatch Settings</span>
            </div>

            {/* Delay Input */}
            <div className="form-group">
              <label className="form-label">Delay between emails</label>
              <div className="form-input-with-addon">
                <input 
                  type="number" 
                  value={delayMs}
                  onChange={(e) => setDelayMs(Math.max(500, Number(e.target.value)))}
                  placeholder="1500" 
                  disabled={sending}
                />
                <span className="form-input-with-addon-text">MS</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                Recommended: 1000ms+ to prevent SMTP rate limits.
              </span>
            </div>

            {/* Retry toggle */}
            <div className="toggle-group">
              <div className="flex flex-col">
                <span className="form-label" style={{ marginBottom: '2px' }}>Retry on failure</span>
                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Attempt up to 3 times</span>
              </div>
              
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={retryOnFailure}
                  onChange={(e) => setRetryOnFailure(e.target.checked)}
                  disabled={sending}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Main Trigger dispatch Button */}
            <button 
              className="btn btn-primary w-full flex items-center justify-center gap-2" 
              style={{ padding: '12px' }}
              onClick={handleStartSending}
              disabled={sending || selectedCandidates.length === 0}
            >
              {sending ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Sending ({sentCount + failedCount}/{selectedCandidates.length})...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Send All Offers ({selectedCandidates.length})</span>
                </>
              )}
            </button>
          </div>

          {/* Real-time sending progress list */}
          {(sending || sentCount > 0 || failedCount > 0) && (
            <div className="progress-container">
              <div className="progress-header">
                <span className="progress-title">Sending Progress</span>
                <span className="text-xs font-bold text-slate-500">{progressPct}%</span>
              </div>

              {/* Progress bar */}
              <div className="progress-bar-wrapper">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>

              {/* Metrics counts row */}
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-3 border-b border-slate-100 pb-2">
                <span>Sent: <strong className="text-emerald-600">{sentCount}</strong></span>
                <span>Failed: <strong className="text-pink-600">{failedCount}</strong></span>
                <span>Queue: <strong>{selectedCandidates.length - sentCount - failedCount}</strong></span>
              </div>

              {/* Candidates sending logs list */}
              <div className="progress-list">
                {selectedCandidates.map(c => (
                  <div key={c._id} className="progress-row">
                    <div className="progress-cand-info">
                      <span className="progress-cand-name">{c.name}</span>
                      <span className="progress-cand-email">{c.email}</span>
                    </div>

                    <div>
                      {c.status === 'Opened' && (
                        <div className="flex flex-col items-end">
                          <span className="text-blue-600 flex items-center gap-1 font-bold">
                            <Eye size={12} />
                            <span>Opened</span>
                          </span>
                          {c.openedAt && (
                            <span className="text-[10px] text-blue-500 font-medium mt-0.5" title={new Date(c.openedAt).toLocaleString()}>
                              {new Date(c.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}
                      {c.status === 'Sent' && (
                        <span className="text-emerald-600 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={12} />
                          <span>Sent</span>
                        </span>
                      )}
                      {c.status === 'Failed' && (
                        <span className="text-pink-600 flex items-center gap-1 font-bold" title={c.error}>
                          <XCircle size={12} />
                          <span>Failed</span>
                        </span>
                      )}
                      {['Sending', 'Retrying'].includes(c.status) && (
                        <span className="text-blue-600 flex items-center gap-1 font-bold pulse-sending">
                          <RefreshCw size={12} className="animate-spin" />
                          <span>{c.status}</span>
                        </span>
                      )}
                      {c.status === 'Pending' && (
                        <span className="text-slate-400 flex items-center gap-1 font-bold">
                          <Clock size={12} />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default PreviewSend;
