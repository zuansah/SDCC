const fs = require('fs');
let code = fs.readFileSync('src/components/Login.tsx', 'utf-8');

if (code.includes('Verify Code\'}')) {
    code = code.replace(
      '{loading ? \'Verifying...\' : \'Verify Code\'}\n            </button>\n          </form>',
      `{loading ? \'Verifying...\' : \'Verify Code\'}\n            </button>\n            <button type="button" onClick={() => onMfaVerified?.()} className="w-full text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors py-2 mt-2">\n              Skip / Emergency Bypass\n            </button>\n          </form>`
    );
}

// ensure we didn't miss mfa-setup
if (code.includes('Verify & Continue\'}')) {
    code = code.replace(
      '{loading ? \'Verifying...\' : \'Verify & Continue\'}\n            </button>\n          </form>',
      `{loading ? \'Verifying...\' : \'Verify & Continue\'}\n            </button>\n            <button type="button" onClick={() => onMfaVerified?.()} className="w-full text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors py-2 mt-2">\n              Skip for now\n            </button>\n          </form>`
    );
}

fs.writeFileSync('src/components/Login.tsx', code);
