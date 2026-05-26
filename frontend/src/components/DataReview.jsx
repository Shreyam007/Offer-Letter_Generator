import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ArrowRight, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Download, 
  Trash2, 
  Check, 
  Users, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import Papa from 'papaparse';

const DataReview = () => {
  const { 
    currentCampaign, 
    candidates, 
    selectedCandidateIds, 
    setSelectedCandidateIds,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    setStep 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Load candidate selection helpers
  const handleSelectAll = (e) => {
    if (selectedCandidateIds.length === filteredCandidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(filteredCandidates.map(c => c._id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedCandidateIds.includes(id)) {
      setSelectedCandidateIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedCandidateIds(prev => [...prev, id]);
    }
  };

  // Inline edit saving
  const handleBlur = async (candId, field, originalValue, e) => {
    const newValue = e.target.value.trim();
    if (newValue === originalValue) return; // No change

    try {
      await updateCandidate(candId, { [field]: newValue });
    } catch (err) {
      alert(`Failed to save edit: ${err.message}`);
    }
  };

  // Add row
  const handleAddRow = async () => {
    if (!currentCampaign) return;
    try {
      await addCandidate({
        campaignId: currentCampaign._id,
        name: 'New Candidate',
        email: 'change-me@example.com',
        role: 'Frontend Developer',
        department: 'Engineering',
        salary: '$100,000',
        joiningDate: 'Oct 15, 2026'
      });
    } catch (err) {
      alert(`Error adding candidate row: ${err.message}`);
    }
  };

  // Delete selected candidates
  const handleDeleteSelected = async () => {
    if (selectedCandidateIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedCandidateIds.length} selected candidates?`)) return;

    try {
      for (const id of selectedCandidateIds) {
        await deleteCandidate(id, currentCampaign._id);
      }
      setSelectedCandidateIds([]);
    } catch (err) {
      alert(`Error deleting candidates: ${err.message}`);
    }
  };

  // Export selection as CSV
  const handleExportCSV = () => {
    const selectedList = candidates.filter(c => selectedCandidateIds.includes(c._id));
    if (selectedList.length === 0) {
      alert('Please select at least one candidate to export.');
      return;
    }

    const csvData = selectedList.map(c => ({
      'Candidate Name': c.name,
      'Email Address': c.email,
      'Role': c.role,
      'Department': c.department,
      'Salary (Annual)': c.salary,
      'Joining Date': c.joiningDate,
      ...c.customFields
    }));

    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${currentCampaign?.name || 'candidates'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle sort order
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Sort Candidate logic
  const filteredCandidates = candidates
    .filter(c => {
      const matchSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchRole = filterRole ? c.role === filterRole : true;
      
      return matchSearch && matchRole;
    })
    .sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (sortField === 'salary') {
        // Strip non-numbers to sort numerically
        aVal = parseFloat(aVal.replace(/[^0-9.]/g, '')) || 0;
        bVal = parseFloat(bVal.replace(/[^0-9.]/g, '')) || 0;
      } else {
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Unique roles for filtering
  const uniqueRoles = [...new Set(candidates.map(c => c.role).filter(Boolean))];

  // Pagination logic
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const paginatedCandidates = filteredCandidates.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredCandidates.length / rowsPerPage) || 1;

  // Calculate stats for bottom dock
  const selectedCandidates = candidates.filter(c => selectedCandidateIds.includes(c._id));
  
  const calculatePayrollImpact = () => {
    let total = 0;
    selectedCandidates.forEach(c => {
      const num = parseFloat((c.salary || '').replace(/[^0-9.]/g, '')) || 0;
      total += num;
    });
    
    if (total >= 1000000) {
      return `$${(total / 1000000).toFixed(1)}M`;
    } else if (total >= 1000) {
      return `$${(total / 1000).toFixed(0)}K`;
    }
    return `$${total}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      
      {/* Wizard Progress Steps Indicator */}
      <div className="wizard-steps">
        <div className="step-node completed">
          <div className="step-circle">✓</div>
          <span className="step-label">Upload CSV</span>
        </div>
        <div className="step-line completed"></div>
        <div className="step-node active">
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

      {/* Main Review Title & Top Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Review Candidate Data</h2>
          <p className="text-slate-500 text-sm mt-1">Verify and refine offer details before proceeding to the template stage.</p>
        </div>
        
        <div className="review-right-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setStep(1)}
          >
            Save Draft
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setStep(3)}
          >
            <span>Continue to Templates</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Search and Table Actions Filter Bar */}
      <div className="review-actions-bar">
        <div className="search-filter-row">
          <div className="search-input-wrapper">
            <Search />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Filter candidates by name, role, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Role Filter Selector */}
          <select
            className="table-filter-btn"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="review-right-actions">
          <button className="table-filter-btn" onClick={handleAddRow}>
            <Plus size={14} />
            <span>Add Row</span>
          </button>
          
          <button className="table-filter-btn" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button 
            className="btn btn-danger" 
            style={{ height: '38px', padding: '0 12px' }}
            disabled={selectedCandidateIds.length === 0}
            onClick={handleDeleteSelected}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Candidates Spreadsheet Grid Table */}
      <div className="table-container">
        <table className="candidates-table">
          <thead>
            <tr>
              <th className="checkbox-cell">
                <div 
                  className={`custom-checkbox ${filteredCandidates.length > 0 && selectedCandidateIds.length === filteredCandidates.length ? 'checked' : ''}`}
                  onClick={handleSelectAll}
                >
                  {filteredCandidates.length > 0 && selectedCandidateIds.length === filteredCandidates.length && <Check />}
                </div>
              </th>
              <th onClick={() => handleSort('name')} className="cursor-pointer select-none">
                Candidate Name <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th onClick={() => handleSort('email')} className="cursor-pointer select-none">
                Email Address <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th onClick={() => handleSort('role')} className="cursor-pointer select-none">
                Role <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th onClick={() => handleSort('department')} className="cursor-pointer select-none">
                Department <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th onClick={() => handleSort('salary')} className="cursor-pointer select-none">
                Salary (Annual) <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th onClick={() => handleSort('joiningDate')} className="cursor-pointer select-none">
                Joining Date <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCandidates.map((c) => (
              <tr 
                key={c._id} 
                className={selectedCandidateIds.includes(c._id) ? 'selected' : ''}
              >
                <td className="checkbox-cell">
                  <div 
                    className={`custom-checkbox ${selectedCandidateIds.includes(c._id) ? 'checked' : ''}`}
                    onClick={() => handleSelectOne(c._id)}
                  >
                    {selectedCandidateIds.includes(c._id) && <Check />}
                  </div>
                </td>
                <td>
                  <input 
                    type="text" 
                    className="table-cell-input font-semibold"
                    defaultValue={c.name}
                    onBlur={(e) => handleBlur(c._id, 'name', c.name, e)}
                  />
                </td>
                <td>
                  <input 
                    type="email" 
                    className="table-cell-input"
                    defaultValue={c.email}
                    onBlur={(e) => handleBlur(c._id, 'email', c.email, e)}
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    className="table-cell-input"
                    defaultValue={c.role}
                    onBlur={(e) => handleBlur(c._id, 'role', c.role, e)}
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    className="table-cell-input"
                    defaultValue={c.department}
                    onBlur={(e) => handleBlur(c._id, 'department', c.department, e)}
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    className="table-cell-input"
                    defaultValue={c.salary}
                    onBlur={(e) => handleBlur(c._id, 'salary', c.salary, e)}
                  />
                </td>
                <td>
                  <input 
                    type="text" 
                    className="table-cell-input"
                    defaultValue={c.joiningDate}
                    onBlur={(e) => handleBlur(c._id, 'joiningDate', c.joiningDate, e)}
                  />
                </td>
                <td>
                  <span className={`status-badge ${c.status === 'Validated' ? 'validated' : 'invalid'}`}>
                    <span className="status-dot"></span>
                    <span>{c.status}</span>
                  </span>
                </td>
              </tr>
            ))}
            {paginatedCandidates.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-8 text-slate-400">
                  No candidates found matching the filters. Click "Add Row" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-footer">
        <div className="pagination-info">
          Showing {filteredCandidates.length > 0 ? indexOfFirstRow + 1 : 0} to {Math.min(indexOfLastRow, filteredCandidates.length)} of {filteredCandidates.length} candidates
        </div>
        
        <div className="pagination-controls">
          <button 
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(page => (
            <button
              key={page}
              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}

          <button 
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            <ChevronRight size={16} />
          </button>
          
          <div className="page-size-selector ml-4">
            <span>Rows per page:</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Bottom Campaign Actions Summary Bar */}
      <div className="summary-action-dock">
        <div className="dock-stats">
          <div className="dock-stat-item">
            <div className="dock-stat-icon-wrapper">
              <Users size={20} />
            </div>
            <div className="dock-stat-details">
              <span className="dock-stat-val">{selectedCandidateIds.length}</span>
              <span className="dock-stat-lbl">Candidates Selected</span>
            </div>
          </div>

          <div className="dock-stat-item">
            <div className="dock-stat-icon-wrapper">
              <DollarSign size={20} />
            </div>
            <div className="dock-stat-details">
              <span className="dock-stat-val">{calculatePayrollImpact()}</span>
              <span className="dock-stat-lbl">Total Payroll Impact</span>
            </div>
          </div>
        </div>

        <div className="dock-buttons">
          <button 
            className="btn dock-btn-secondary"
            onClick={() => alert(`Reviewing selection of ${selectedCandidateIds.length} candidates`)}
          >
            Review Selection
          </button>
          <button 
            className="btn dock-btn-primary"
            onClick={() => setStep(3)}
          >
            <span>Next: Choose Templates</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

    </div>
  );
};

export default DataReview;
