import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function MappingUpload() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Constrain file extension: accept only .xlsx, .xls, .csv
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => lowerName.endsWith(ext));
    if (!hasValidExt) {
      setError('Invalid file type. Please upload a valid .xlsx, .xls, or .csv spreadsheet file.');
      return;
    }

    // Cap file size to 10MB
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setError('File size exceeds the 10MB limit.');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assuming data is in the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        if (json.length === 0) {
          throw new Error("Excel file is empty");
        }

        // Known allowed fields for BA mappings
        const ALLOWED_FIELDS = [
          'projectName', 'siteName', 'siteId', 'siteCode', 'witel', 'regional',
          'address', 'hostname', 'serialNumber', 'serial', 'ipAddress', 'vendor',
          'deviceType', 'tenant', 'pengadaan', 'orderNumber', 'sid', 'customer',
          'campaign', 'location', 'kota'
        ];

        let batch = writeBatch(db);
        let count = 0;
        let totalCount = 0;
        
        for (const rawRow of json as any[]) {
          if (!rawRow || typeof rawRow !== 'object') continue;

          const traceId = rawRow['trace_id'] || rawRow['Trace ID'] || rawRow['TraceID'] || rawRow['id'];
          if (!traceId) continue; // Skip rows without trace ID

          // Read only expected columns by name; do not spread untrusted row wholesale
          const sanitizedRow: Record<string, string | number> = {
            trace_id: String(traceId).trim()
          };

          for (const field of ALLOWED_FIELDS) {
            const val = rawRow[field] ?? rawRow[field.toLowerCase()];
            if (val !== undefined && val !== null && typeof val !== 'object' && typeof val !== 'function') {
              sanitizedRow[field] = typeof val === 'string' ? val.trim() : val;
            }
          }

          const docRef = doc(collection(db, 'traceMappings'), String(traceId).trim());
          batch.set(docRef, sanitizedRow, { merge: true });
          
          count++;
          totalCount++;

          if (count === 400) { // Firestore batch limit is 500
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        
        if (count > 0) {
          await batch.commit();
        }

        setMessage(`Successfully mapped ${totalCount} records.`);
      } catch (err: any) {
        console.error(err);
        setError("Error processing Excel file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-8">
      <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> 
        Upload Trace ID Mapping (Excel)
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        Upload an Excel (.xlsx or .csv) file to update the database for Trace ID mapping.
        The file should contain a <strong>trace_id</strong> column. Other columns will automatically populate the BA fields.
      </p>

      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 relative hover:bg-slate-100 transition-colors cursor-pointer">
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={loading}
        />
        {loading ? (
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
        ) : (
          <UploadCloud className="w-10 h-10 text-emerald-500 mb-3" />
        )}
        <span className="text-sm font-medium text-slate-700">
          {loading ? 'Processing...' : 'Click or drag Excel file here'}
        </span>
      </div>

      {message && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          {message}
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
