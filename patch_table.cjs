const fs = require('fs');

let content = fs.readFileSync('src/components/ProjectManagementDashboard.tsx', 'utf8');

// 1. Add "Fill Duration" column header
content = content.replace(
  '<th className="px-6 py-4 font-semibold text-slate-600">Created Date</th>',
  '<th className="px-6 py-4 font-semibold text-slate-600">Created Date</th>\n                <th className="px-6 py-4 font-semibold text-slate-600">Fill Time</th>'
);

// 2. Add formDurationSeconds data
const rowOld = `                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {formatDate(ba.createdAt)}
                  </td>`;
const rowNew = `                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {formatDate(ba.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    {ba.formDurationSeconds ? \`\${Math.floor(ba.formDurationSeconds / 60)}m \${ba.formDurationSeconds % 60}s\` : '-'}
                  </td>`;
content = content.replace(rowOld, rowNew);

fs.writeFileSync('src/components/ProjectManagementDashboard.tsx', content);
