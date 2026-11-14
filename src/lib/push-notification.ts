import * as admin from 'firebase-admin';

const FALLBACK_SA = {
  projectId: 'studio-239662212-1b7b6',
  clientEmail: 'firebase-adminsdk-fbsvc@studio-239662212-1b7b6.iam.gserviceaccount.com',
  privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9t+0gF94fhn72\nfEOo+9UzAQe8tuFi01IGM0Rj0GzQowsWgqTorPTCfvNmoBe3S4Urft4Y2uz73i8e\nIzaD0PXxP6+jEcAgPBxHAXYxjuRnBuy+oOzBRnkTlfPqGhajgRv/1mze45Y3ifFr\nN5dDQv5D0pLNwcr0dvsVlmgA75y95ispdmd0eNeEVvWE9W0Z2euODp6MuIO0BQ5G\n0OKLW8XpXFQOg4aNiBrt7qCz7jERSClKhxq2LsC/YM1Y1wC8iSLLqZJ0s9v2ZSlQ\nLkWHsxcc73/RSxyrex1zLNA4gQ00jGsSRMk3AS9SrRuxbhq8XNW3clxd4c2KHdZv\nOJpVIS4xAgMBAAECggEAMk+JsxaRQZP1rGDkwnXSIn318s4etAntORa0XrHhgWyT\nXqtTlx5yo/dtjbwLvgBpdtDkjfvUl7Bil1/oL4mlBw6IAbsN056NMylIkjjeChJU\nivL7BgAt0ItWDTFQ6pgs+CoBYhRBfEX4/yFVXDFyY0L+ylDHhQ/eYumpeAIS82qW\n+TBJ/UaATfz2koFTKfvI+v+S264LWO553wGoGucrjC7HhOGS7tUhwOPvCdKxdI/F\nTR4NidAv1gUcTIoS04SwrbkY/pGj0zBDP5nLalceH8B13WsLIHVl1QhoGz5nPil0\nkSBMfl8tDO4JeUVzR7haFSugtnoRwQgPj78kacxR1wKBgQDj2r2+avUzJZbW+Hkm\nrY4+K/AOjn4sd2DAj/B5Uu5x6bGXwAS+b1Z9hcuA/sXHQ55FxxEgrKlKS5E14MRY\nASmSUgjYra+ORvyqzDYp2fzNG3jKX1jBoFBOH53aaWWPXCc5KxiKYNjN/3VpLXTL\nZMtDsM/ZsNQ30o7dD8W2WpdkUwKBgQDVJz22uGsZyHiY0Mo7Ki5G1/Vk7RsPq+ox\nZW06aFjYxu311vH5GLh9I/EhnIS+gwfgIJSc4RlR+lVZn3hbZAYv69cVY1+uvH6X\nEopJ015q9WnPmZnooNpk/7n8Bdntthf0bvxCvq7YF2t7Z/N/iT5dEj0rdyqkyqxj\nd+81mTTS6wKBgF8U5KEVWQTi5rMGNOgi/HyNMTuh0p0To9g3OI4oQUBf2LAOfOxK\n4bi3oFhP+JBSczWDAG62Hl7Wcd4d0VE4CvT4LqDcuamRjdZoKSIFySx+DkXEy/Dg\nySIQp3qBCNRuDCAbD76O82ni9EfTpC1L/lZc7h9VXvl8cAlnj4WtAAfpAoGAX9yQ\nErcJ48SXCBMOgGFOAqppQISqIPguER0ObLA1FPkSV/fdRyvo/M7HSVh9ErkXN6Mv\ncwaBPq8Y53+iv2dSqQal6oaQp6M6Q3MhImafFfddKPJpl4eP8NBZspBnHFNCnrmz\nVckwFRsjSZLMndT5aR4kyIGFeit0MB/mQvKuIRUCgYEAg16ufZtZg+INFVDDJlc2\nhdEwiHAvLRTgfkGbXXvGeMkKCx2h9V2e0DYlxQcl1a+IW1G4BOGKQNp7R0us86rF\nWvO8c1KoyNMsLNu+cTb8w1eGhiKU0Ma6VEpCDe/vMfF4KfRfELL11FJpL6ASU3T4\nVTNWF0LLRYIg6uuXCfQnBBY=\n-----END PRIVATE KEY-----\n',
};

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    FALLBACK_SA.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || FALLBACK_SA.clientEmail;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || FALLBACK_SA.privateKey;

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
    try {
      return admin.initializeApp({ projectId });
    } catch {
      return null;
    }
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

    const app = getAdminApp();
    if (!app) return;

    const db = admin.firestore(app);
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    let fcmToken = userData?.fcmToken || userData?.deviceToken || userData?.pushToken;

    // إذا لم يكن في مستند المستخدم مباشرة، نفحص مجموعة user_devices
    if (!fcmToken) {
      const devDoc = await db
        .collection('users')
        .doc(userId)
        .collection('user_devices')
        .doc(userId)
        .get();
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
        },
      },
    });

    console.log(`[FCM] Push notification sent successfully to user ${userId}`);
  } catch (err: any) {
    console.warn(`[FCM] Failed to send push notification to user ${userId}:`, err?.message || err);
  }
}
