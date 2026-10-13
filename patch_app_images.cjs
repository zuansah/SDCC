const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure getDocs, collection are imported from firestore
if (!content.includes('getDocs')) {
  content = content.replace("from 'firebase/firestore';", ", getDocs } from 'firebase/firestore';");
}

const imageFieldsConst = `
const IMAGE_FIELDS = [
  'networkTopologyImg',
  'mapCoordinateImg',
  'equipmentPlacementImg',
  'floorLayoutImg',
  'frontViewImg',
  'withPicImg',
  'rackBeforeImg',
  'rackAfterImg',
  'snSdwanImg',
  'snOntImg',
  'speedtestGlobalImg',
  'speedtestDomestikImg',
  'cablingSdwanImg',
  'sdwanBoxImg',
  'pingTracerouteImg',
  'pingAstinetImg'
];
`;

// Insert the const before App
content = content.replace('export default function App() {', imageFieldsConst + '\nexport default function App() {');

// Update handleSaveBA
const handleSaveOld = `  const handleSaveBA = async (data: BAData) => {
    try {
      // Set user id automatically
      if (!data.userId && user) {
        data.userId = user.uid;
      }
      
      const docRef = doc(db, 'bas', data.id);
      await setDoc(docRef, data);
      
      setActiveBA(data);
      setView('preview-ba');
    } catch (e: any) {
      console.error("Failed to save to Firestore:", e);
      if (e.message && e.message.includes('payload is too large') || e.code === 'resource-exhausted') {
        throw new Error("Error: The images you uploaded are too large. Firestore has a 1MB limit per document. Please use smaller images.");
      } else {
        throw new Error("Failed to save document. " + e.message);
      }
    }
  };`;

const handleSaveNew = `  const handleSaveBA = async (data: BAData) => {
    try {
      if (!data.userId && user) {
        data.userId = user.uid;
      }
      
      // Separate main data and images
      const mainData = { ...data };
      const imagesToSave: Record<string, string> = {};
      
      IMAGE_FIELDS.forEach(field => {
        if (mainData[field as keyof BAData]) {
          imagesToSave[field] = mainData[field as keyof BAData] as string;
          delete mainData[field as keyof BAData];
        }
      });
      
      // Save main document (without images)
      const docRef = doc(db, 'bas', data.id);
      await setDoc(docRef, mainData);
      
      // Save each image in a subcollection document to bypass 1MB limit
      for (const [field, base64] of Object.entries(imagesToSave)) {
        // Only save if it's a data URL or real string
        if (base64) {
          const imgDocRef = doc(db, 'bas', data.id, 'images', field);
          await setDoc(imgDocRef, { data: base64 });
        }
      }
      
      setActiveBA(data); // Provide full data (with images) to preview
      setView('preview-ba');
    } catch (e: any) {
      console.error("Failed to save to Firestore:", e);
      throw new Error("Failed to save document. " + e.message);
    }
  };`;
content = content.replace(handleSaveOld, handleSaveNew);

// Add fetchImages helper
const fetchImagesHelper = `
  const fetchImagesForBA = async (ba: BAData) => {
    try {
      const imagesRef = collection(db, 'bas', ba.id, 'images');
      const snapshot = await getDocs(imagesRef);
      const images: any = {};
      snapshot.forEach(doc => {
        images[doc.id] = doc.data().data;
      });
      return { ...ba, ...images };
    } catch (e) {
      console.error("Failed to fetch images", e);
      return ba;
    }
  };
`;
// Insert inside App
content = content.replace('  const handleEdit = (ba: BAData) => {', fetchImagesHelper + '\n  const handleEdit = async (ba: BAData) => {');

// Update handleEdit and handlePreview
content = content.replace(
`  const handleEdit = async (ba: BAData) => {
    setActiveBA(ba);
    setView('edit-ba');
  };`,
`  const handleEdit = async (ba: BAData) => {
    const fullBa = await fetchImagesForBA(ba);
    setActiveBA(fullBa);
    setView('edit-ba');
  };`
);

content = content.replace(
`  const handlePreview = (ba: BAData) => {
    setActiveBA(ba);
    setView('preview-ba');
  };`,
`  const handlePreview = async (ba: BAData) => {
    const fullBa = await fetchImagesForBA(ba);
    setActiveBA(fullBa);
    setView('preview-ba');
  };`
);

fs.writeFileSync('src/App.tsx', content);
