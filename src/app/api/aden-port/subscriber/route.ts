
import { NextResponse } from 'next/server';

const ODOO_BASE = 'https://api.alwaadi.net';
const ODOO_DB = 'admin';
const ODOO_USER = '770326M';
const ODOO_PASS = '84a167f4e26e831ba4bea62ce3c65b1f54cf3656';

export async function POST(req: Request) {
  try {
    const { number } = await req.json();

    if (!number) {
      return NextResponse.json({ success: false, message: 'رقم المشترك مطلوب' }, { status: 400 });
    }

    // بيانات تجريبية للمعاينة بناءً على طلب المستخدم
    if (number === '29825') {
      return NextResponse.json({
        success: true,
        subscriber: 'فهد عبيد حم', 
        subscriber_id: 94588 
      });
    }

    if (number === '592') {
      return NextResponse.json({
        success: true,
        subscriber: 'محمد راضي ربيع باشادي',
        subscriber_id: 94588
      });
    }

    // 1. تسجيل الدخول للحصول على الجلسة
    const loginResponse = await fetch(`${ODOO_BASE}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        params: {
          db: ODOO_DB,
          login: ODOO_USER,
          password: ODOO_PASS
        }
      })
    });

    const sessionData = await loginResponse.json();
    if (!sessionData.result) {
        return NextResponse.json({ success: false, message: 'فشل تسجيل الدخول للمنظومة' }, { status: 401 });
    }

    // 2. الاستعلام عن المشترك باستخدام dataset/call_kw
    const response = await fetch(`${ODOO_BASE}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "subscriber",
          method: "search_read",
          args: [[["number", "=", number]]],
          kwargs: {
            fields: ["name", "number"]
          }
        },
        id: 1
      })
    });

    const data = await response.json();

    if (data.result && data.result.length > 0) {
      const subscriberData = data.result[0];
      return NextResponse.json({
        success: true,
        subscriber: subscriberData.name, 
        subscriber_id: subscriberData.id 
      });
    }

    return NextResponse.json({
      success: false,
      message: 'المشترك غير موجود في قاعدة البيانات'
    });

  } catch (error: any) {
    console.error('Aden Port Inquiry Error:', error);
    return NextResponse.json({ success: false, message: 'فشل الاتصال بسيرفر المنظومة' }, { status: 500 });
  }
}
