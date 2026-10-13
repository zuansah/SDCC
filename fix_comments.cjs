const fs = require('fs');
let content = fs.readFileSync('src/lib/utils.ts', 'utf8');
content = content.replace(
  '// Aggressive compression to ensure multiple images (15+) fit under 1MB per document',
  '// High-quality compression. Limit dimension to 1600px to ensure each image fits well within Firestore 1MB document limit.'
);
content = content.replace(
  '// Compress as JPEG at 40% quality to keep size minimal for 15+ images',
  '// Compress as JPEG at 80% quality for high resolution (each image gets its own Firestore document)'
);
fs.writeFileSync('src/lib/utils.ts', content);
