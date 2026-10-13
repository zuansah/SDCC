const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf-8');

code = code.replace(
  "{ experimentalForceLongPolling: true }",
  "{ experimentalForceLongPolling: true, experimentalAutoDetectLongPolling: true }"
);

fs.writeFileSync('src/lib/firebase.ts', code);
