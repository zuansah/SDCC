const fs = require('fs');
let content = fs.readFileSync('src/components/MonitoringView.tsx', 'utf8');
content = content.replace(
  'return Object.entries(meta.tenants).sort((a, b) => b[1] - a[1]);',
  'return Object.entries(meta.tenants).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);'
);
fs.writeFileSync('src/components/MonitoringView.tsx', content);
