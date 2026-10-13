const fs = require('fs');
let code = fs.readFileSync('src/components/BAPreview.tsx', 'utf-8');

// Update Remark
code = code.replace(
  `<p className="text-[10px] text-slate-600 mt-auto">Remark :</p>`,
  `<div className="text-[10px] text-slate-600 mt-auto">Remark : {ba.status === 'rejected' && ba.rejectNote ? <span className="text-red-600 font-medium">{ba.rejectNote}</span> : null}</div>`
);

// Add Alert Banner above pages (in screen view)
const targetHeader = `<div className="w-full flex justify-between items-center bg-white p-4 shadow-sm border-b border-slate-200 print:hidden">`;
const replacementHeader = `<div className="w-full flex justify-between items-center bg-white p-4 shadow-sm border-b border-slate-200 print:hidden">`;

// Actually let's put it right after the header block
code = code.replace(
  `        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-slate-100 p-8 flex flex-col items-center">`,
  `        </div>
      </div>
      
      {ba.status === 'rejected' && ba.rejectNote && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-8 w-full max-w-[297mm] mx-auto print:hidden shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong className="font-medium">Document Rejected:</strong> {ba.rejectNote}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-100 p-8 flex flex-col items-center pt-0 mt-8">`
);

// Import AlertTriangle if missing
if (!code.includes('AlertTriangle')) {
  code = code.replace(
    `import { ArrowLeft, Printer, Edit2, MapPin } from 'lucide-react';`,
    `import { ArrowLeft, Printer, Edit2, MapPin, AlertTriangle } from 'lucide-react';`
  );
}

fs.writeFileSync('src/components/BAPreview.tsx', code);
