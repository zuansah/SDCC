const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

code = code.replace(/          <\/div>\n                  <\/form>/g, '          </div>\n          </div>\n                  </form>');

fs.writeFileSync('src/components/BAForm.tsx', code);
