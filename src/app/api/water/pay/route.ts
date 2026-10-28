import { NextResponse } from 'next/server';
import { POST as handleWaterPost, OPTIONS as handleWaterOptions } from '../lookup/route';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleWaterOptions();
}

/**
 * نقطة نهاية تسديد فواتير المياه المباشرة لأصحاب الـ API
 * POST /api/water/pay
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

    return await handleWaterPost(modifiedReq);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      code: 'SM_SERVER_ERROR',
      message: error?.message || 'فشل معالجة طلب سداد المياه'
    }, { status: 500 });
  }
}

