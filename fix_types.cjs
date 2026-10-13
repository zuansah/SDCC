const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');
if (!content.includes('userId?: string;')) {
  content = content.replace("id: string;", "id: string;\n  userId?: string;");
  fs.writeFileSync('src/types.ts', content);
}
