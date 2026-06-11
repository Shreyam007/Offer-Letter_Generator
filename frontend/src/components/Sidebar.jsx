import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Upload, 
  Database, 
  Edit3, 
  Send, 
  History, 
  Settings, 
  ChevronDown, 
  Building2 
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { 
    companies, 
    selectedCompany, 
    setSelectedCompany, 
    step, 
    setStep,
    currentCampaign
  } = useApp();
  
  const handleNavClick = (tabName, stepNum) => {
    setActiveTab(tabName);
    if (stepNum) {
      setStep(stepNum);
    }
  };

  // Helper to render company logo safely (SVG vs Image URL)
  const renderCompanyLogo = (logoStr) => {
    if (!logoStr) return <Building2 size={20} className="text-slate-400" />;
    
    if (logoStr.trim().startsWith('<svg')) {
      return <div dangerouslySetInnerHTML={{ __html: logoStr }} className="w-full h-full" />;
    }
    
    return <img src={logoStr} alt="Company Logo" className="w-full h-full object-contain" />;
  };

  return (
    <aside className="sidebar">
      <div>
        {/* Brand Logo */}
        <div className="logo-container">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg">
            T
          </div>
          <span className="logo-text">TalentDraft</span>
        </div>

        {/* Company Profile Selection Widget */}
        {selectedCompany && (
          <div className="company-profile-widget" style={{ cursor: 'default' }}>
            <div className="company-logo-avatar">
              {renderCompanyLogo(selectedCompany.logo)}
            </div>
            <div className="company-info">
              <div className="company-info-name">{selectedCompany.name}</div>
              <div className="company-info-dept">{selectedCompany.tagline || 'HR Department'}</div>
            </div>
          </div>
        )}

        {/* Navigation Sidebar List */}
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'workflow' && step === 1 ? 'active' : ''}`}
            onClick={() => handleNavClick('workflow', 1)}
          >
            <Upload />
            <span>Upload CSV</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'workflow' && step === 2 ? 'active' : ''} ${!currentCampaign ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => handleNavClick('workflow', 2)}
          >
            <Database />
            <span>Data Review</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'workflow' && step === 3 ? 'active' : ''}`}
            onClick={() => handleNavClick('workflow', 3)}
          >
            <Edit3 />
            <span>Edit Template</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'workflow' && step === 4 ? 'active' : ''} ${!currentCampaign ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => handleNavClick('workflow', 4)}
          >
            <Send />
            <span>Preview & Send</span>
          </div>
        </nav>
      </div>

      {/* Sidebar Footer Option */}
      <div className="sidebar-footer">
        <div 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleNavClick('history')}
        >
          <History />
          <span>Archive History</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
        >
          <Settings />
          <span>Settings</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
