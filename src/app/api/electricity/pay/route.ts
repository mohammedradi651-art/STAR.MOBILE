import { NextResponse } from 'next/server';
import { POST as handleElectricityPost, OPTIONS as handleElectricityOptions } from '../lookup/route';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleElectricityOptions();
}

/**
 * نقطة نهاية تسديد فواتير الكهرباء المباشرة لأصحاب الـ API
 * POST /api/electricity/pay
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const modifiedBody = { ...rawBody, action: 'pay' };

    // إنشاء طلب جديد يحمل خاصية action: 'pay'
    const modifiedReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(modifiedBody)
    });

    return await handleElectricityPost(modifiedReq);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      code: 'SM_SERVER_ERROR',
      message: error?.message || 'فشل معالجة طلب سداد الكهرباء'
    }, { status: 500 });
  }
}

