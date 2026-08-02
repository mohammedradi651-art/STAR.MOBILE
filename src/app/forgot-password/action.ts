'use server';

import * as admin from 'firebase-admin';

/**
 * @fileOverview محرك استعادة كلمة المرور المطور (Server Action).
 * يتميز بالقدرة على العمل في وضع المعاينة (Demo) إذا كانت مفاتيح السيرفر غير متوفرة.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];
  
  // جلب البيانات من بيئة التشغيل
  const projectId = process.env.FIREBASE_PROJECT_ID || "studio-239662212-1b7b6";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // إذا كانت المفاتيح ناقصة، لا تحاول التهيئة وتجنب الانهيار
  if (!clientEmail || !privateKey) {
    console.warn("⚠️ تنبيه: مفاتيح Firebase Admin غير متوفرة في بيئة التشغيل. سيتم تشغيل وضع المعاينة.");
    return null;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
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
    
    // وضع المعاينة (Demo Mode): إذا لم تكن هناك مفاتيح سيرفر
    if (!app) {
      console.log("🛠️ وضع المعاينة: تم قبول طلب تغيير كلمة المرور للرقم:", phoneNumber);
      return { 
        success: true, 
        demo: true, 
        message: "تم التحقق بنجاح. (ملاحظة: لتفعيل التغيير الفعلي في قاعدة البيانات، يرجى إضافة مفاتيح السيرفر في إعدادات الاستضافة)." 
      };
    }

    const email = `${phoneNumber.trim()}@shabakat.com`;
    
    // 1. البحث عن المستخدم
    const userRecord = await admin.auth(app).getUserByEmail(email);
    
    if (!userRecord) {
      return { success: false, error: 'المستخدم غير موجود في النظام.' };
    }

    // 2. التحديث الفعلي
    await admin.auth(app).updateUser(userRecord.uid, {
      password: newPassword,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Reset Password Action Error:', error);
    
    // معالجة الأخطاء الشائعة
    if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'عذراً، هذا الحساب غير موجود في سجلات الدخول.' };
    }

    return { success: false, error: 'فشل التحديث: تأكد من صحة البيانات أو حاول لاحقاً.' };
  }
}
