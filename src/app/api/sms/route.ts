import { NextResponse } from 'next/server';

/**
 * مسار API لإرسال الرسائل النصية عبر SimGate API الجديدة
 * تم تصحيح مسمى الحقل إلى phoneNumber بناءً على توثيق العميل الأخير
 */
export async function POST(req: Request) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // تنظيف رقم الهاتف (إرساله كما هو في مثال العميل 770326828)
    const cleanPhone = phoneNumber.trim();

    const BASE_URL = 'https://api.simgate.app/v1/sms/send';
    const API_KEY = '95431327-d909-44b9-9833-e416947165d2';
    const DEVICE_ID = 'android-36f134a8683a90b3';

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        deviceId: DEVICE_ID,
        phoneNumber: cleanPhone, // تم التصحيح من phoneNumbe إلى phoneNumber
        message: message,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'خطأ غير معروف في السيرفر' }));
        throw new Error(errorData.message || 'فشل إرسال الرسالة من المصدر');
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('SimGate SMS API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
