const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');
code = code.replace(
  /match \/bas\/\{document=\*\*\} \{/,
  "match /assurance_tickets/{document=**} {\n      allow read, write: if true;\n    }\n    match /bas/{document=**} {"
);
fs.writeFileSync('firestore.rules', code);
