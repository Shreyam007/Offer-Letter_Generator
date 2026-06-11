import React, { useState, useEffect, useRef } from 'react';
import { useApp, AICTE_LOGO_SVG, API_BASE } from '../context/AppContext';
import { 
  ArrowLeft, 
  ArrowRight, 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link2, 
  Upload, 
  Info,
  Building2
} from 'lucide-react';

const TemplateEditor = () => {
  const { 
    currentCampaign, 
    selectedCompany,
    templates, 
    saveTemplate, 
    candidates,
    selectedCandidateIds,
    setStep 
  } = useApp();

  const firstSelected = candidates.find(c => selectedCandidateIds?.includes(c._id));
  const candidate = firstSelected || (candidates.length > 0 ? candidates[0] : {
    name: 'John Doe',
    role: 'Senior Product Designer',
    department: 'Product',
    salary: '$120,000',
    joiningDate: 'Oct 12, 2026',
    email: 'john.doe@example.com',
    customFields: {}
  });

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const candidateIdStr = candidate._id ? candidate._id.toString() : (candidate.id || 'TEMP');
  const refSuffix = candidateIdStr.slice(-4).toUpperCase();


  const PREBUILT_TEMPLATES = {
    Modern: {
      subject: "Offer of Employment at {{Company}} - {{Name}}",
      body: `Dear {{Name}},

We are thrilled to offer you the position of {{Role}} at {{Company}}. After our detailed interview process, our team was impressed by your expertise and we believe you will be a vital asset to our {{Department}} department.

As discussed, your starting annual base salary will be {{Salary}}, payable in accordance with the company's standard payroll schedule. Your official start date is scheduled for {{StartDate}}.

Attached you will find the complete benefits package and onboarding documentation. We look forward to having you on the team!

Best regards,

{{Manager}}
{{Company}} HR`
    },
    Classic: {
      subject: "Official Appointment Letter: {{Name}} - {{Company}}",
      body: `Dear {{Name}},

On behalf of {{Company}}, I am pleased to offer you the position of {{Role}} in our {{Department}} department. We were highly impressed with your qualifications and experience during the interview process.

Your initial annual salary for this position will be {{Salary}}, subject to applicable taxes and withholdings. Your employment will begin on {{StartDate}}.

Please sign and return the duplicate copy of this letter to confirm your acceptance of this offer.

Yours sincerely,

{{Manager}}
Executive Director, {{Company}}`
    },
    Minimal: {
      subject: "Job Offer: {{Role}} at {{Company}}",
      body: `Dear {{Name}},

We are pleased to offer you employment as {{Role}} in the {{Department}} department at {{Company}}.

Start Date: {{StartDate}}
Compensation: {{Salary}} per annum

We look forward to working with you. Please review and sign below.

Sincerely,

{{Manager}}`
    }
  };

  const [templateName, setTemplateName] = useState('Campaign Template');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState('Modern');
  const [htmlMode, setHtmlMode] = useState(false);
  const [templateId, setTemplateId] = useState(null);

  // Dynamic scale preview
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const containerWidth = entry.contentRect.width;
        const containerHeight = entry.contentRect.height;
        
        // Ensure we have valid dimensions
        if (!containerWidth || !containerHeight) continue;
        
        // Standard A4-proportioned dimensions for the preview sheet
        const sheetWidth = 610;
        const sheetHeight = 780;
        
        // We want a safe margin of 12px on all sides of the sheet (24px total)
        const margin = 24;
        const scaleX = (containerWidth - margin) / sheetWidth;
        const scaleY = (containerHeight - margin) / sheetHeight;
        
        // Fit within both width and height boundaries, with a minimum scale of 0.3 and maximum of 1
        const newScale = Math.max(0.3, Math.min(scaleX, scaleY, 1));
        setScale(newScale);
      }
    });

    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const handleHtmlModeToggle = (isHtml) => {
    setHtmlMode(isHtml);
    if (isHtml) {
      // Convert plain text body to HTML
      const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(body);
      if (!hasHtmlTags) {
        const formatted = body
          .split('\n\n')
          .map(para => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
          .join('\n');
        setBody(formatted);
      }
    } else {
      // Convert HTML back to plain text
      let plainText = body;
      plainText = plainText.replace(/<\/p>\s*<p>/gi, '\n\n');
      plainText = plainText.replace(/<p>/gi, '');
      plainText = plainText.replace(/<\/p>/gi, '');
      plainText = plainText.replace(/<br\s*\/?>/gi, '\n');
      // Strip all other HTML tags
      plainText = plainText.replace(/<\/?[^>]+(>|$)/g, '');
      setBody(plainText);
    }
  };

  // Load existing template for this company/campaign on start
  useEffect(() => {
    // Find template for this company or use company default
    const compTemplate = templates.find(t => t.companyId?._id === selectedCompany?._id) || templates[0];
    if (compTemplate) {
      setTemplateId(compTemplate._id);
      setTemplateName(compTemplate.name);
      setSubject(compTemplate.subject);
      setBody(compTemplate.body);
      setStyle(compTemplate.style || 'Modern');
    } else {
      // Fallback to prebuilt Modern template
      setSubject(PREBUILT_TEMPLATES.Modern.subject);
      setBody(PREBUILT_TEMPLATES.Modern.body);
      setStyle('Modern');
    }
  }, [currentCampaign, templates, selectedCompany]);

  const handleStyleChange = (newStyle) => {
    setStyle(newStyle);
    
    // Auto-swap default bodies if not customized by user
    const isDefaultBody = !body.trim() || 
      body === PREBUILT_TEMPLATES.Modern.body || 
      body === PREBUILT_TEMPLATES.Classic.body || 
      body === PREBUILT_TEMPLATES.Minimal.body;
      
    const isDefaultSubject = !subject.trim() || 
      subject === PREBUILT_TEMPLATES.Modern.subject || 
      subject === PREBUILT_TEMPLATES.Classic.subject || 
      subject === PREBUILT_TEMPLATES.Minimal.subject;
      
    if (isDefaultBody) {
      setBody(PREBUILT_TEMPLATES[newStyle].body);
    }
    if (isDefaultSubject) {
      setSubject(PREBUILT_TEMPLATES[newStyle].subject);
    }
  };

  // Insert template tokens at cursor location in textarea
  const insertTag = (tag) => {
    const textarea = document.getElementById('template-body-textarea');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after  = text.substring(end, text.length);
    
    const updatedBody = before + tag + after;
    setBody(updatedBody);
    
    textarea.focus();
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    }, 10);
  };

  // Insert html tag at cursor position
  const insertHtmlTag = (openTag, closeTag) => {
    const textarea = document.getElementById('template-body-textarea');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after  = text.substring(end, text.length);
    
    const replacement = openTag + selectedText + closeTag;
    const updatedBody = before + replacement + after;
    setBody(updatedBody);
    
    textarea.focus();
    setTimeout(() => {
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + openTag.length + selectedText.length;
    }, 10);
  };

  // Compile helper for Live Preview
  const compileText = (text) => {
    if (!text) return '';

    const vars = {
      Name: candidate.name,
      Role: candidate.role,
      Department: candidate.department,
      Salary: candidate.salary,
      StartDate: candidate.joiningDate,
      JoiningDate: candidate.joiningDate,
      Company: selectedCompany?.name || 'Global Corp',
      Manager: 'Marcus Holloway'
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


  const handleSaveAndContinue = async () => {
    if (!subject.trim() || !body.trim()) {
      alert('Please fill out the email subject and letter body.');
      return;
    }

    try {
      const saved = await saveTemplate({
        _id: templateId, // passes ID if editing
        name: templateName,
        subject,
        body,
        style,
        companyId: selectedCompany?._id
      });
      
      // Update campaign in backend to point to this template
      if (currentCampaign) {
        await fetch(`${API_BASE}/campaigns/${currentCampaign._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: saved._id })
        });
        currentCampaign.templateId = saved; // sync state
      }

      setStep(4); // Go to Preview & Send
    } catch (err) {
      alert(`Error saving template: ${err.message}`);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      
      // Update company logo in database
      if (selectedCompany) {
        try {
          const res = await fetch(`${API_BASE}/companies/${selectedCompany._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logo: base64Data })
          });
          const updated = await res.json();
          // Sync locally
          selectedCompany.logo = updated.logo;
          alert('Logo updated successfully!');
          window.location.reload(); // Refresh to propagate changes
        } catch (err) {
          alert('Failed to update company logo.');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const renderLogo = (logoStr) => {
    if (!logoStr) return <Building2 size={24} className="text-slate-400" />;
    if (logoStr.trim().startsWith('<svg')) {
      return <div dangerouslySetInnerHTML={{ __html: logoStr }} className="logo-svg-wrapper" />;
    }
    return <img src={logoStr} alt="Company Logo" className="logo-img-wrapper" />;
  };

  return (
    <div className="template-editor-shell">
      
      {/* Step Wizard Header */}
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
        <div className="step-node active">
          <div className="step-circle">3</div>
          <span className="step-label">Edit Template</span>
        </div>
        <div className="step-line"></div>
        <div className="step-node">
          <div className="step-circle">4</div>
          <span className="step-label">Send Offers</span>
        </div>
      </div>

      {/* Top Configuration Bar: Style Selector & Logo Uploader */}
      <div className="editor-top-bar">
        <div className="top-bar-section">
          <span className="top-bar-label">Template Style</span>
          <div className="style-pills">
            <button 
              type="button"
              className={`style-pill ${style === 'Modern' ? 'selected' : ''}`}
              onClick={() => handleStyleChange('Modern')}
            >
              Modern
            </button>
            <button 
              type="button"
              className={`style-pill ${style === 'Classic' ? 'selected' : ''}`}
              onClick={() => handleStyleChange('Classic')}
            >
              Classic
            </button>
            <button 
              type="button"
              className={`style-pill ${style === 'Minimal' ? 'selected' : ''}`}
              onClick={() => handleStyleChange('Minimal')}
            >
              Minimal
            </button>
          </div>
        </div>

        <div className="top-bar-section">
          <span className="top-bar-label">Branding</span>
          <div 
            className="top-bar-logo-upload"
            onClick={() => document.getElementById('logo-upload-input').click()}
            title="Upload Company Logo (PNG/SVG)"
          >
            <input 
              id="logo-upload-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {selectedCompany?.logo ? (
              <div className="compact-logo-preview">
                {renderLogo(selectedCompany.logo)}
                <span>Change Logo</span>
              </div>
            ) : (
              <div className="compact-logo-preview" style={{ color: 'var(--text-muted)' }}>
                <Upload size={14} style={{ marginRight: '4px' }} />
                <span>Upload PNG/SVG</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Editor Canvas */}
      <div className="template-grid">
        
        {/* Left Column: Text Area Canvas */}
        <div className="editor-canvas">
          {/* Format Toolbar */}
          <div className="editor-toolbar">
            <div className="toolbar-left-actions">
              <button type="button" className="toolbar-btn" onClick={() => insertHtmlTag('<strong>', '</strong>')} title="Bold">
                <Bold size={16} />
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertHtmlTag('<em>', '</em>')} title="Italic">
                <Italic size={16} />
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertHtmlTag('<u>', '</u>')} title="Underline">
                <Underline size={16} />
              </button>
              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 4px' }}></div>
              <button type="button" className="toolbar-btn" onClick={() => insertHtmlTag('<ul>\n  <li>', '</li>\n</ul>')} title="Bullet List">
                <List size={16} />
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertHtmlTag('<ol>\n  <li>', '</li>\n</ol>')} title="Numbered List">
                <ListOrdered size={16} />
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertHtmlTag('<a href="https://">', '</a>')} title="Insert Link">
                <Link2 size={16} />
              </button>
            </div>
            
            {/* HTML Mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>HTML Mode</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={htmlMode}
                  onChange={(e) => handleHtmlModeToggle(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* Tokens Helper */}
          <div className="editor-tag-row">
            <span className="tag-helper-label">Click to insert:</span>
            <button className="insert-tag-btn" onClick={() => insertTag('{{Name}}')}>{"{{Name}}"}</button>
            <button className="insert-tag-btn" onClick={() => insertTag('{{Role}}')}>{"{{Role}}"}</button>
            <button className="insert-tag-btn" onClick={() => insertTag('{{Department}}')}>{"{{Department}}"}</button>
            <button className="insert-tag-btn" onClick={() => insertTag('{{Salary}}')}>{"{{Salary}}"}</button>
            <button className="insert-tag-btn" onClick={() => insertTag('{{StartDate}}')}>{"{{StartDate}}"}</button>
            <button className="insert-tag-btn" onClick={() => insertTag('{{Company}}')}>{"{{Company}}"}</button>
            <button className="insert-tag-btn" onClick={() => insertTag('{{Manager}}')}>{"{{Manager}}"}</button>
          </div>

          {/* Subject Bar */}
          <div className="subject-editor-box">
            <span className="subject-label">Subject:</span>
            <input 
              type="text" 
              className="subject-input" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Offer of Employment at {{Company}}"
            />
          </div>

          {/* Main Body Input Area */}
          <textarea
            id="template-body-textarea"
            className="editor-body-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your offer letter text here. Use variables like {{Name}} to insert custom candidate values..."
          />

          {/* Bottom Action buttons */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setStep(currentCampaign ? 2 : 1)}
            >
              {currentCampaign ? 'Back to Review' : 'Back to Upload'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleSaveAndContinue}
            >
              <span>{currentCampaign ? 'Save & Continue' : 'Save Template'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Column: Live Compiled Preview */}
        <div className="letter-preview-container">
          <div className="live-badge-row">
            <span className="settings-label" style={{ margin: 0 }}>Preview</span>
            <span className="live-preview-badge">Live</span>
          </div>

          <div className="preview-scroller" ref={previewContainerRef} style={{ overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', minHeight: '520px', padding: '16px' }}>
            <div 
              style={{ 
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: `translate(-50%, 0) scale(${scale})`, 
                transformOrigin: 'top center',
                width: '610px',
                height: '780px',
                transition: 'transform 0.15s ease-out',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0
              }}
            >
              <div className={`letter-sheet style-${style.toLowerCase()}`} style={{ margin: 0, height: '100%', minHeight: 'auto' }}>
              {/* Modern Stylesheet preview */}
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
                      <div>{currentDateStr}</div>
                      <div>Ref: OF-{new Date().getFullYear()}-MOD-{refSuffix}</div>
                    </div>
                  </div>
                  
                  <div className="letter-recipient">
                    <strong>{candidate.name}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{candidate.email || 'john.doe@example.com'}</div>
                  </div>
                  
                  <div className="letter-content" dangerouslySetInnerHTML={{ __html: htmlMode ? compileText(body) : escapeHtml(compileText(body)).replace(/\n/g, '<br/>') }} />

                  <div className="letter-stats-grid">
                    <div className="letter-stat-item">
                      <div className="letter-stat-label">Annual Salary</div>
                      <div className="letter-stat-value">{candidate.salary || '$120,000 USD'}</div>
                    </div>
                    <div className="letter-stat-item">
                      <div className="letter-stat-label">Start Date</div>
                      <div className="letter-stat-value">{candidate.joiningDate || 'Oct 12, 2026'}</div>
                    </div>
                  </div>

                  <div className="letter-footer">
                    This is a computer-generated offer letter from {selectedCompany?.name || 'Global Corp'} HR department.
                  </div>
                </>
              )}

              {/* Classic Stylesheet preview */}
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
                    <div className="company-title">{selectedCompany?.name || 'Global Corp'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedCompany?.tagline}</div>
                  </div>
                  
                  <div className="letter-date-ref">
                    <span>Ref: OF-{new Date().getFullYear()}-CLA-{refSuffix}</span>
                    <span>{currentDateStr}</span>
                  </div>

                  <div style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>
                    <h3 style={{ fontFamily: 'Georgia, serif', letterSpacing: '3px', fontSize: '15px', textTransform: 'uppercase', color: '#1e1b18', borderBottom: '1px solid #c5a059', paddingBottom: '8px', display: 'inline-block' }}>Letter of Appointment</h3>
                  </div>

                  <div className="letter-content" dangerouslySetInnerHTML={{ __html: htmlMode ? compileText(body) : escapeHtml(compileText(body)).replace(/\n/g, '<br/>') }} />

                  <div className="letter-stats-grid">
                    <div className="letter-stat-item">
                      <div className="letter-stat-label">Salary</div>
                      <div className="letter-stat-value">{candidate.salary || '$120,000'}</div>
                    </div>
                    <div className="letter-stat-item">
                      <div className="letter-stat-label">Start Date</div>
                      <div className="letter-stat-value">{candidate.joiningDate || 'Oct 12, 2026'}</div>
                    </div>
                  </div>

                  <div className="letter-sign">
                    Sincerely,<br/><br/><br/>
                    <strong>HR Department</strong><br/>
                    {selectedCompany?.name}
                  </div>
                </>
              )}

              {/* Minimal Stylesheet preview */}
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
                    {currentDateStr} / Ref: OF-{new Date().getFullYear()}-MIN-{refSuffix}
                  </div>

                  <div className="letter-content" style={{ fontSize: '12px' }} dangerouslySetInnerHTML={{ __html: htmlMode ? compileText(body) : escapeHtml(compileText(body)).replace(/\n/g, '<br/>') }} />

                  <div className="letter-stats-grid">
                    <div className="letter-stat-item">
                      <div className="letter-stat-label">COMPENSATION</div>
                      <div className="letter-stat-value">{candidate.salary || '$120,000'}</div>
                    </div>
                    <div className="letter-stat-item">
                      <div className="letter-stat-label">START DATE</div>
                      <div className="letter-stat-value">{candidate.joiningDate || 'Oct 12, 2026'}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: 'auto' }}>
                    CONFIDENTIALITY NOTICE: The information in this document is private.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Preview Warning Banner */}
      <div className="info-banner" style={{ padding: '12px 14px', marginTop: '16px' }}>
        <div className="info-banner-left" style={{ fontSize: '12px' }}>
          <Info size={16} />
          <span>Templates use <strong>Inter</strong> font by default to guarantee clear digital rendering.</span>
        </div>
      </div>

    </div>
  );
};

export default TemplateEditor;
