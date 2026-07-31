import { NextResponse } from 'next/server';

/**
 * @fileOverview مسار API لإرسال رسائل واتساب عبر خدمة Wassenger.
 */

export async function POST(req: Request) {
  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // التأكد من تنسيق الرقم الدولي (يجب أن يبدأ بـ +967)
    let cleanPhone = phone.trim().replace(/\s/g, '');
    if (!cleanPhone.startsWith('+')) {
        if (cleanPhone.startsWith('967')) {
            cleanPhone = `+${cleanPhone}`;
        } else {
            cleanPhone = `+967${cleanPhone}`;
        }
    }

    const API_KEY = '8a0d426659d9e3c76f5e5b153c8594143307c4f855cdfd778ac8d8e0154ccde1fee0441ac6bf0ccc';
    const WASSENGER_URL = 'https://api.wassenger.com/v1/messages';

    const response = await fetch(WASSENGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': API_KEY,
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Wassenger API Error:', data);
        throw new Error(data.message || 'فشل إرسال رسالة الواتساب');
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('WhatsApp API Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
