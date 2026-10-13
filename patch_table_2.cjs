const fs = require('fs');

let content = fs.readFileSync('src/components/ProjectManagementDashboard.tsx', 'utf8');

// 1. Add "Fill Duration" column header
content = content.replace(
  '<th className="px-6 py-3 font-semibold">Date</th>',
  '<th className="px-6 py-3 font-semibold">Date</th>\n                <th className="px-6 py-3 font-semibold">Fill Time</th>'
);

// 2. Add formDurationSeconds data
const rowOld = `                    <td className="px-6 py-4 text-slate-600">{formatDate(ba.createdAt)}</td>
                    <td className="px-6 py-4">`;
const rowNew = `                    <td className="px-6 py-4 text-slate-600">{formatDate(ba.createdAt)}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {ba.formDurationSeconds ? \`\${Math.floor(ba.formDurationSeconds / 60)}m \${ba.formDurationSeconds % 60}s\` : '-'}
                    </td>
                    <td className="px-6 py-4">`;
content = content.replace(rowOld, rowNew);

// 3. Fix colSpan
content = content.replace('colSpan={6}', 'colSpan={7}');

fs.writeFileSync('src/components/ProjectManagementDashboard.tsx', content);
