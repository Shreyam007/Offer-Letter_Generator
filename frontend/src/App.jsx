import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CsvUpload from './components/CsvUpload';
import DataReview from './components/DataReview';
import TemplateEditor from './components/TemplateEditor';
import PreviewSend from './components/PreviewSend';
import HistoryTab from './components/HistoryTab';
import SettingsTab from './components/SettingsTab';
import PublicOfferPortal from './components/PublicOfferPortal';

// Main dashboard container that consumes AppContext
const MainAppContent = () => {
  const [activeTab, setActiveTab] = useState('workflow'); // workflow, templates, history, settings
  const { step, currentCampaign } = useApp();

  const renderContent = () => {
    switch (activeTab) {
      case 'workflow':
        // Steps wizard
        if (step === 1) return <CsvUpload />;
        if (step === 2 && currentCampaign) return <DataReview />;
        if (step === 3) return <TemplateEditor />;
        if (step === 4 && currentCampaign) return <PreviewSend />;
        return <CsvUpload />; // default fallback

      case 'templates':
        return <TemplateEditor />;

      case 'history':
        return <HistoryTab />;

      case 'settings':
        return <SettingsTab />;

      default:
        return <CsvUpload />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Nav */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main Panel Viewport */}
      <div className="main-wrapper">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* Scrollable page body */}
        <main className="content-body">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const viewOfferId = queryParams.get('viewOffer');

  return (
    <AppProvider>
      {viewOfferId ? (
        <PublicOfferPortal candidateId={viewOfferId} />
      ) : (
        <MainAppContent />
      )}
    </AppProvider>
  );
}

export default App;
