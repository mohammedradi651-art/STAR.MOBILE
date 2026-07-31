'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';

const projectId = "studio-239662212-1b7b6";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: `${projectId}.firebaseapp.com`,
  projectId: projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;

if (typeof window !== "undefined") {
    try {
        // التأكد من وجود apiKey قبل التهيئة لمنع الانهيار في الاستضافة
        if (firebaseConfig.apiKey) {
            if (getApps().length) {
                app = getApp();
            } else {
                app = initializeApp(firebaseConfig);
            }

            if (app) {
                auth = getAuth(app);
                firestore = initializeFirestore(app, {
                    experimentalForceLongPolling: true,
                });
            }
        }
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
}

export { app, auth, firestore, firebaseConfig };
