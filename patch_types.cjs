const fs = require('fs');

// Patch types.ts
let typesCode = fs.readFileSync('src/types.ts', 'utf-8');
if (!typesCode.includes('modemMainImg')) {
  typesCode = typesCode.replace(
    '  snOntImg?: string;',
    '  snOntImg?: string;\n  modemMainImg?: string;\n  modemBackupImg?: string;'
  );
  fs.writeFileSync('src/types.ts', typesCode);
}

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
if (!appCode.includes('modemMainImg')) {
  appCode = appCode.replace(
    "  'snOntImg',",
    "  'snOntImg',\n  'modemMainImg',\n  'modemBackupImg',"
  );
  fs.writeFileSync('src/App.tsx', appCode);
}
