import { NextResponse } from 'next/server';

/**
 * @fileOverview مسار API لإرسال رسائل واتساب عبر خدمة Wassenger المحدثة (v1.6).
 */

export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // تنظيف رقم الهاتف بدقة ليتوافق مع التنسيق الدولي الصارم
    let cleanPhone = phone.trim().replace(/\D/g, ''); 
    
    // إزالة الصفر في بداية الرقم اليمني إذا وجد (مثلاً 077 تصبح 77)
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    
    // التأكد من أن الرقم يبدأ بـ 967 ويحمل علامة +
    if (cleanPhone.startsWith('967')) {
        cleanPhone = `+${cleanPhone}`;
    } else {
        cleanPhone = `+967${cleanPhone}`;
    }

    // المفتاح الجديد المحدث (Token)
    const API_KEY = '203bbed69b51b1b596be0e232406cf833e2e8b66abda63dc1ea13a0ce7026983ae9f3f1ee9277571';
    const WASSENGER_URL = 'https://api.wassenger.com/v1/messages';

    const response = await fetch(WASSENGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': API_KEY, // استخدام Token في الهيدر كما ورد في التوثيق
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message,
        priority: 'high'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Wassenger API Error:', data);
        return NextResponse.json({ 
            success: false, 
            error: data.message || 'فشل إرسال رسالة الواتساب.',
            details: data
        }, { status: response.status });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('WhatsApp API Internal Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
