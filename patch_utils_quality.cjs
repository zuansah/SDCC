const fs = require('fs');

let content = fs.readFileSync('src/lib/utils.ts', 'utf8');

// The aggressive compression was:
// const MAX_WIDTH = 500;
// const MAX_HEIGHT = 500;
// and quality 0.4.

// Let's change to higher limits. Since Firestore has 1MB per document, 
// a base64 encoded string of 1MB is ~750KB of binary. 
// A 1200x1200 jpeg at 0.8 quality is typically 200-400KB, well under 750KB.
// A 1600x1600 jpeg at 0.8 quality is around 300-600KB. 
// We will use 1600x1600 at 0.8.

content = content.replace('const MAX_WIDTH = 500;', 'const MAX_WIDTH = 1600;');
content = content.replace('const MAX_HEIGHT = 500;', 'const MAX_HEIGHT = 1600;');
content = content.replace("canvas.toDataURL('image/jpeg', 0.4)", "canvas.toDataURL('image/jpeg', 0.8)");

fs.writeFileSync('src/lib/utils.ts', content);
