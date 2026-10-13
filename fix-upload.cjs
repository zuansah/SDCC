const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// 1. Update renderImageUploadGroup
const target1 = `  const renderImageUploadGroup = (label: string, name: keyof BAData) => (
    <div key={name} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden group">
      {formData[name] ? (
        <div className="absolute inset-0">
          <img src={formData[name] as string} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-medium">Click to change</span>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <span className="text-sm text-slate-500 block">Upload {label}</span>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleImageUpload(e, name)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );`;

const replacement1 = `  const renderImageUploadGroup = (label: string, name: keyof BAData) => (
    <div key={name} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="h-40 border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden group">
        {formData[name] ? (
          <div className="absolute inset-0">
            <img src={formData[name] as string} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">Click to change</span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <span className="text-xs text-slate-500 block">Tap to upload</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleImageUpload(e, name)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );`;

code = code.replace(target1, replacement1);

// 2. Remove gap-4 h-48 from the grids
code = code.replace(/className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-48"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-6"');

// 3. Fix Map Coordinate
const targetMap = `<div className="border-2 border-dashed border-slate-300 rounded-lg flex flex-col relative overflow-hidden bg-slate-50 group">
                <div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">
                  <MapPin className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-600 text-center px-2">Map / Site Coordinate</span>
                  <span className="text-xs text-slate-500 mt-1">Tap button below to get location</span>
                </div>`;

const replaceMap = `<div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Map / Site Coordinate</span>
                <div className="h-40 border-2 border-dashed border-slate-300 rounded-lg flex flex-col relative overflow-hidden bg-slate-50 group">
                <div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">
                  <MapPin className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 mt-1">Tap button below to get location</span>
                </div>`;

code = code.replace(targetMap, replaceMap);

// add closing div for the map wrapper after the Use My Location block
const targetMapEnd = `                      Use My Location
                    </button>
                  )}
                </div>
              </div>`;

const replaceMapEnd = `                      Use My Location
                    </button>
                  )}
                </div>
              </div>
              </div>`;
code = code.replace(targetMapEnd, replaceMapEnd);

fs.writeFileSync('src/components/BAForm.tsx', code);
