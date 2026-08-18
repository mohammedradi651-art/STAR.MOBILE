import { NextResponse } from 'next/server';

/**
 * مسار API الموحد لإرسال أكواد التحقق (OTP) عبر الرابط الجديد.
 * يستخدم في: إنشاء الحساب الجديد، واستعادة كلمة المرور.
 */
export async function POST(req: Request) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // الرابط الجديد المعتمد
    const TARGET_URL = 'https://alwadi-sms.vercel.app/api/messages';

    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        // استخدام mobile و message كحقول قياسية للرابط الجديد
        mobile: phoneNumber.toString().trim(),
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
