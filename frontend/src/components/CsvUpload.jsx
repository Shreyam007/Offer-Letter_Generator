import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Upload, FileText, CheckCircle2, AlertTriangle, Info, ArrowRight, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';

const CsvUpload = () => {
  const { 
    selectedCompany, 
    createCampaign, 
    uploadCandidates, 
    setStep, 
    campaigns,
    loadCampaigns,
    setCurrentCampaign,
    loadCandidates,
    addActivity
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCampaigns();
    } catch (err) {
      console.error(err);
    }
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleSelectCampaign = async (camp) => {
    try {
      setCurrentCampaign(camp);
      await loadCandidates(camp._id);
      setStep(2);
    } catch (err) {
      alert('Failed to load campaign: ' + err.message);
    }
  };

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [campaignName, setCampaignName] = useState('');
  
  // Scanned Stats
  const [stats, setStats] = useState({
    totalRows: 0,
    columns: 0,
    validEmails: 0,
    invalidEmails: 0
  });
  
  const [mappedColumns, setMappedColumns] = useState([]);
  const [parsing, setParsing] = useState(false);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const processFile = (uploadedFile) => {
    if (!uploadedFile.name.endsWith('.csv')) {
      alert('Only .csv files are supported. Please select a valid CSV.');
      return;
    }

    setFile(uploadedFile);
    setParsing(true);
    // Auto populate campaign name from file name (sans extension)
    const baseName = uploadedFile.name.replace(/\.[^/.]+$/, "");
    setCampaignName(`${baseName} Campaign`);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const headers = results.meta.fields || [];
        
        // Strict verification: headers must match exactly in content and order
        const requiredHeaders = [
          'name', 'email', 'Phone', 'Organization', 'Registration Date',
          'Payment Status', 'Attendance Status', 'Status', 'AICTE_Code',
          'Role', 'Duration', 'Start Date', 'Mode', 'Internship_Name', 'Partner_Name'
        ];

        const cleanHeaders = headers.map(h => h.trim());
        const isHeaderMatch = cleanHeaders.length === requiredHeaders.length &&
          requiredHeaders.every((h, idx) => cleanHeaders[idx] === h);

        if (!isHeaderMatch) {
          alert(`Strict CSV Structure Validation Failed!\n\nCSV must contain exactly these columns in order:\n${requiredHeaders.join(', ')}\n\nNo other columns, no extra fields allowed.`);
          setFile(null);
          setParsedData([]);
          setStats({ totalRows: 0, columns: 0, validEmails: 0, invalidEmails: 0 });
          setParsing(false);
          return;
        }

        // Count valid/invalid emails using verified 'email' column
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        let validCount = 0;
        let invalidCount = 0;

        rows.forEach(row => {
          const emailVal = row['email'] || '';
          if (emailRegex.test(emailVal.trim())) {
            validCount++;
          } else {
            invalidCount++;
          }
        });

        setStats({
          totalRows: rows.length,
          columns: headers.length,
          validEmails: validCount,
          invalidEmails: invalidCount
        });

        // We map name -> name, email -> email, role -> Role, start date -> Start Date, others to customFields
        setMappedColumns(['Name', 'Email', 'Role', 'Start Date']);
        setParsedData(rows);
        setParsing(false);
      },
      error: (err) => {
        alert(`Error parsing CSV: ${err.message}`);
        setParsing(false);
      }
    });
  };

  const handleContinue = async () => {
    if (!campaignName.trim()) {
      alert('Please enter a name for this campaign.');
      return;
    }
    if (!selectedCompany) {
      alert('Please select a company profile from the sidebar first.');
      return;
    }

    try {
      // Create campaign in db
      const campaign = await createCampaign(campaignName, selectedCompany._id);
      
      // Upload parsed candidate array to campaign
      await uploadCandidates(campaign._id, parsedData);
      
      // Add activity
      addActivity(file.name, 'success', `Just uploaded • ${stats.totalRows} rows`);
      
      // Go to step 2
      setStep(2);
    } catch (err) {
      alert(`Failed to save candidates: ${err.message}`);
      addActivity(file.name, 'danger', 'Failed: Invalid schema or database error');
    }
  };

  return (
    <div className="split-layout">
      {/* Left Main Upload Container */}
      <div className="upload-container">
        
        {/* Step Wizard Header */}
        <div className="wizard-steps">
          <div className="step-node active">
            <div className="step-circle">1</div>
            <span className="step-label">Upload CSV</span>
          </div>
          <div className="step-line"></div>
          <div className="step-node">
            <div className="step-circle">2</div>
            <span className="step-label">Data Review</span>
          </div>
          <div className="step-line"></div>
          <div className="step-node">
            <div className="step-circle">3</div>
            <span className="step-label">Edit Template</span>
          </div>
          <div className="step-line"></div>
          <div className="step-node">
            <div className="step-circle">4</div>
            <span className="step-label">Send Offers</span>
          </div>
        </div>

        {/* Drag-and-drop box */}
        <form 
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onSubmit={(e) => e.preventDefault()}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            multiple={false} 
            accept=".csv"
            onChange={handleFileChange}
          />
          
          <div className="upload-icon-circle">
            <Upload />
          </div>
          
          <div className="upload-title">Upload Candidate Data</div>
          <div className="upload-subtitle">Drag and drop your candidates.csv file here, or click to browse your computer.</div>
          
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={onButtonClick}
          >
            Select File
          </button>
          
          <div className="upload-formats">Supported formats: .CSV (Max 10MB)</div>
        </form>

        {/* Parsing Indicator */}
        {parsing && (
          <div className="text-center p-4">
            <RefreshCw className="animate-spin text-blue-600 inline-block mr-2" />
            <span className="text-sm font-semibold">Parsing candidate spreadsheet...</span>
          </div>
        )}

        {/* Results Details Box */}
        {file && !parsing && (
          <div className="upload-results">
            <div className="results-header">
              <div className="file-info-badge">
                <FileText className="text-blue-600" size={18} />
                <span>{file.name}</span>
                <span className="time-scanned">Just scanned</span>
              </div>
              <button 
                type="button" 
                className="btn-link"
                onClick={onButtonClick}
              >
                Re-upload
              </button>
            </div>

            {/* Campaign Name Input */}
            <div className="form-group mb-4" style={{ maxWidth: '400px' }}>
              <label className="form-label">Campaign Name</label>
              <input 
                type="text" 
                className="settings-input" 
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign title (e.g. Q4 Interns)"
              />
            </div>

            {/* Stats Dashboard Grid */}
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">Total Rows</div>
                <div className="stat-value">{stats.totalRows}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Recognized Columns</div>
                <div className="stat-value">{stats.columns}</div>
              </div>
              <div className="stat-box success">
                <div className="stat-label">Valid Emails</div>
                <div className="stat-value text-emerald-600">{stats.validEmails}</div>
              </div>
              <div className="stat-box danger">
                <div className="stat-label">Invalid Emails</div>
                <div className="stat-value text-red-600">{stats.invalidEmails}</div>
              </div>
            </div>

            {/* Helper Mapping Notification Banner */}
            <div className="info-banner">
              <div className="info-banner-left">
                <Info size={18} />
                <span>
                  We've automatically mapped: <strong>{mappedColumns.join(', ') || 'None (Using raw columns)'}</strong>.
                </span>
              </div>
              <button 
                onClick={handleContinue}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <span>Continue to Review</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Activity Sidebar Panel */}
      <div className="side-panel">
        <div className="panel-header">
          <div className="panel-title">Recent Uploads</div>
          <RefreshCw 
            size={14} 
            className={`text-slate-400 cursor-pointer hover:text-slate-600 ${refreshing ? 'animate-spin' : ''}`} 
            onClick={handleRefresh}
          />
        </div>
        
        <div className="activity-list">
          {campaigns.slice(0, 5).map((camp) => (
            <div 
              key={camp._id} 
              className="activity-item cursor-pointer hover:bg-slate-50 p-1.5 rounded transition"
              onClick={() => handleSelectCampaign(camp)}
              style={{ cursor: 'pointer' }}
              title="Click to review candidate grid"
            >
              <div className="activity-icon-box success">
                <CheckCircle2 size={16} />
              </div>
              <div className="activity-details">
                <div className="activity-file-name" title={camp.name}>{camp.name}</div>
                <div className="activity-meta">
                  {new Date(camp.createdAt).toLocaleDateString()} • {camp.totalCount || 0} rows
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-6">
              No recent campaigns. Upload a CSV to start.
            </div>
          )}
        </div>

        <button 
          className="btn btn-secondary w-full" 
          style={{ fontSize: '13px' }}
          onClick={handleRefresh}
        >
          Refresh List
        </button>
      </div>
    </div>
  );
};

export default CsvUpload;
