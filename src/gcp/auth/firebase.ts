import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";
import { getAnalytics, type Analytics, isSupported } from "firebase/analytics";

// Your provided Firebase config (safe to use client-side)
const firebaseConfig = {
  apiKey: "AIzaSyA7tEo14-2bbfVqAHicLTAPjsJxdtaRG6I",
  authDomain: "christmaspolls.firebaseapp.com",
  projectId: "christmaspolls",
  storageBucket: "christmaspolls.firebasestorage.app",
  messagingSenderId: "957485505569",
  appId: "1:957485505569:web:31cc67da7504a8a2d99760",
  measurementId: "G-QLVHH9NWCF",
};

// `npm run dev:emulator` switches every service to the local emulators and a
// demo- project ID, which cannot reach production.
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

// Initialize Firebase app (singleton)
const FirebaseInstance: FirebaseApp = initializeApp(
  useEmulators ? { ...firebaseConfig, projectId: "demo-christmas" } : firebaseConfig
);

// Export initialized services
export const auth: Auth = getAuth(FirebaseInstance);
export const db: Firestore = getFirestore(FirebaseInstance);
export const functions: Functions = getFunctions(
  FirebaseInstance,
  "europe-west1"
);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

// Only initialize Analytics if supported (e.g., in browser)
export let analytics: Analytics | null = null;
isSupported().then((supported) => {
  if (supported && !useEmulators) analytics = getAnalytics(FirebaseInstance);
});

export default FirebaseInstance;
