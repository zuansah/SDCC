const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectManagementDashboard.tsx', 'utf-8');

const targetStatus = `                    <td className="px-6 py-4">
                      <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize \${
                        ba.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                        ba.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        ba.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        ba.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-800'
                      }\`}>
                        {ba.status || 'Draft'}
                      </span>
                    </td>`;

const replacementStatus = `                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize \${
                          ba.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                          ba.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          ba.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          ba.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-800'
                        }\`}>
                          {ba.status || 'Draft'}
                        </span>
                        {ba.status === 'rejected' && ba.rejectNote && (
                          <span className="text-[10px] text-red-600 max-w-[150px] truncate" title={ba.rejectNote}>
                            Note: {ba.rejectNote}
                          </span>
                        )}
                      </div>
                    </td>`;

code = code.replace(targetStatus, replacementStatus);
fs.writeFileSync('src/components/ProjectManagementDashboard.tsx', code);
