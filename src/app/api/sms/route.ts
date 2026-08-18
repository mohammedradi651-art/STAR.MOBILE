import { NextResponse } from 'next/server';

/**
 * مسار API الموحد لإرسال أكواد التحقق (OTP) عبر البوابة الجديدة.
 * يستخدم في: إنشاء الحساب الجديد، واستعادة كلمة المرور.
 */
export async function POST(req: Request) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // الرابط المحدث بناءً على الوصف الأخير
    const TARGET_URL = 'https://alwdiwse.vercel.app/api/sms/send';
    // مفتاح الربط الأمني المعتمد
    const API_KEY = 'alwadi_pds9eBxXjJwgVnz4jR0sGh6vYGI49m1E';

    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        // الهيكلية المطلوبة من السيرفر لضمان قبول الطلب
        deviceId: 'android-device',
        phoneNumber: phoneNumber.toString().trim(), // تغيير الحقل ليتوافق مع متطلبات السيرفر (phoneNumber)
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
        console.error('SMS Gateway Error Details:', {
            status: response.status,
            response: responseText
        });
        
        let errorMsg = 'فشل إرسال رمز التحقق.';
        if (response.status === 401) errorMsg = 'خطأ في مفتاح أمان بوابة الإرسال.';
        if (response.status === 400) errorMsg = 'بيانات الهاتف أو الرسالة غير صحيحة.';
        
        throw new Error(data.message || errorMsg);
    }

    // إرجاع استجابة نجاح للتطبيق لتمكين المستخدم من الانتقال لخطوة التحقق
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('SMS Gateway Critical Error:', error);
    // إرجاع رسالة خطأ واضحة للمستخدم
    return NextResponse.json({ 
        success: false, 
        error: error.message || 'تعذر الاتصال ببوابة إرسال الرسائل' 
    }, { status: 500 });
  }
}
