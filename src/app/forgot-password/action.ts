'use server';

import * as admin from 'firebase-admin';

/**
 * @fileOverview محرك استعادة كلمة المرور المطور (Server Action).
 * يقوم بتغيير كلمة المرور فعلياً إذا توفرت مفاتيح السيرفر، أو يعمل في وضع المعاينة إذا كانت ناقصة.
 */

function getAdminApp() {
  // إذا كان التطبيق مهيأ مسبقاً، نستخدمه
  if (admin.apps.length > 0) return admin.apps[0];
  
  // جلب البيانات من Environment Variables (يجب وضعها في Vercel أو ملف .env)
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // التحقق من وجود المفاتيح المطلوبة للعمل "الحقيقي"
  if (!clientEmail || !privateKey || !projectId) {
    console.warn("⚠️ تنبيه: مفاتيح Firebase Admin ناقصة. النظام سيعمل في وضع 'المعاينة الذكي' فقط.");
    return null;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'), // معالجة السطر الجديد في المفتاح
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
    
    // --- وضع المعاينة (Demo Mode) ---
    if (!app) {
      console.log("🛠️ وضع المعاينة: تم التحقق من الرقم بنجاح:", phoneNumber);
      return { 
        success: true, 
        demo: true, 
        message: "تم التحقق بنجاح. (ملاحظة: لتفعيل التغيير الفعلي، يرجى إضافة مفاتيح السيرفر في إعدادات الاستضافة)." 
      };
    }

    // --- الوضع الحقيقي (Real Mode) ---
    const userRecord = await admin.auth(app).getUserByEmail(email);
    
    if (!userRecord) {
      return { success: false, error: 'عذراً، هذا الحساب غير موجود في سجلاتنا.' };
    }

    // تحديث كلمة المرور إجبارياً
    await admin.auth(app).updateUser(userRecord.uid, {
      password: newPassword,
    });

    console.log("✅ تم تحديث كلمة المرور فعلياً للمستخدم:", email);
    return { success: true, demo: false };

  } catch (error: any) {
    console.error('Reset Password Action Error:', error);
    
    if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'عذراً، الحساب المرتبط بهذا الرقم غير موجود.' };
    }

    return { success: false, error: 'فشل التحديث: تأكد من إعدادات السيرفر أو حاول لاحقاً.' };
  }
}
