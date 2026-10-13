const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  /{view === 'ticket' && \(\s*<div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">\s*<h2 className="text-2xl font-bold text-slate-800 mb-2">Ticket<\/h2>\s*<p>This module is under construction\.<\/p>\s*<\/div>\s*\)}/g,
  "{view === 'ticket' && (\n          <TicketView />\n        )}"
);
fs.writeFileSync('src/App.tsx', code);
