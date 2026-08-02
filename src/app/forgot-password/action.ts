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
  // 1. إزالة أي علامات تنصيص أو فواصل زائدة في البداية والنهاية (حتى لو نسخ المستخدم الفاصلة من ملف الـ JSON)
  privateKey = privateKey.trim().replace(/^["']|["']$|,$/g, '');

  // 2. استبدال علامات الـ \n النصية بأسطر حقيقية (ضروري جداً لنظام Node.js)
  privateKey = privateKey.replace(/\\n/g, '\n');

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
    
    // إذا لم تتوفر المفاتيح، ننتقل لوضع المعاينة (Demo Mode) بدلاً من الانهيار
    if (!app) {
      console.log("🛠️ تعمل في وضع المعاينة (أدخل المفاتيح في Vercel للوضع الحقيقي)");
      return { 
        success: true, 
        demo: true 
      };
    }

    const auth = admin.auth(app);

    // البحث عن المستخدم باستخدام البريد الإلكتروني (رقم الهاتف المعدل)
    const userRecord = await auth.getUserByEmail(email);
    
    if (!userRecord) {
      return { success: false, error: 'عذراً، هذا الحساب غير موجود في سجلاتنا.' };
    }

    // تنفيذ التحديث الفعلي لكلمة المرور في Firebase Auth بصلاحيات المدير
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    console.log("✅ تم تحديث كلمة المرور فعلياً للمستخدم:", email);
    return { success: true, demo: false };

  } catch (error: any) {
    console.error('Reset Password Error Details:', error);
    
    // معالجة أخطاء المفاتيح الشائعة لتقديم رسالة واضحة للمبرمج
    if (error.message && (error.message.includes('secretOrPrivateKey') || error.message.includes('PEM'))) {
        return { 
            success: false, 
            error: 'خطأ تقني في تنسيق مفتاح الأمان (Private Key). يرجى التأكد من نسخه كاملاً من ملف الـ JSON.' 
        };
    }

    if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'عذراً، الحساب المرتبط بهذا الرقم غير موجود.' };
    }

    return { success: false, error: 'فشل التحديث: ' + (error.message || 'خطأ غير معروف في السيرفر') };
  }
}
