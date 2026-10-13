const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// The structure before the comment is:
//             </div>
//           </div>
// 
//           {/* Section:
code = code.replace(/          <\/div>\n\n          {\/\* Section:/g, '          </div>\n          </div>\n\n          {/* Section:');

// And the last one before </form>
//             </div>
//           </div>
//           
//         </form>
code = code.replace(/          <\/div>\n                  <\/form>/g, '          </div>\n          </div>\n                  </form>');

// Wait, let's verify what's at the end.
