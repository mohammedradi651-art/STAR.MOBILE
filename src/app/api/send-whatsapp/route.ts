import { NextResponse } from 'next/server';

/**
 * @fileOverview مسار API لإرسال رسائل واتساب عبر خدمة Wassenger المحدثة.
 */

export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // تنظيف رقم الهاتف بدقة احترافية
    let cleanPhone = phone.trim().replace(/\D/g, ''); // إبقاء الأرقام فقط
    
    // إزالة الصفر في بداية الرقم اليمني إذا وجد (مثل 077 -> 77)
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    
    // التأكد من إضافة مفتاح الدولة وتنسيق علامة +
    if (!cleanPhone.startsWith('967')) {
        cleanPhone = `+967${cleanPhone}`;
    } else {
        cleanPhone = `+${cleanPhone}`;
    }

    const API_KEY = '8a0d426659d9e3c76f5e5b153c8594143307c4f855cdfd778ac8d8e0154ccde1fee0441ac6bf0ccc';
    const WASSENGER_URL = 'https://api.wassenger.com/v1/messages';

    const response = await fetch(WASSENGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': API_KEY, // نظام Wassenger يستخدم Token في الهيدر
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message,
        priority: 'high'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Wassenger API Error Details:', data);
        return NextResponse.json({ 
            success: false, 
            error: data.message || 'فشل إرسال رسالة الواتساب من المصدر.',
            details: data
        }, { status: response.status });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('WhatsApp API Route Internal Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
