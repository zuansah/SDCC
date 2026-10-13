const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// Replace "Foto Tampak Depan"
code = code.replace(/"Foto Tampak Depan"/g, '"Foto Depan Bangunan"');

// Fix Map
code = code.replace(
  /<div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">[\s\S]*?<span className="text-xs text-slate-500 mt-1">Tap to upload image<\/span>[\s\S]*?<\/div>[\s\S]*?{formData\.mapCoordinateImg \? \([\s\S]*?<img src={formData\.mapCoordinateImg} alt="Map" className="absolute inset-0 bottom-12 w-full h-\[calc\(100%-3rem\)\] object-cover z-10 pointer-events-none" \/>[\s\S]*?\) : formData\.mapCoordinateLink \? \([\s\S]*?<iframe[\s\S]*?className="absolute inset-0 bottom-12 w-full h-\[calc\(100%-3rem\)\] z-10 pointer-events-none"[\s\S]*?frameBorder="0"[\s\S]*?scrolling="no"[\s\S]*?marginHeight={0}[\s\S]*?marginWidth={0}[\s\S]*?src={\`https:\/\/maps\.google\.com\/maps\?q=\${formData\.mapCoordinateLink\.split\('q='\)[1]}&hl=en&z=15&output=embed\`}[\s\S]*?\/>[\s\S]*?\) : null}[\s\S]*?<input[\s\S]*?type="file"[\s\S]*?accept="image\/\*"[\s\S]*?capture="environment"[\s\S]*?onChange={\(e\) => handleImageUpload\(e, 'mapCoordinateImg'\)}[\s\S]*?className="absolute inset-0 bottom-12 w-full h-\[calc\(100%-3rem\)\] opacity-0 cursor-pointer z-20"[\s\S]*?\/>/g,
  `<div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">
                  <MapPin className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-600 text-center px-2">Map / Site Coordinate</span>
                  <span className="text-xs text-slate-500 mt-1">Tap button below to get location</span>
                </div>
                {formData.mapCoordinateLink ? (
                  <iframe 
                    className="absolute inset-0 bottom-12 w-full h-[calc(100%-3rem)] z-10 pointer-events-none"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={\`https://maps.google.com/maps?q=\${formData.mapCoordinateLink.split('q=')[1]}&hl=en&z=15&output=embed\`}
                  />
                ) : null}`
);

// Fix Headers
code = code.replace(
  /<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">\s*<h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">([^<]+)<\/h3>/g,
  '<div className="space-y-3">\n            <h3 className="text-lg font-semibold text-slate-800 ml-1">$1</h3>\n            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">'
);

// We added an extra div wrapper <div className="space-y-3">, so we need to add an extra </div> closing tag for each section.
// Sections end where the next {/* Section: ... */} begins, or before </form>.
const sections = [
  "General Info",
  "Site Location",
  "Equipment Details",
  "Core Diagrams",
  "Photo Attachments - Page 7",
  "Photo Attachments - Page 8",
  "Photo Attachments - Page 9"
];

let finalCode = code;
for (let i = 0; i < sections.length; i++) {
  const current = `{\\/* Section: ${sections[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} *\\/}`;
  let next = null;
  if (i < sections.length - 1) {
    next = `{\\/* Section: ${sections[i+1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} *\\/}`;
  } else {
    next = `</form>`;
  }
  
  const regex = new RegExp(`(${current}[\\s\\S]+?)(?=${next})`, 'g');
  finalCode = finalCode.replace(regex, (match, p1) => {
    // Add </div> before the end of the match.
    // The match ends with some whitespace.
    return p1.trimEnd() + '\n          </div>\n          ';
  });
}

fs.writeFileSync('src/components/BAForm.tsx', finalCode);
console.log('done');
