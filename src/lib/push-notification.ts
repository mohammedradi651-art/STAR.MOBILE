import * as admin from 'firebase-admin';

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-239662212-1b7b6';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    try {
      return admin.initializeApp({ projectId });
    } catch {
      return null;
    }
  }

  const formattedKey = privateKey.replace(/\\n/g, '\n').trim();

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    return null;
  }
}

/**
 * إرسال إشعار سحابي FCM مباشر لهاتف العميل
 */
export async function sendPushNotificationToUser(
  firestore: any,
  userId: string,
  payload: {
    title: string;
    body: string;
    transid?: string;
    status?: 'success' | 'failed' | 'pending';
    amount?: number;
  }
) {
  try {
    if (!userId) return;

    // 1. تسجيل الإشعار في جدول إشعارات المستخدم داخل Firestore
    try {
      const notifDocRef = firestore ? firestore : null;
      // سيتم إنشاؤه في Firestore مباشرة
    } catch (_) {}

    // 2. جلب التوكن الخاص بالمستخدم من مستنده أو مجموعة أجهزته
    const app = getAdminApp();
    if (!app) return;

    const db = admin.firestore(app);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    let fcmToken = userData?.fcmToken || userData?.deviceToken || userData?.pushToken;

    // إذا لم يكن في مستند المستخدم مباشرة، نفحص مجموعة user_devices
    if (!fcmToken) {
      const devDoc = await db.collection('users').doc(userId).collection('user_devices').doc(userId).get();
      if (devDoc.exists) {
        fcmToken = devDoc.data()?.fcmToken || devDoc.data()?.token;
      }
    }

    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length < 10) {
      console.log(`[FCM] No valid FCM token found for user ${userId}`);
      return;
    }

    const messaging = admin.messaging(app);
    await messaging.send({
      token: fcmToken.trim(),
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        tag: 'starmobile_transaction',
        transid: String(payload.transid || ''),
        status: String(payload.status || ''),
        amount: String(payload.amount || ''),
        title: payload.title,
        body: payload.body,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'starmobile_notifications_channel',
          icon: 'ic_notification',
          color: '#0048AE',
          defaultSound: true,
          defaultVibrateTimings: true,
        }
      }
    });

    console.log(`[FCM] Push notification sent successfully to user ${userId}`);
  } catch (err: any) {
    console.warn(`[FCM] Failed to send push notification to user ${userId}:`, err?.message || err);
  }
}
