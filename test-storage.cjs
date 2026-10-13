const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadString } = require('firebase/storage');
const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const storage = getStorage(app);
const storageRef = ref(storage, 'test.txt');

uploadString(storageRef, 'Hello World').then(() => {
  console.log('Upload successful');
}).catch((error) => {
  console.error('Upload failed:', error);
});
