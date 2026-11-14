import { NextResponse } from 'next/server';
import { sendPushNotificationToUser } from '@/lib/push-notification';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, title, body: msgBody, transid, status, amount } = body;

    if (!userId || !title) {
      return NextResponse.json(
        { success: false, message: 'Missing userId or title' },
        { status: 400 }
      );
    }

    await sendPushNotificationToUser(null, userId, {
      title,
      body: msgBody || '',
      transid: transid ? String(transid) : undefined,
      status: status || 'success',
      amount: amount ? Number(amount) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in send-push API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

