import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * تهيئة مستقلة تماماً للسيرفر (API).
 * نستخدم قيم ثابتة هنا لضمان عمل الربط الخارجي في Vercel دون التأثير على التطبيق.
 */
const serverConfig = {
  apiKey: "AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg",
  authDomain: "studio-239662212-1b7b6.firebaseapp.com",
  projectId: "studio-239662212-1b7b6",
  storageBucket: "studio-239662212-1b7b6.firebasestorage.app",
  messagingSenderId: "330089855562",
  appId: "1:330089855562:web:6565f4922129a0083163eb",
};

export function initializeServerFirebase() {
  let app;
  const apps = getApps();
  
  // إذا كان التطبيق مهيأ مسبقاً نستخدمه، وإلا نقوم بتهيئته بالقيم الثابتة
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
