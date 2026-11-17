'use server';

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

export async function resetPasswordAdmin(phoneNumber: string, newPassword: string) {
  try {
    const app = getAdminApp();
    if (!app) {
      return { success: false, error: 'تعذر الاتصال بخادم الحسابات.' };
    }

    const auth = admin.auth(app);
    const db = admin.firestore(app);

    const cleanPhone = phoneNumber.trim().replace(/\D/g, '').slice(-9);
    const email = `${cleanPhone}@shabakat.com`;

    let userRecord: admin.auth.UserRecord | null = null;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (_) {}

    if (!userRecord) {
      const userSnap = await db.collection('users')
        .where('phoneNumber', '==', cleanPhone)
        .limit(1)
        .get();

      if (!userSnap.empty) {
        try {
          userRecord = await auth.getUser(userSnap.docs[0].id);
        } catch (_) {}
      }
    }

    if (!userRecord) {
      return { success: false, error: 'عذراً، هذا الحساب غير موجود في سجلاتنا.' };
    }

    // تحديث كلمة المرور فعلياً في Firebase Authentication
    await auth.updateUser(userRecord.uid, {
      password: newPassword.trim(),
    });

    // تحديث وتصفير أي تعليق في أجهزة المستخدم
    try {
      await db.collection('users').doc(userRecord.uid).set({
        passwordLastReset: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const devDocRef = db.collection('users').doc(userRecord.uid).collection('user_devices').doc(userRecord.uid);
      const devSnap = await devDocRef.get();
      if (devSnap.exists) {
        const rawDevices = devSnap.data()?.devices;
        if (Array.isArray(rawDevices)) {
          const unblocked = rawDevices.map((d: any) => ({
            ...d,
            status: 'approved',
          }));
          await devDocRef.set({ devices: unblocked, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    } catch (_) {}

    console.log('✅ تم تحديث كلمة المرور فعلياً للمستخدم:', email);
    return { success: true, demo: false };
  } catch (error: any) {
    console.error('Reset Password Error Details:', error);
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء تحديث كلمة المرور.',
    };
  }
}
