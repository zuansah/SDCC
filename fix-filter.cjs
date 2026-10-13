const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectManagementDashboard.tsx', 'utf-8');

const targetState = `  const [search, setSearch] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  const filteredBas = bas.filter(ba => 
    (ba.projectName || '').toLowerCase().includes(search.toLowerCase()) ||
    (ba.siteName || '').toLowerCase().includes(search.toLowerCase())
  );`;

const replacementState = `  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  const filteredBas = bas.filter(ba => {
    const matchesSearch = (ba.projectName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (ba.siteName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ba.status === statusFilter;
    return matchesSearch && matchesStatus;
  });`;

code = code.replace(targetState, replacementState);

const targetSearch = `        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <h4 className="font-bold text-slate-800">BA Documents</h4>
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
        </div>`;

const replacementSearch = `        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
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
        </div>`;

code = code.replace(targetSearch, replacementSearch);

fs.writeFileSync('src/components/ProjectManagementDashboard.tsx', code);
