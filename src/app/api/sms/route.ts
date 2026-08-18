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

    // تنظيف رقم الهاتف لضمان إرسال 9 أرقام فقط بدون أصفار زائدة أو رموز
    let cleanPhone = phoneNumber.toString().trim().replace(/\D/g, '');
    
    // إزالة أي أصفار في البداية لضمان التنسيق (مثلاً 077 تصبح 77)
    while (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    
    // إذا كان الرقم أطول من 9 أرقام (مثلاً يتضمن مفتاح الدولة)، نأخذ آخر 9 أرقام
    if (cleanPhone.length > 9) {
        cleanPhone = cleanPhone.slice(-9);
    }

    // الرابط المعتمد
    const TARGET_URL = 'https://star-sms.vercel.app/api/messages';

    const response = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': 'STAR-OTP-770326828' // إضافة مفتاح الأمان الجديد المقدم من المستخدم
      },
      body: JSON.stringify({
        // استخدام "phone" كمسمى للحقل بناءً على المثال الناجح للمستخدم
        phone: cleanPhone,
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
            response: responseText,
            sentNumber: cleanPhone
        });
        
        let errorMsg = 'فشل إرسال رمز التحقق.';
        if (response.status === 400) errorMsg = 'بيانات الهاتف أو الرسالة غير صحيحة لدى المزود.';
        if (response.status === 401) errorMsg = 'مفتاح الأمان (API Key) غير صحيح أو منتهي الصلاحية.';
        
        throw new Error(data.message || errorMsg);
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('SMS Gateway Critical Error:', error);
    return NextResponse.json({ 
        success: false, 
        error: error.message || 'تعذر الاتصال ببوابة إرسال الرسائل' 
    }, { status: 500 });
  }
}
