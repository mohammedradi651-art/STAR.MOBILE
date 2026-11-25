import { NextResponse } from 'next/server';
import { lookupAlwadiCard } from '@/lib/alwadi-client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await lookupAlwadiCard(body?.number);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status || 200 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Global Lookup Error:', error);
    const message = String(error?.message || '');
    if (message.includes('بيانات الاعتماد')) {
      return NextResponse.json({ success: false, message }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: 'حدث خطأ غير متوقع.' },
      { status: 500 }
    );
  }
}
