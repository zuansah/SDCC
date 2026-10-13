const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');
const target = `<div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">
                  <MapPin className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-600 text-center px-2">Map / Site Coordinate</span>
                  <span className="text-xs text-slate-500 mt-1">Tap to upload image</span>
                </div>
                {formData.mapCoordinateImg ? (
                  <img src={formData.mapCoordinateImg} alt="Map" className="absolute inset-0 bottom-12 w-full h-[calc(100%-3rem)] object-cover z-10 pointer-events-none" />
                ) : formData.mapCoordinateLink ? (
                  <iframe 
                    className="absolute inset-0 bottom-12 w-full h-[calc(100%-3rem)] z-10 pointer-events-none"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={\`https://maps.google.com/maps?q=\${formData.mapCoordinateLink.split('q=')[1]}&hl=en&z=15&output=embed\`}
                  />
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleImageUpload(e, 'mapCoordinateImg')}
                  className="absolute inset-0 bottom-12 w-full h-[calc(100%-3rem)] opacity-0 cursor-pointer z-20"
                />`;

const replacement = `<div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">
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
                ) : null}`;

code = code.replace(target, replacement);

const t2 = `className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-md hover:bg-blue-200 transition-colors"
                    >
                      Share Location Link
                    </button>`;

const r2 = `className="text-xs font-semibold text-blue-600 hover:text-blue-700 w-full h-full text-center flex items-center justify-center"
                    >
                      Use My Location
                    </button>`;
code = code.replace(t2, r2);

// Fix trailing divs that got swallowed if the regex was weird? Let's make sure it closes.
fs.writeFileSync('src/components/BAForm.tsx', code);
