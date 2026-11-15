'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app } from './config';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

/**
 * طلب إذن الإشعارات السحابية في المتصفح وحفظ الـ Token للمستخدم
 */
export async function requestWebNotificationPermission(firestore: any, userId?: string | null): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: 'المتصفح لا يدعم الإشعارات' };
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      return { success: false, error: 'خدمة إشعارات المتصفح غير مدعومة في هذا الجهاز' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'لم يتم منح إذن الإشعارات' };
    }

    // تسجيل Service Worker
    let reg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: reg,
    });

    if (currentToken && userId && firestore) {
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, {
        fcmToken: currentToken,
        fcmTokens: arrayUnion(currentToken),
        fcmTokenUpdatedAt: new Date(),
      }).catch((e) => console.warn('Could not update user fcmToken:', e));
    }

    return { success: true, token: currentToken };
  } catch (err: any) {
    console.error('Error in requestWebNotificationPermission:', err);
    return { success: false, error: err?.message || 'حدث خطأ أثناء تفعيل الإشعارات' };
  }
}
