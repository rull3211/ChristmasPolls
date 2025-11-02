import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
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

// Initialize Firebase app (singleton)
const FirebaseInstance: FirebaseApp = initializeApp(firebaseConfig);

// Export initialized services
export const auth: Auth = getAuth(FirebaseInstance);
export const db: Firestore = getFirestore(FirebaseInstance);

// Only initialize Analytics if supported (e.g., in browser)
export let analytics: Analytics | null = null;
isSupported().then((supported) => {
  if (supported) analytics = getAnalytics(FirebaseInstance);
});

export default FirebaseInstance;
