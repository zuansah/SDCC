const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc } = require('firebase/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
// Connect to both databases
const defaultDb = getFirestore(app);
const oldDb = getFirestore(app, config.firestoreDatabaseId);

async function migrate() {
  console.log("Starting migration from old named DB to default DB...");
  try {
    const basSnapshot = await getDocs(collection(oldDb, 'bas'));
    console.log(`Found ${basSnapshot.size} BAs in the old database.`);
    
    let count = 0;
    for (const document of basSnapshot.docs) {
      await setDoc(doc(defaultDb, 'bas', document.id), document.data());
      count++;
      if (count % 10 === 0) console.log(`Migrated ${count} BAs...`);
    }
    
    const usersSnapshot = await getDocs(collection(oldDb, 'users'));
    console.log(`Found ${usersSnapshot.size} Users in the old database.`);
    for (const document of usersSnapshot.docs) {
      await setDoc(doc(defaultDb, 'users', document.id), document.data());
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e.message);
    process.exit(1);
  }
}

migrate();
