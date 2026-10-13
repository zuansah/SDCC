const fs = require('fs');
let data = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
data.exclude = ["map.json", "map-meta.json", "node_modules", "dist"];
fs.writeFileSync('tsconfig.json', JSON.stringify(data, null, 2));
