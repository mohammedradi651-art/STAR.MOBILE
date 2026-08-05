import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview تهيئة مستقلة للسيرفر (API) مع دعم متغيرات البيئة.
 * يقوم النظام أولاً بالبحث عن المفاتيح في إعدادات فيرسل (Environment Variables).
 */

const serverConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-239662212-1b7b6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-239662212-1b7b6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-239662212-1b7b6.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "330089855562",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:330089855562:web:6565f4922129a0083163eb",
};

export function initializeServerFirebase() {
  let app;
  const apps = getApps();
  
  if (apps.length > 0) {
    app = apps[0];
  } else {
    app = initializeApp(serverConfig);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}
