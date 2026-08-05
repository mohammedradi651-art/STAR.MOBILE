import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview تهيئة مستقلة للسيرفر (API) مع دعم متغيرات البيئة.
 * يعتمد النظام كلياً على القيم المدخلة في Vercel لضمان أمان الربط.
 */

const serverConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function initializeServerFirebase() {
  let app;
  const apps = getApps();
  
  if (apps.length > 0) {
    app = apps[0];
  } else {
    // التحقق من وجود مفتاح الـ API قبل التهيئة
    if (!serverConfig.apiKey) {
      console.warn("⚠️ Firebase Server Config is missing! Using hardcoded fallback.");
      // Fallback للقيم الافتراضية في حال نسيان الإعدادات
      app = initializeApp({
        apiKey: "AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg",
        authDomain: "studio-239662212-1b7b6.firebaseapp.com",
        projectId: "studio-239662212-1b7b6",
        storageBucket: "studio-239662212-1b7b6.firebasestorage.app",
        messagingSenderId: "330089855562",
        appId: "1:330089855562:web:6565f4922129a0083163eb"
      });
    } else {
      app = initializeApp(serverConfig);
    }
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}
