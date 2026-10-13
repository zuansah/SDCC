const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldOnSave = `          onSave={async (data) => {
            try {
              if (!data.userId && user) {
                data.userId = user.uid;
              }
              const docRef = doc(db, 'bas', data.id);
              await setDoc(docRef, data);
              setSubmitted(true);
            } catch (e: any) {
              console.error("Failed to save to Firestore:", e);
              if (e.message && e.message.includes('payload is too large') || e.code === 'resource-exhausted') {
                throw new Error("Error: The images you uploaded are too large. Firestore has a 1MB limit per document. Please use smaller images.");
              } else {
                throw new Error("Failed to save document. " + e.message);
              }
            }
          }}`;

const newOnSave = `          onSave={async (data) => {
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
                if (base64) {
                  const imgDocRef = doc(db, 'bas', data.id, 'images', field);
                  await setDoc(imgDocRef, { data: base64 });
                }
              }
              
              setSubmitted(true);
            } catch (e: any) {
              console.error("Failed to save to Firestore:", e);
              throw new Error("Failed to save document. " + e.message);
            }
          }}`;

content = content.replace(oldOnSave, newOnSave);
fs.writeFileSync('src/App.tsx', content);
