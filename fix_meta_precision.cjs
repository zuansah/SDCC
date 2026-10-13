const fs = require('fs');
let content = fs.readFileSync('src/components/MonitoringView.tsx', 'utf8');

// 1. Update interface Meta
content = content.replace(
  'byGeoSource: Record<string, number>;\n  tenants:',
  'byGeoSource: Record<string, number>;\n  byPrecision: Record<string, number>;\n  exact: number;\n  tenants:'
);

// 2. Update legend
content = content.replace(
  '<span className="text-slate-600">Exact GPS ({meta.exact})</span>',
  '<span className="text-slate-600">Exact GPS ({meta.byPrecision[\'EXACT\']})</span>'
);

content = content.replace(
  '<span className="text-slate-600">Approximate point</span>',
  '<span className="text-slate-600">Approximate point ({meta.byPrecision[\'APPROX\']})</span>'
);

content = content.replace(
  '<span className="text-slate-600">City centroid ({meta.mapped - meta.exact})</span>',
  '<span className="text-slate-600">City centroid ({meta.byPrecision[\'CITY\']})</span>'
);

fs.writeFileSync('src/components/MonitoringView.tsx', content);
