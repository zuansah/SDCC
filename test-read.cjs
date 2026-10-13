const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    const q = query(collection(db, 'bas'), limit(1));
    const snap = await getDocs(q);
    console.log(`Successfully read ${snap.size} documents from old DB.`);
    process.exit(0);
  } catch (e) {
    console.error("Read failed:", e.message);
    process.exit(1);
  }
}
test();
