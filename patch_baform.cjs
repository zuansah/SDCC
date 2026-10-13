const fs = require('fs');

let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// 1. Import fileToBase64WithGeotag
if (!code.includes('fileToBase64WithGeotag')) {
  code = code.replace(
    'import { generateId, fileToBase64 } from',
    'import { generateId, fileToBase64, fileToBase64WithGeotag, formatDate } from'
  );
}

// 2. Add loading state for geolocation if not there
if (!code.includes('const [geoLoading, setGeoLoading]')) {
  code = code.replace(
    'const [scanning, setScanning] = useState(false);',
    'const [scanning, setScanning] = useState(false);\n  const [geoLoading, setGeoLoading] = useState(false);'
  );
}

// 3. Update handleImageUpload
const handleImageUploadOld = `  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof BAData) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setFormData((prev) => ({ ...prev, [fieldName]: base64 }));
      } catch (err) {
        console.error("Error converting image", err);
        alert("Failed to read image file.");
      }
    }
  };`;
  
const handleImageUploadNew = `  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof BAData) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setGeoLoading(true);
        // Get Geo Location
        let geoText = "";
        let timeText = formatDate(new Date().toISOString());
        
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0 });
          });
          geoText = \`Lat: \${position.coords.latitude.toFixed(6)}, Lon: \${position.coords.longitude.toFixed(6)}\`;
        } catch (geoErr) {
          console.warn("Geolocation failed or denied", geoErr);
          geoText = "Location: Unavailable";
        }
        
        // Convert to base64 with Watermark (Geotag)
        const base64 = await fileToBase64WithGeotag(file, geoText, timeText);
        setFormData((prev) => ({ ...prev, [fieldName]: base64 }));
      } catch (err) {
        console.error("Error converting image", err);
        alert("Failed to read image file.");
      } finally {
        setGeoLoading(false);
      }
    }
  };`;

if (code.includes(handleImageUploadOld)) {
  code = code.replace(handleImageUploadOld, handleImageUploadNew);
} else {
  // Try regex replace if it's slightly different
  const start = code.indexOf('const handleImageUpload = async');
  const end = code.indexOf('};', start) + 2;
  const chunk = code.substring(start, end);
  if (chunk.includes('fileToBase64')) {
    code = code.replace(chunk, handleImageUploadNew);
  }
}

// 4. Update renderImageUploadGroup to accept allowGallery
const oldRenderImg = `const renderImageUploadGroup = (label: string, name: keyof BAData) => (`;
const newRenderImg = `const renderImageUploadGroup = (label: string, name: keyof BAData, allowGallery = false) => (`;
if (code.includes(oldRenderImg)) {
  code = code.replace(oldRenderImg, newRenderImg);
}

// 5. Conditionally remove capture attribute
const oldInput = `<input
          type="file"
          accept="image/*"
          capture="environment"`;
const newInput = `<input
          type="file"
          accept="image/*"
          {...(!allowGallery ? { capture: "environment" } : {})}`;
if (code.includes(oldInput)) {
  code = code.replace(oldInput, newInput);
} else {
    code = code.replace(/<input\s+type="file"\s+accept="image\/\*"\s+capture="environment"/, '<input type="file" accept="image/*" {...(!allowGallery ? { capture: "environment" } : {})}');
}

// 6. Update instances of renderImageUploadGroup
code = code.replace(
  '{renderImageUploadGroup(\'Foto Rack (Before)\', \'rackBeforeImg\')}',
  '{renderImageUploadGroup(\'Foto Rack (Before)\', \'rackBeforeImg\', true)}'
);

// 7. Insert the two new boxes on Page 8 or 9. I will append them to Page 8 (Photo Attachments).
if (!code.includes('modemMainImg')) {
  // Let's find snOntImg and insert after it
  const snOntGroup = "{renderImageUploadGroup('SN ONT', 'snOntImg')}";
  code = code.replace(
    snOntGroup,
    snOntGroup + `
                {renderImageUploadGroup('Foto Modem Main', 'modemMainImg')}
                {renderImageUploadGroup('Foto Modem Back Up', 'modemBackupImg')}`
  );
}

// Also add a loading overlay when geotagging
if (!code.includes('Geo-tagging')) {
  const loadingOverlay = `
      {geoLoading && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-800 font-medium">Processing Image & Geo-tagging...</p>
            <p className="text-slate-500 text-sm mt-1">Please allow location access if prompted</p>
          </div>
        </div>
      )}`;
  
  // insert before return ( <div className="flex flex-col h-full">... )
  code = code.replace('<div className="flex flex-col h-full">', '<div className="flex flex-col h-full">' + loadingOverlay);
}

fs.writeFileSync('src/components/BAForm.tsx', code);
