const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// I will just look for `          </div>\n          {/* Section: ` and replace it with `          </div>\n          </div>\n          {/* Section: `
code = code.replace(/          <\/div>\n          {\/\* Section:/g, '          </div>\n          </div>\n          {/* Section:');

// And at the very end before `</form>`, there is:
// `          </div>\n          \n        </form>`
code = code.replace(/          <\/div>\n                  <\/form>/g, '          </div>\n          </div>\n                  </form>');

fs.writeFileSync('src/components/BAForm.tsx', code);
