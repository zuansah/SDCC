const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

if (!code.includes('handleDeleteManyBAs')) {
  const targetDelete = `  const handleDeleteBA = async (id: string) => {`;
  
  const insertDeleteMany = `  const handleDeleteManyBAs = async (ids: string[]) => {
    try {
      // Need to delete docs sequentially or in batches
      for (const id of ids) {
        await deleteDoc(doc(db, 'bas', id));
      }
      if (activeBA && ids.includes(activeBA.id)) {
        setActiveBA(null);
        setView('projects');
      }
      // Re-fetch after batch delete
      fetchBas();
    } catch (e: any) {
      console.error("Failed to delete multiple from Firestore:", e);
      alert("Failed to delete some documents. " + e.message);
    }
  };

  const handleDeleteBA = async (id: string) => {`;
  
  code = code.replace(targetDelete, insertDeleteMany);
  
  code = code.replace(
    'onDelete={handleDeleteBA}',
    'onDelete={handleDeleteBA}\n            onDeleteMany={handleDeleteManyBAs}'
  );

  fs.writeFileSync('src/App.tsx', code);
}
