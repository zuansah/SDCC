const fs = require('fs');
let code = fs.readFileSync('src/components/ControllerView.tsx', 'utf8');

const loadingIndex = code.indexOf('if (loading)');
console.log('loadingIndex', loadingIndex);
const returnIndex = code.indexOf('return (', 3000);
console.log('returnIndex', returnIndex);
