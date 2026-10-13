const fs = require('fs');
let code = fs.readFileSync('src/components/Login.tsx', 'utf-8');

code = code.replace(
  '{loading ? \'Processing...\' : \'Sign In\'}\n            </button>\n            <button type="button" onClick={() => onMfaVerified?.()} className="w-full text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors py-2 mt-2">\n              Skip for now\n            </button>\n          </form>',
  '{loading ? \'Processing...\' : \'Sign In\'}\n            </button>\n          </form>'
);

fs.writeFileSync('src/components/Login.tsx', code);
