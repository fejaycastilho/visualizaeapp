import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD8gkLNdrcn1BsGyXMGKNVhVxStrEQ_2gc",
  authDomain: "visualizae-app-2026.web.app",
  projectId: "visualizae-app-2026",
  storageBucket: "visualizae-app-2026.firebasestorage.app",
  messagingSenderId: "239635609454",
  appId: "1:239635609454:web:0393631e04efa91e00f37f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
