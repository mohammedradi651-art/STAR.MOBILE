
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview تنفيذ عملية الشراء عبر Baity API V2
 * يتطلب إرسال Idempotency-Key لضمان عدم تكرار الخصم.
 */

const ORDER_API_URL = 'https://apis.baitynet.net/api/partner/v2/orders';

export async function POST(request: Request) {
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY || process.env.BAITYNET_BALANCE_API_KEY;

  try {
    const body = await request.json();
    const { classId, userId } = body;

    if (!classId) {
      return NextResponse.json({ message: 'Class ID is required' }, { status: 400 });
    }

    if (!API_KEY) {
        return NextResponse.json({ message: 'إعدادات النظام غير مكتملة' }, { status: 500 });
    }

    // توليد مفتاح فريد لمنع تكرار الطلب (Idempotency)
    const idempotencyKey = crypto.randomUUID();

    const externalApiBody = {
      data: {
        class: parseInt(classId),
        externalRef: userId || 'web_order',
      }
    };
    
    const response = await fetch(ORDER_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY.trim(),
        'Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StarMobileApp/1.6',
      },
      body: JSON.stringify(externalApiBody),
      cache: 'no-store'
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Order V2 Failed (${response.status}):`, responseData);
      const errorMsg = responseData.error?.message?.ar || 'فشل الشراء من المصدر';
      return NextResponse.json({ message: errorMsg }, { status: response.status });
    }
    
    // نجاح العملية
    if (responseData.status === 200 || responseData.status === 201) {
        return NextResponse.json(responseData);
    }
    
    return NextResponse.json({ message: 'فشل إنشاء الطلب' }, { status: 400 });

  } catch (error: any) {
    console.error('Order V2 Exception:', error);
    return NextResponse.json({ message: 'حدث خطأ تقني أثناء الشراء' }, { status: 500 });
  }
}
