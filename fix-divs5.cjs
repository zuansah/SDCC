const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// The current structure before the comment is:
//             </div>
//           </div>
// 
//           {/* Section:
code = code.replace(/          <\/div>\n          <\/div>\n\n          {\/\* Section:/g, '          </div>\n          </div>\n          </div>\n\n          {/* Section:');

// Let's also do the one before </form> if it has only two
//             </div>
//           </div>
//           </div>
//                   </form>
// wait, my fix-divs4 added one to the end, making it 3?
code = code.replace(/          <\/div>\n          <\/div>\n          <\/div>\n                  <\/form>/g, '          </div>\n          </div>\n          </div>\n          </div>\n                  </form>');

// wait, let's just add one to all ends.
fs.writeFileSync('src/components/BAForm.tsx', code);
