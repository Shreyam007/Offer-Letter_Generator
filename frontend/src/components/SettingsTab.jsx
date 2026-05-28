import React, { useState, useEffect } from 'react';
import { useApp, AICTE_LOGO_SVG, API_BASE } from '../context/AppContext';
import { Building2, Save, Send, Trash2, Plus, Info, CheckCircle2, AlertTriangle } from 'lucide-react';


const SettingsTab = () => {
  const { 
    companies, 
    selectedCompany, 
    setSelectedCompany, 
    saveCompany, 
    deleteCompany, 
    testSmtp,
    loading 
  } = useApp();

  const [activeCompany, setActiveCompany] = useState(selectedCompany || companies[0] || null);
  const [formData, setFormData] = useState({
    name: activeCompany?.name || '',
    tagline: activeCompany?.tagline || '',
    logo: activeCompany?.logo || '',
    address: activeCompany?.address || '',
    email: activeCompany?.email || '',
    phone: activeCompany?.phone || '',
    website: activeCompany?.website || '',
    smtp: {
      host: activeCompany?.smtp?.host || '',
      port: activeCompany?.smtp?.port || 587,
      secure: activeCompany?.smtp?.secure || false,
      user: activeCompany?.smtp?.user || '',
      pass: activeCompany?.smtp?.pass || ''
    }
  });

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState(null); // { success: true/false, message: '' }


  // Sync activeCompany when companies list is loaded or changed
  useEffect(() => {
    if (companies.length > 0 && !activeCompany) {
      const initialComp = selectedCompany || companies[0];
      setActiveCompany(initialComp);
      setFormData({
        name: initialComp.name || '',
        tagline: initialComp.tagline || '',
        logo: initialComp.logo || '',
        address: initialComp.address || '',
        email: initialComp.email || '',
        phone: initialComp.phone || '',
        website: initialComp.website || '',
        smtp: {
          host: initialComp.smtp?.host || '',
          port: initialComp.smtp?.port || 587,
          secure: initialComp.smtp?.secure || false,
          user: initialComp.smtp?.user || '',
          pass: initialComp.smtp?.pass || ''
        }
      });
    }
  }, [companies, selectedCompany, activeCompany]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      setFormData(prev => ({
        ...prev,
        logo: base64Data
      }));
    };
    reader.readAsDataURL(file);
  };

  // Handle side tab select
  const handleSelectCompany = (comp) => {
    setActiveCompany(comp);
    setSmtpStatus(null);
    setFormData({
      name: comp.name || '',
      tagline: comp.tagline || '',
      logo: comp.logo || '',
      address: comp.address || '',
      email: comp.email || '',
      phone: comp.phone || '',
      website: comp.website || '',
      smtp: {
        host: comp.smtp?.host || '',
        port: comp.smtp?.port || 587,
        secure: comp.smtp?.secure || false,
        user: comp.smtp?.user || '',
        pass: comp.smtp?.pass || ''
      }
    });
  };

  const handleCreateNewCompany = () => {
    const newComp = {
      name: 'New Company Corp',
      tagline: 'Global Solutions',
      logo: '',
      address: '123 Business Rd, City, State, ZIP',
      email: 'careers@company.com',
      phone: '+1 (555) 012-3456',
      website: 'www.company.com',
      smtp: {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        user: '',
        pass: ''
      }
    };
    setActiveCompany(newComp);
    setFormData({ ...newComp });
    setSmtpStatus(null);
  };

  // Form handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSmtpChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setFormData(prev => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        [name]: name === 'port' ? Number(val) : val
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Company Name is required.');
      return;
    }

    try {
      // Save to db
      const saved = await saveCompany({
        ...formData,
        _id: activeCompany?._id // passes ID if it is an edit
      });
      setActiveCompany(saved);
      alert('Company profile and SMTP configurations saved successfully!');
    } catch (err) {
      alert(`Error saving company details: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!activeCompany?._id) return;
    if (!window.confirm(`Are you sure you want to delete the company profile "${activeCompany.name}"? This cannot be undone.`)) return;

    try {
      await deleteCompany(activeCompany._id);
      alert('Company profile removed.');
      if (companies.length > 0) {
        handleSelectCompany(companies[0]);
      } else {
        setActiveCompany(null);
      }
    } catch (err) {
      alert('Failed to delete company profile.');
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpStatus(null);
    try {
      const res = await testSmtp(formData.smtp);
      if (res.success) {
        setSmtpStatus({ success: true, message: res.message });
      } else {
        setSmtpStatus({ success: false, message: res.message });
      }
    } catch (err) {
      setSmtpStatus({ success: false, message: `Test request failed: ${err.message}` });
    } finally {
      setTestingSmtp(false);
    }
  };

  // Safe render logo
  const renderLogo = (logoStr) => {
    if (!logoStr) return <Building2 size={24} className="text-slate-400" />;
    if (logoStr.trim().startsWith('<svg')) {
      return <div dangerouslySetInnerHTML={{ __html: logoStr }} className="w-full h-full" />;
    }
    return <img src={logoStr} alt="Company Logo" className="w-full h-full object-contain" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">System Settings</h2>
        <p className="text-slate-500 text-sm mt-1">Configure company profiles, upload logos, and set SMTP credentials.</p>
      </div>

      <div className="settings-grid">
        
        {/* Left Column: Companies Menu list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span className="settings-label">Company Profiles</span>
          
          <div className="settings-menu">
            {companies.map((c) => (
              <div
                key={c._id}
                className={`settings-menu-item flex items-center gap-2 ${activeCompany?._id === c._id ? 'active' : ''}`}
                onClick={() => handleSelectCompany(c)}
              >
                <div className="w-6 h-6 rounded bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200">
                  {renderLogo(c.logo)}
                </div>
                <span className="truncate">{c.name}</span>
              </div>
            ))}
          </div>

          <button 
            className="btn btn-secondary flex items-center justify-center gap-2"
            onClick={handleCreateNewCompany}
          >
            <Plus size={16} />
            <span>Add New Company</span>
          </button>
        </div>

        {/* Right Column: Company Settings Editor Form */}
        {activeCompany ? (
          <form className="card" onSubmit={handleSave}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
              <h3 className="font-bold text-lg text-slate-800">Edit Company Profile</h3>
              
              {activeCompany?._id && (
                <button 
                  type="button" 
                  className="btn btn-danger"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={handleDelete}
                >
                  <Trash2 size={12} />
                  <span>Delete Profile</span>
                </button>
              )}
            </div>

            {/* General Profile fields */}
            <div className="mb-6">
              <span className="settings-label">General Details</span>
              
              <div className="settings-form-row">
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="settings-input" 
                    placeholder="e.g. Quillon Markets"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tagline</label>
                  <input 
                    type="text" 
                    name="tagline"
                    value={formData.tagline}
                    onChange={handleChange}
                    className="settings-input" 
                    placeholder="e.g. Global Liquidity Partners"
                  />
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Logo SVG Code, Image Link or Upload</label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
                  
                  {/* Left part: Input field & Upload action */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      name="logo"
                      value={formData.logo}
                      onChange={handleChange}
                      className="settings-input" 
                      placeholder="Paste RAW <svg> ... </svg> code OR enter image URL"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary flex items-center gap-2"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => document.getElementById('settings-logo-upload-input').click()}
                      >
                        <Plus size={14} />
                        <span>Upload Image File</span>
                      </button>
                      <input 
                        id="settings-logo-upload-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Supports PNG, SVG, JPG</span>
                    </div>
                  </div>

                  {/* Right part: Side-by-side logo headers preview */}
                  <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px', backgroundColor: '#f8fafc', justifyContent: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '4px' }}>
                      Letter Header Preview
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '40px' }}>
                      <div className="letter-logo-box" style={{ height: '36px', padding: '2px 4px' }}>
                        {renderLogo(formData.logo)}
                      </div>
                      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
                      <div className="letter-logo-box" style={{ height: '36px', padding: '2px 4px' }}>
                        {renderLogo(AICTE_LOGO_SVG)}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Office Address</label>
                <textarea 
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="settings-textarea" 
                  placeholder="Street Address, City, ZIP Code"
                />
              </div>

              <div className="settings-form-row">
                <div className="form-group">
                  <label className="form-label">Careers Email</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="settings-input" 
                    placeholder="hr@company.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="text" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="settings-input" 
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Website URL</label>
                <input 
                  type="text" 
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="settings-input" 
                  placeholder="www.company.com"
                />
              </div>
            </div>

            {/* SMTP Settings fields */}
            <div className="border-t border-slate-200 pt-6 mb-6">
              <span className="settings-label">Nodemailer SMTP Credentials</span>
              
              <div className="settings-form-row mt-3">
                <div className="form-group">
                  <label className="form-label">SMTP Host</label>
                  <input 
                    type="text" 
                    name="host"
                    value={formData.smtp.host}
                    onChange={handleSmtpChange}
                    className="settings-input" 
                    placeholder="e.g. smtp.gmail.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Port</label>
                  <input 
                    type="number" 
                    name="port"
                    value={formData.smtp.port}
                    onChange={handleSmtpChange}
                    className="settings-input" 
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="settings-form-row">
                <div className="form-group">
                  <label className="form-label">SMTP Username</label>
                  <input 
                    type="text" 
                    name="user"
                    value={formData.smtp.user}
                    onChange={handleSmtpChange}
                    className="settings-input" 
                    placeholder="HR email address"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Password</label>
                  <input 
                    type="password" 
                    name="pass"
                    value={formData.smtp.pass}
                    onChange={handleSmtpChange}
                    className="settings-input" 
                    placeholder="SMTP App Password"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-2 mb-4 bg-slate-50 p-2.5 rounded border border-slate-200" style={{ lineHeight: '1.5' }}>
                💡 <strong>Need credentials for testing?</strong> Visit <a href="https://ethereal.email" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">ethereal.email</a> and click <strong>"Create Ethereal Account"</strong> to generate a temporary test mailbox, then paste its Username and Password here. For real dispatches, use your company's SMTP or Gmail with an <strong>App Password</strong>.
                <br />
                💡 <strong>Important:</strong> The sender address must be a real email. If your SMTP provider uses a separate login key or username (for example, Resend or Gmail App Passwords), make sure the backend has a valid <code>SMTP_FROM</code> or company email address configured.
              </div>

              <div className="toggle-group mt-2">
                <div className="flex flex-col">
                  <span className="form-label" style={{ marginBottom: '2px' }}>Use Secure SSL/TLS</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Enable this for port 465, disable for port 587/25</span>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    name="secure"
                    checked={formData.smtp.secure}
                    onChange={handleSmtpChange}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            {/* Diagnostic SMTP status box */}
            {smtpStatus && (
              <div className={`p-4 rounded-lg mb-6 border flex items-start gap-3 ${smtpStatus.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {smtpStatus.success ? <CheckCircle2 className="flex-shrink-0 mt-0.5" /> : <AlertTriangle className="flex-shrink-0 mt-0.5" />}
                <div style={{ fontSize: '13px' }}>
                  <strong>{smtpStatus.success ? 'SMTP Verified Successfully!' : 'SMTP Connection Failed'}</strong>
                  <div className="mt-1" style={{ fontSize: '11px' }}>{smtpStatus.message}</div>
                </div>
              </div>
            )}

            {/* Footer Form buttons */}
            <div className="flex justify-between items-center border-t border-slate-200 pt-5">
              <button 
                type="button" 
                className="btn btn-secondary flex items-center gap-2"
                onClick={handleTestSmtp}
                disabled={testingSmtp}
              >
                {testingSmtp ? 'Verifying SMTP...' : 'Test SMTP Connection'}
              </button>
              
              <button 
                type="submit" 
                className="btn btn-primary flex items-center gap-2"
                disabled={loading}
              >
                <Save size={16} />
                <span>Save Profile Settings</span>
              </button>
            </div>

          </form>
        ) : (
          <div className="card text-center p-12 text-slate-400">
            No company profiles available. Click "Add New Company" to create one.
          </div>
        )}

      </div>


    </div>
  );
};

export default SettingsTab;
