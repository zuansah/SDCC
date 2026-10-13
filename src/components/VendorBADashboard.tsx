import React from 'react';
import { RefreshCw, FileText, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { BAData } from '../types';

interface VendorBADashboardProps {
  bas: BAData[];
  onRefresh: () => void;
  loading: boolean;
  onPreview: (ba: BAData) => void;
}

export default function VendorBADashboard({ bas, onRefresh, loading, onPreview }: VendorBADashboardProps) {
  // Vendor PMs should only see Drafts and Rejected BAs
  const vendorBas = bas.filter(ba => ba.status === 'draft' || ba.status === 'rejected');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rejected':
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      case 'draft':
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Draft</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Vendor PM Dashboard</h2>
          <p className="text-slate-500 mt-1">Review your draft and rejected BA documents.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading && vendorBas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-slate-400" />
            <p>Loading documents...</p>
          </div>
        ) : vendorBas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12">
            <FileText className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-700">No documents found</p>
            <p className="text-sm mt-1">You don't have any drafts or rejected documents to review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Project Name</th>
                  <th className="px-6 py-4 font-semibold">Site Name</th>
                  <th className="px-6 py-4 font-semibold">Prepared By</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorBas.map((ba) => (
                  <tr key={ba.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{ba.projectName || 'Untitled Project'}</td>
                    <td className="px-6 py-4 text-slate-600">{ba.siteName || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{ba.preparedBy || '-'}</td>
                    <td className="px-6 py-4">{getStatusBadge(ba.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onPreview(ba)}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
