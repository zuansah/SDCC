const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectManagementDashboard.tsx', 'utf-8');

// Update Interface
code = code.replace(
  `interface ProjectManagementDashboardProps {
  bas: BAData[];
  onEdit: (ba: BAData) => void;
  onPreview: (ba: BAData) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  onStatusChange: (id: string, status: 'accepted' | 'rejected') => void;`,
  `interface ProjectManagementDashboardProps {
  bas: BAData[];
  onEdit: (ba: BAData) => void;
  onPreview: (ba: BAData) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  onStatusChange: (id: string, status: 'accepted' | 'rejected', rejectNote?: string) => void;
  userData?: any;`
);

// Destructure userData
code = code.replace(
  `export default function ProjectManagementDashboard({ bas, onEdit, onPreview, onDelete, onCreateNew, onStatusChange, onRefresh, loading }: ProjectManagementDashboardProps) {`,
  `export default function ProjectManagementDashboard({ bas, onEdit, onPreview, onDelete, onCreateNew, onStatusChange, onRefresh, loading, userData }: ProjectManagementDashboardProps) {`
);

// Determine permissions
code = code.replace(
  `  const filteredBas = bas.filter(ba => {`,
  `  const canEdit = userData?.role === 'Super Admin' || userData?.role === 'Admin' || userData?.role === 'Vendor PM';
  const canApprove = userData?.role === 'Super Admin' || userData?.role === 'Admin';
  
  const filteredBas = bas.filter(ba => {`
);

// Replace actions rendering
const targetActions = `                              <button 
                                onClick={() => { setMenuOpen(null); onPreview(ba); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              <button 
                                onClick={() => { setMenuOpen(null); onEdit(ba); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" /> Edit Document
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button 
                                onClick={() => { setMenuOpen(null); onStatusChange(ba.id, 'accepted'); }}
                                className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" /> Accept
                              </button>
                              <button 
                                onClick={() => { setMenuOpen(null); onStatusChange(ba.id, 'rejected'); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" /> Reject
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button 
                                onClick={() => { setMenuOpen(null); onDelete(ba.id); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>`;

const replacementActions = `                              <button 
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
                              )}`;

code = code.replace(targetActions, replacementActions);

fs.writeFileSync('src/components/ProjectManagementDashboard.tsx', code);
