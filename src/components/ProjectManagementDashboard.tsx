import React from 'react';
import { BAData } from '../types';
import { formatDate } from '../lib/utils';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2, Link2, ExternalLink, ShoppingCart, Package, Clock, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface ProjectManagementDashboardProps {
  bas: BAData[];
  onEdit: (ba: BAData) => void;
  onPreview: (ba: BAData) => void;
  onDelete: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;
  onCreateNew: () => void;
  onStatusChange: (id: string, status: 'accepted' | 'rejected', rejectNote?: string) => void;
  userData?: any;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function ProjectManagementDashboard({ bas, onEdit, onPreview, onDelete, onCreateNew, onStatusChange, onRefresh, loading, userData, onDeleteMany }: ProjectManagementDashboardProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  const canEdit = userData?.role === 'Super Admin' || userData?.role === 'Admin' || userData?.role === 'Vendor PM';
  const canApprove = userData?.role === 'Super Admin' || userData?.role === 'Admin';
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredBas.map(ba => ba.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected document(s)?`)) {
      if (onDeleteMany) {
        onDeleteMany(selectedIds);
      } else {
        // Fallback if not provided
        selectedIds.forEach(id => onDelete(id));
      }
      setSelectedIds([]);
    }
  };

  const filteredBas = bas.filter(ba => {
    const matchesSearch = (ba.projectName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (ba.siteName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ba.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 w-full space-y-6 h-full flex flex-col bg-slate-50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Project Management Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Manage all your generated BA documents and project links.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && canEdit && (
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium text-sm shadow-sm hover:bg-red-100 focus:ring-2 focus:ring-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.length})
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium text-sm shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?role=technician`;
              navigator.clipboard.writeText(url);
              alert('Technician form link copied to clipboard:\n' + url);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium text-sm shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <Link2 className="w-4 h-4" />
            Share Form Link
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?role=technician`;
              window.open(url, '_blank');
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-md font-medium text-sm shadow-sm hover:bg-slate-200 focus:ring-2 focus:ring-slate-500 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Open Form
          </button>
          
          <button
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Internal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Total Order</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">6,072</h3>
          </div>
          <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Installed</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">7</h3>
          </div>
          <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center">
            <Package className="w-6 h-6 text-teal-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">TTD</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">3 Days</h3>
          </div>
          <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">ABD Reported</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">{bas.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Accepted</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">{bas.filter(b => b.status === 'accepted').length}</h3>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Rejected</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">{bas.filter(b => b.status === 'rejected').length}</h3>
          </div>
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
          <h4 className="font-bold text-slate-800">BA Documents</h4>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search project or site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-64"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-3 w-12 text-center">
                  <input type="checkbox" onChange={handleSelectAll} checked={filteredBas.length > 0 && selectedIds.length === filteredBas.length} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <th className="px-6 py-3 font-semibold">Project Name</th>
                <th className="px-6 py-3 font-semibold">Site Name</th>
                <th className="px-6 py-3 font-semibold">Prepared By</th>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Fill Time</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No documents found. Create one to get started.
                  </td>
                </tr>
              ) : (
                filteredBas.map((ba) => (
                  <tr key={ba.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.includes(ba.id)} onChange={() => handleSelectRow(ba.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{ba.projectName || 'Untitled'}</td>
                    <td className="px-6 py-4 text-slate-600">{ba.siteName || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{ba.preparedBy || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(ba.createdAt)}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {ba.formDurationSeconds ? `${Math.floor(ba.formDurationSeconds / 60)}m ${ba.formDurationSeconds % 60}s` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          ba.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                          ba.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          ba.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          ba.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {ba.status || 'Draft'}
                        </span>
                        {ba.status === 'rejected' && ba.rejectNote && (
                          <span className="text-[10px] text-red-600 max-w-[150px] truncate" title={ba.rejectNote}>
                            Note: {ba.rejectNote}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setMenuOpen(menuOpen === ba.id ? null : ba.id)}
                          className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-500" />
                        </button>
                        
                        {menuOpen === ba.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-100 z-20 py-1">
                              <button 
                                onClick={() => { setMenuOpen(null); onPreview(ba); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              {canEdit && (
                                <button 
                                  onClick={() => { setMenuOpen(null); onEdit(ba); }}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Edit className="w-4 h-4" /> Edit Document
                                </button>
                              )}
                              {canApprove && (
                                <>
                                  <div className="border-t border-slate-100 my-1"></div>
                                  <button 
                                    onClick={() => { setMenuOpen(null); onStatusChange(ba.id, 'accepted'); }}
                                    className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Accept
                                  </button>
                                  <button 
                                    onClick={() => { 
                                      setMenuOpen(null); 
                                      const note = window.prompt('Please enter the reason for rejection:');
                                      if (note !== null) {
                                        onStatusChange(ba.id, 'rejected', note || undefined); 
                                      }
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <XCircle className="w-4 h-4" /> Reject
                                  </button>
                                </>
                              )}
                              {canEdit && (
                                <>
                                  <div className="border-t border-slate-100 my-1"></div>
                                  <button 
                                    onClick={() => { setMenuOpen(null); onDelete(ba.id); }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
