import { NextResponse } from 'next/server';

/**
 * مسار API الموحد لإرسال أكواد التحقق (OTP) عبر البوابة الجديدة مع مفتاح الأمان.
 * يستخدم في: إنشاء الحساب الجديد، واستعادة كلمة المرور.
 */
export async function POST(req: Request) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // الرابط المحدث بناءً على طلب العميل
    const TARGET_URL = 'https://alwdiwse.vercel.app/api/sms/send';
    // مفتاح الربط الأمني
    const API_KEY = 'alwadi_pds9eBxXjJwgVnz4jR0sGh6vYGI49m1E';

    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        // الهيكلية المطلوبة من السيرفر الجديد
        deviceId: 'android-device',
        phoneNumber: phoneNumber.trim(),
        message: message,
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'خطأ في استجابة بوابة الإرسال' }));
        throw new Error(errorData.message || 'فشل إرسال الكود من المصدر');
    }

    const data = await response.json();
    
    // إرجاع استجابة نجاح للتطبيق لتمكين المستخدم من الانتقال لخطوة التحقق
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('SMS Gateway Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
