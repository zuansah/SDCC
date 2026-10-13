import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

export const firebaseConfig = config;

const app = initializeApp(config);
export const auth = getAuth(app);
import { getFirestore } from 'firebase/firestore';
export const db = getFirestore(app, config.firestoreDatabaseId);
export const storage = getStorage(app);
storage.maxOperationRetryTime = 8000;
export const googleProvider = new GoogleAuthProvider();
