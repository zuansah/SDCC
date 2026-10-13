import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);

async function checkDb(dbId?: string) {
  console.log(`\nChecking database: ${dbId || '(default)'}`);
  const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  
  try {
    const q = collection(db, 'bas');
    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} documents in 'bas' collection.`);
  } catch (e: any) {
    console.error(`Error reading ${dbId || '(default)'}:`, e.message);
  }
}

async function run() {
  await checkDb();
  await checkDb(config.firestoreDatabaseId);
  process.exit(0);
}

run();
