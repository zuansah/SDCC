import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const storage = getStorage(app);

async function run() {
  const url = await getDownloadURL(ref(storage, 'live.json'));
  const res = await fetch(url);
  const data = await res.json();
  const ownerships = new Set();
  const platforms = new Set();
  const kinds = new Set();
  data.controllers.forEach(c => {
    if(c.ownership) ownerships.add(c.ownership);
    if(c.platform) platforms.add(c.platform);
    if(c.kind) kinds.add(c.kind);
  });
  console.log("Ownerships:", [...ownerships]);
  console.log("Platforms:", [...platforms]);
  console.log("Kinds:", [...kinds]);
  process.exit(0);
}
run();
