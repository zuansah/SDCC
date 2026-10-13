const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

appCode = appCode.replace(
  `const handleStatusChange = async (id: string, newStatus: 'accepted' | 'rejected') => {
    const existing = bas.find(b => b.id === id);
    if (existing) {
      try {
        const approverName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Admin';
        const updates: any = { status: newStatus };
        if (newStatus === 'accepted') {
          updates.acceptedBy = approverName;
        }
        await setDoc(doc(db, 'bas', id), { ...existing, ...updates });`,
  `const handleStatusChange = async (id: string, newStatus: 'accepted' | 'rejected', rejectNote?: string) => {
    const existing = bas.find(b => b.id === id);
    if (existing) {
      try {
        const approverName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Admin';
        const updates: any = { status: newStatus };
        if (newStatus === 'accepted') {
          updates.acceptedBy = approverName;
        } else if (newStatus === 'rejected' && rejectNote) {
          updates.rejectNote = rejectNote;
        }
        await setDoc(doc(db, 'bas', id), { ...existing, ...updates });`
);
fs.writeFileSync('src/App.tsx', appCode);

let typesCode = fs.readFileSync('src/types.ts', 'utf-8');
typesCode = typesCode.replace(
  `  acceptedBy?: string;`,
  `  acceptedBy?: string;
  rejectNote?: string;`
);
fs.writeFileSync('src/types.ts', typesCode);
