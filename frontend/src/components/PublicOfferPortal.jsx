import React, { useState, useEffect } from 'react';
import { API_BASE, AICTE_LOGO_SVG } from '../context/AppContext';
import { 
  Building2, 
  Download, 
  CheckCircle2, 
  FileText, 
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';

const PublicOfferPortal = ({ candidateId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offerData, setOfferData] = useState(null); // { candidate, company, template }
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const fetchOfferDetails = async () => {
      try {
        // 1. Fetch public offer details
        const res = await fetch(`${API_BASE}/email/public/candidate-offer/${candidateId}`);
        if (!res.ok) {
          throw new Error('Offer letter not found or link has expired.');
        }
        const data = await res.json();
        setOfferData(data);
        
        if (data.candidate?.status === 'Accepted') {
          setAccepted(true);
        }

        // 2. Automatically register open track event
        await fetch(`${API_BASE}/email/track/${candidateId}`);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (candidateId) {
      fetchOfferDetails();
    }
  }, [candidateId]);

  const handleAcceptOffer = async () => {
    if (accepting || accepted) return;
    setAccepting(true);
    try {
      const res = await fetch(`${API_BASE}/email/public/candidate-offer/${candidateId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setAccepted(true);
      } else {
        alert('Failed to accept offer. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const renderLogo = (logoStr, companyName) => {
    if (!logoStr) return <span style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--primary-color)' }}>{companyName || 'Company'}</span>;
    if (logoStr.trim().startsWith('<svg')) {
      return <div dangerouslySetInnerHTML={{ __html: logoStr }} style={{ height: '36px', width: 'auto', display: 'flex', alignItems: 'center' }} />;
    }
    return <img src={logoStr} alt="Logo" style={{ height: '36px', objectFit: 'contain' }} />;
  };

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

    if (candidate.customFields) {
      Object.keys(candidate.customFields).forEach(key => {
        vars[key] = candidate.customFields[key];
      });
    }

    let result = text;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, vars[key] !== undefined && vars[key] !== null ? vars[key] : '');
    });
    result = result.replace(/{{\s*(.*?)\s*}}/g, '$1');
    return result;
  };

  const renderLetterBody = (bodyText, activeCand, companyName) => {
    const compiled = compileText(bodyText, activeCand, companyName);
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(compiled);
    if (isHtml) return { __html: compiled };
    return { __html: compiled.replace(/\n/g, '<br/>') };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#f5f7fa', fontFamily: 'sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>Retrieving your official offer letter...</span>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#f5f7fa', padding: '24px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px 24px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Invalid Offer Link</h2>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
            {error || 'This offer letter link has expired, or the ID is invalid. Please contact the company HR department to reissue the letter.'}
          </p>
          <a href="/" style={{ display: 'inline-block', backgroundColor: '#4f46e5', color: '#ffffff', textDecoration: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '14px', fontWeight: 600 }}>
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const { candidate, company, template } = offerData;
  const style = template?.style || 'Modern';
  const refSuffix = candidate._id ? candidate._id.toString().slice(-4).toUpperCase() : 'TEMP';
  const currentDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Direct backend link for PDF download
  const pdfDownloadUrl = `${API_BASE}/email/public/candidate-offer/${candidateId}/pdf`;

  return (
    <div style={{ minHeight: '100vh', width: '100vw', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
            {renderLogo(company?.logo, company?.name)}
          </div>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1' }}></div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>OFFICIAL SECURE PORTAL</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a 
            href={pdfDownloadUrl} 
            download
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', textDecoration: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s ease' }}
          >
            <Download size={14} />
            <span>Download PDF</span>
          </a>

          {!accepted ? (
            <button
              onClick={handleAcceptOffer}
              disabled={accepting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}
            >
              {accepting ? 'Processing...' : 'Accept Job Offer'}
            </button>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 700 }}>
              <Check size={14} />
              <span>Offer Accepted</span>
            </span>
          )}
        </div>
      </header>

      {/* Accepted Confetti / Celebration Banner */}
      {accepted && (
        <div style={{ backgroundColor: '#ecfdf5', borderBottom: '1px solid #a7f3d0', padding: '16px', textAlign: 'center', animation: 'slideDown 0.3s ease-out', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#065f46', margin: 0 }}>🎉 Congratulations, {candidate.name}!</h4>
            <p style={{ fontSize: '13px', color: '#047857', margin: '4px 0 0 0' }}>
              You have digitally accepted the offer of employment for <strong>{candidate.role}</strong> at <strong>{company?.name}</strong>.
            </p>
          </div>
          {/* Confetti Animation Effect */}
          <div className="confetti-container">
            {[...Array(15)].map((_, i) => (
              <div 
                key={i} 
                className="confetti-piece" 
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 2}s`,
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            ))}
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
            .confetti-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
            .confetti-piece { position: absolute; width: 6px; height: 12px; top: -10px; animation: fall 3s linear infinite; opacity: 0.8; }
            @keyframes fall {
              0% { transform: translateY(-10px) rotate(0deg); opacity: 0.8; }
              100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
            }
          `}} />
        </div>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', boxSizing: 'border-box' }}>
        
        {/* Document Sheet Container */}
        <div style={{ width: '100%', maxWidth: '640px', position: 'relative' }}>
          
          <div className={`letter-sheet style-${style.toLowerCase()}`} style={{ minHeight: '780px', pointerEvents: 'auto', zIndex: 2 }}>
            {/* Modern Style */}
            {style === 'Modern' && (
              <>
                <div className="letter-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="letter-logo-box">
                      {renderLogo(company?.logo, company?.name)}
                    </div>
                    <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-color)' }}></div>
                    <div className="letter-logo-box">
                      <div dangerouslySetInnerHTML={{ __html: AICTE_LOGO_SVG }} style={{ display: 'flex', alignItems: 'center' }} />
                    </div>
                  </div>
                  <div className="letter-date-ref">
                    <div>{currentDateStr}</div>
                    <div>Ref: OF-{new Date().getFullYear()}-MOD-{refSuffix}</div>
                  </div>
                </div>
                
                <div className="modern-badge">Employment Offer</div>

                <div className="letter-recipient">
                  <strong>Dear {candidate.name},</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{candidate.email}</div>
                </div>
                
                <div className="letter-content" dangerouslySetInnerHTML={renderLetterBody(template?.body, candidate, company?.name)} />

                <div className="letter-stats-grid">
                  <div className="letter-stat-item">
                    <div className="letter-stat-label">Annual Salary</div>
                    <div className="letter-stat-value">{candidate.salary}</div>
                  </div>
                  <div className="letter-stat-item">
                    <div className="letter-stat-label">Start Date</div>
                    <div className="letter-stat-value">{candidate.joiningDate}</div>
                  </div>
                </div>

                <div className="modern-signature">
                  <div className="sig-line"></div>
                  <div className="sig-text">HR Team, Talent Acquisition</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>{company?.name}</div>
                </div>

                <div className="modern-security-seal">
                  <svg width="10" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  <span>SECURE & VERIFIED DOCUMENT</span>
                </div>

                <div className="letter-footer">
                  This is an official document from {company?.name} HR department.
                </div>
              </>
            )}

            {/* Classic Style */}
            {style === 'Classic' && (
              <>
                <div className="classic-watermark">
                  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="50" cy="50" r="45" strokeDasharray="3 3"></circle>
                    <circle cx="50" cy="50" r="38"></circle>
                    <path d="M50 22 L58 38 L76 41 L63 54 L66 72 L50 64 L34 72 L37 54 L24 41 L42 38 Z" fill="currentColor"></path>
                  </svg>
                </div>

                <div className="letter-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '16px' }}>
                    <div className="letter-logo-box" style={{ height: '48px' }}>
                      {renderLogo(company?.logo, company?.name)}
                    </div>
                    <div style={{ width: '1px', height: '32px', backgroundColor: '#cbd5e1' }}></div>
                    <div className="letter-logo-box" style={{ height: '48px' }}>
                      <div dangerouslySetInnerHTML={{ __html: AICTE_LOGO_SVG }} style={{ display: 'flex', alignItems: 'center' }} />
                    </div>
                  </div>
                  <div className="company-title">{company?.name}</div>
                  {company?.tagline && <div className="company-tagline">{company.tagline}</div>}
                </div>
                
                <div className="letter-date-ref">
                  <span>Ref: OF-{new Date().getFullYear()}-CLA-{refSuffix}</span>
                  <span>{currentDateStr}</span>
                </div>

                <div style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>
                  <h3 style={{ fontFamily: 'Georgia, serif', letterSpacing: '3px', fontSize: '15px', textTransform: 'uppercase', color: '#1e1b18', borderBottom: '1px solid #c5a059', paddingBottom: '8px', display: 'inline-block' }}>Letter of Appointment</h3>
                </div>

                <div className="letter-content" dangerouslySetInnerHTML={renderLetterBody(template?.body, candidate, company?.name)} />

                <div className="letter-stats-grid">
                  <div className="letter-stat-item">
                    <div className="letter-stat-label">Salary</div>
                    <div className="letter-stat-value">{candidate.salary}</div>
                  </div>
                  <div className="letter-stat-item">
                    <div className="letter-stat-label">Start Date</div>
                    <div className="letter-stat-value">{candidate.joiningDate}</div>
                  </div>
                </div>

                <div className="classic-signature-area">
                  <div className="letter-sign">
                    Sincerely,<br/><br/>
                    <div className="classic-signature">Emily Watson</div>
                    <strong>Director of Talent Acquisition</strong><br/>
                    {company?.name}
                  </div>
                  <div className="classic-wax-seal">
                    OFFICIAL SEAL
                  </div>
                </div>
              </>
            )}

            {/* Minimal Style */}
            {style === 'Minimal' && (
              <>
                <div className="minimal-tag">OFFER.MINIMAL.DOC</div>

                <div className="letter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="letter-logo-box" style={{ height: '36px' }}>
                      {renderLogo(company?.logo, company?.name)}
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
                    <div className="letter-logo-box" style={{ height: '36px' }}>
                      <div dangerouslySetInnerHTML={{ __html: AICTE_LOGO_SVG }} style={{ display: 'flex', alignItems: 'center' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{company?.name}</span>
                </div>
                
                <div className="letter-date-ref">
                  {currentDateStr} / Ref: OF-{new Date().getFullYear()}-MIN-{refSuffix}
                </div>

                <div className="letter-content" style={{ fontSize: '12px' }} dangerouslySetInnerHTML={renderLetterBody(template?.body, candidate, company?.name)} />

                <div className="minimal-stats-container">
                  <div className="minimal-stat-row">
                    <span className="minimal-stat-label">COMPENSATION</span>
                    <span className="minimal-stat-value">{candidate.salary}</span>
                  </div>
                  <div className="minimal-stat-row">
                    <span className="minimal-stat-label">START DATE</span>
                    <span className="minimal-stat-value">{candidate.joiningDate}</span>
                  </div>
                </div>

                <div style={{ marginTop: '24px', fontSize: '12px' }}>
                  Warm regards,<br/><br/>
                  <strong>{company?.name} HR</strong>
                </div>

                <div className="minimal-footer">
                  CONFIDENTIALITY NOTICE: The information in this document is private.
                </div>
              </>
            )}
          </div>

        </div>

      </main>

      {/* Footer bar */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
        Secure connection provided by {company?.name || 'Company'} Portal. Powered by OfferFlow.
      </footer>

    </div>
  );
};

export default PublicOfferPortal;
