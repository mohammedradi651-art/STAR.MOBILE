'use server';

import * as admin from 'firebase-admin';

/**
 * @fileOverview محرك استعادة كلمة المرور المطور (Server Action).
 * يقوم بتغيير كلمة المرور فعلياً باستخدام Firebase Admin SDK.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];
  
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey || !projectId) {
    console.warn("⚠️ تنبيه: مفاتيح Firebase Admin ناقصة في إعدادات البيئة.");
    return null;
  }

  // معالجة مكثفة للمفتاح الخاص لحل مشكلة Vercel (RS256 error)
  // 1. استبدال علامات الـ \n النصية بأسطر حقيقية
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // 2. إزالة أي علامات تنصيص زائدة في البداية والنهاية قد تضاف من السيرفر
  privateKey = privateKey.trim().replace(/^["']|["']$/g, '');

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
  } catch (error) {
    console.error("❌ فشل تهيئة Firebase Admin:", error);
    return null;
  }
}

export async function resetPasswordAdmin(phoneNumber: string, newPassword: string) {
  try {
    const app = getAdminApp();
    const email = `${phoneNumber.trim()}@shabakat.com`;
    
    if (!app) {
      return { 
        success: false, 
        error: 'النظام يعمل في وضع المعاينة. تأكد من ضبط متغيرات البيئة في فيرسل بشكل صحيح.' 
      };
    }

    const auth = admin.auth(app);

    // البحث عن المستخدم باستخدام البريد الإلكتروني (رقم الهاتف المعدل)
    const userRecord = await auth.getUserByEmail(email);
    
    if (!userRecord) {
      return { success: false, error: 'عذراً، هذا الحساب غير موجود في سجلاتنا.' };
    }

    // تنفيذ التحديث الفعلي لكلمة المرور في Firebase Auth
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    console.log("✅ تم تحديث كلمة المرور فعلياً للمستخدم:", email);
    return { success: true, demo: false };

  } catch (error: any) {
    console.error('Reset Password Error Details:', error);
    
    // إذا كان الخطأ متعلقاً بتنسيق المفتاح الخاص
    if (error.message && error.message.includes('secretOrPrivateKey')) {
        return { 
            success: false, 
            error: 'خطأ تقني في مفتاح الأمان (Private Key) المضاف في فيرسل. يرجى التأكد من نسخ المفتاح كاملاً بما في ذلك الـ Headers.' 
        };
    }

    if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'عذراً، الحساب المرتبط بهذا الرقم غير موجود.' };
    }

    return { success: false, error: 'فشل التحديث: ' + (error.message || 'خطأ غير معروف في السيرفر') };
  }
}
