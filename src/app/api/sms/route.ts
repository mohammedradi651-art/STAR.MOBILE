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
    // مفتاح الربط الأمني المأخوذ من مثال الـ Curl
    const API_KEY = 'alwadi_pds9eBxXjJwgVnz4jR0sGh6vYGI49m1E';

    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        // الهيكلية المطلوبة من السيرفر الجديد بالضبط كما في مثال Curl
        deviceId: 'android-device',
        phoneNumber: phoneNumber.toString().trim(),
        message: message,
      }),
      cache: 'no-store'
    });

    // محاولة قراءة الرد بأمان
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = { message: responseText || 'رد غير معروف من السيرفر' };
    }

    if (!response.ok) {
        console.error('SMS Gateway raw response:', responseText);
        throw new Error(data.message || `خطأ في بوابة الإرسال (Status: ${response.status})`);
    }

    // إرجاع استجابة نجاح للتطبيق لتمكين المستخدم من الانتقال لخطوة التحقق
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('SMS Gateway Error:', error);
    // إرجاع رسالة خطأ واضحة للمستخدم
    return NextResponse.json({ 
        success: false, 
        error: error.message || 'تعذر الاتصال ببوابة إرسال الرسائل' 
    }, { status: 500 });
  }
}
