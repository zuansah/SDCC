const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectManagementDashboard.tsx', 'utf-8');

// Add DeleteSelected props and states
if (!code.includes('onDeleteMany')) {
  code = code.replace(
    '  onDelete: (id: string) => void;',
    `  onDelete: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;`
  );
  
  code = code.replace(
    'onRefresh, loading, userData }: ProjectManagementDashboardProps) {',
    'onRefresh, loading, userData, onDeleteMany }: ProjectManagementDashboardProps) {\n  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);'
  );

  // Add Handle Select All and Select Row
  code = code.replace(
    'const filteredBas = bas.filter(ba => {',
    `const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (confirm(\`Are you sure you want to delete \${selectedIds.length} selected document(s)?\`)) {
      if (onDeleteMany) {
        onDeleteMany(selectedIds);
      } else {
        // Fallback if not provided
        selectedIds.forEach(id => onDelete(id));
      }
      setSelectedIds([]);
    }
  };

  const filteredBas = bas.filter(ba => {`
  );

  // Add bulk delete button next to refresh button
  code = code.replace(
    '<RefreshCw className={`w-4 h-4 ${loading ? \'animate-spin\' : \'\'}`} />',
    '<RefreshCw className={`w-4 h-4 ${loading ? \'animate-spin\' : \'\'}`} />'
  );
  
  const refreshButtonBlock = `<div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}`;
              
  const newRefreshBlock = `<div className="flex items-center gap-3">
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
              disabled={loading}`;
              
  code = code.replace(refreshButtonBlock, newRefreshBlock);

  // Add checkbox to table header
  code = code.replace(
    '<th className="px-6 py-3 font-semibold">Project Name</th>',
    `<th className="px-6 py-3 w-12 text-center">
                  <input type="checkbox" onChange={handleSelectAll} checked={filteredBas.length > 0 && selectedIds.length === filteredBas.length} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <th className="px-6 py-3 font-semibold">Project Name</th>`
  );

  // Add checkbox to table row
  code = code.replace(
    '<td className="px-6 py-4 font-medium text-slate-900">{ba.projectName || \'Untitled\'}</td>',
    `<td className="px-6 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.includes(ba.id)} onChange={() => handleSelectRow(ba.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{ba.projectName || \'Untitled\'}</td>`
  );
  
  // Need to fix colspan for "No documents found"
  code = code.replace(
    'colSpan={7}',
    'colSpan={8}'
  );

  fs.writeFileSync('src/components/ProjectManagementDashboard.tsx', code);
}
