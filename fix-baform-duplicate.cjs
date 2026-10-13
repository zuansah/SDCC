const fs = require('fs');
let code = fs.readFileSync('src/components/BAForm.tsx', 'utf-8');

// Ensure firebase query imports
if (!code.includes('collection, query, where, getDocs')) {
  code = code.replace(
    "import { doc, getDoc } from 'firebase/firestore';",
    "import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';"
  );
}

// Add validation logic to handleSubmit
const targetCheck = `    const isNew = !initialData?.id;
    
    let submittedAt = new Date().toISOString();`;

const replacementCheck = `    const isNew = !initialData?.id;
    
    // DUPLICATE GUARDRAIL
    // Check if a BA with the same project name and site name already exists
    try {
      const q = query(
        collection(db, 'bas'),
        where('projectName', '==', formData.projectName),
        where('siteName', '==', formData.siteName)
      );
      const snapshot = await getDocs(q);
      
      // If there are matches, check if any of them is NOT the current BA we are editing
      if (!snapshot.empty) {
        const isDuplicate = snapshot.docs.some(d => {
          const data = d.data();
          const notCurrentDoc = d.id !== initialData?.id;
          const notRejected = data.status !== 'rejected';
          return notCurrentDoc && notRejected;
        });
        
        if (isDuplicate) {
          setErrorMsg(\`A document for "\${formData.projectName}" at "\${formData.siteName}" already exists. Please avoid creating duplicates.\`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    } catch (e) {
      console.error("Duplicate check failed:", e);
      // Proceed if check fails due to offline mode or permissions
    }
    
    let submittedAt = new Date().toISOString();`;

code = code.replace(targetCheck, replacementCheck);

fs.writeFileSync('src/components/BAForm.tsx', code);
