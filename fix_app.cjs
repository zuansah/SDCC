const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  ", getDocs } } from 'firebase/firestore';",
  ", getDocs } from 'firebase/firestore';"
);
content = content.replace(
  "} , getDocs } from 'firebase/firestore';",
  ", getDocs } from 'firebase/firestore';"
);
// In case the brace was matched differently:
content = content.replace(
  "orderBy }, getDocs } from",
  "orderBy, getDocs } from"
);
fs.writeFileSync('src/App.tsx', content);
