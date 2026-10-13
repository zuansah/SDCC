const fs = require('fs');
let code = fs.readFileSync('src/components/BAPreview.tsx', 'utf-8');

if (!code.includes('modemMainImg')) {
  const target = `{ba.snOntImg && <img src={ba.snOntImg} alt="SN ONT" className="w-full h-auto rounded-md shadow-sm border border-slate-200" />}`;
  
  const replacement = `{ba.snOntImg && <img src={ba.snOntImg} alt="SN ONT" className="w-full h-auto rounded-md shadow-sm border border-slate-200" />}
            {ba.modemMainImg && <img src={ba.modemMainImg} alt="Foto Modem Main" className="w-full h-auto rounded-md shadow-sm border border-slate-200" />}
            {ba.modemBackupImg && <img src={ba.modemBackupImg} alt="Foto Modem Back Up" className="w-full h-auto rounded-md shadow-sm border border-slate-200" />}`;
            
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/BAPreview.tsx', code);
}
