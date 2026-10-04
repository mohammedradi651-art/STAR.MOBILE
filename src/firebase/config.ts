'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';

/**
 * تهيئة فايربيس - تم التحديث لضمان إعادة البناء (Build Trigger)
 * النسخة الحالية: 1.7.0
 */
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-239662212-1b7b6";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId: projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "330089855562",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:330089855562:web:6565f4922129a0083163eb",
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;

export function getFirebaseInstances(): {
  app: FirebaseApp | undefined;
  auth: Auth | undefined;
  firestore: Firestore | undefined;
} {
  if (typeof window !== "undefined") {
    try {
      if (!app) {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      }
      if (app && !auth) {
        auth = getAuth(app);
      }
      if (app && !firestore) {
        try {
          firestore = initializeFirestore(app, {
            experimentalForceLongPolling: true,
          });
        } catch {
          firestore = getFirestore(app);
        }
      }
    } catch (error) {
      console.error("Firebase initialization failed:", error);
    }
  }
  return { app, auth, firestore };
}

if (typeof window !== "undefined") {
  getFirebaseInstances();
}

export { app, auth, firestore, firebaseConfig };
