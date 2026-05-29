// OfferFlow HR Header Component with Theme Selector
import React from 'react';
import { Bell, HelpCircle, Sun, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Header = ({ activeTab, setActiveTab }) => {
  const { setStep, theme, toggleTheme } = useApp();

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    if (tabName === 'workflow') {
      setStep(1); // Default to upload CSV step when clicking Dashboard
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 
          className="header-title-main" 
          style={{ cursor: 'pointer' }}
          onClick={() => handleTabClick('workflow')}
        >
          OfferFlow HR
        </h1>
        
        <div className="header-tabs">
          <div 
            className={`header-tab ${activeTab === 'workflow' ? 'active' : ''}`}
            onClick={() => handleTabClick('workflow')}
          >
            Dashboard
          </div>
          <div 
            className={`header-tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => handleTabClick('templates')}
          >
            Templates
          </div>
          <div 
            className={`header-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabClick('history')}
          >
            History
          </div>
          <div 
            className={`header-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabClick('settings')}
          >
            Settings
          </div>
        </div>
      </div>

      <div className="header-right">
        <button
          className="header-icon-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{
            marginRight: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        {/* Admin Badge Profile Widget */}
        <div className="user-profile-widget" style={{ padding: '8px 16px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Admin</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
