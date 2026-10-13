const fs = require('fs');
let code = fs.readFileSync('src/components/TicketView.tsx', 'utf8');

// Add a retry mechanism or clear the error state
code = code.replace(
  /const \[ticketsLoading, setTicketsLoading\] = useState\(true\);/,
  "const [ticketsLoading, setTicketsLoading] = useState(true);\n  const [ticketsError, setTicketsError] = useState<string | null>(null);"
);

code = code.replace(
  /console.error\("Failed to fetch tickets:", err\);\n      setTicketsLoading\(false\);/g,
  "console.error(\"Failed to fetch tickets:\", err);\n      setTicketsError(err.message);\n      setTicketsLoading(false);"
);

// Add a retry button or display error
code = code.replace(
  /ticketsLoading \? \(\s*<div className="flex justify-center p-8">\s*<Loader2 className="w-6 h-6 animate-spin text-blue-500" \/>\s*<\/div>\s*\) : assuranceTickets\.length === 0 \?/,
  `ticketsLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : ticketsError ? (
              <div className="bg-red-50 rounded-xl border border-red-200 p-8 text-center text-red-600">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" />
                <p className="font-medium">Failed to load tickets</p>
                <p className="text-sm mt-1">{ticketsError}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50">Retry</button>
              </div>
            ) : assuranceTickets.length === 0 ?`
);

fs.writeFileSync('src/components/TicketView.tsx', code);
