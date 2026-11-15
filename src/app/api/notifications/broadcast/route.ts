import { NextResponse } from 'next/server';
import { sendBroadcastPushNotification } from '@/lib/push-notification';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, body: msgBody, id } = body;

    if (!title || !msgBody) {
      return NextResponse.json(
        { success: false, message: 'Missing title or body' },
        { status: 400 }
      );
    }

    await sendBroadcastPushNotification({
      title,
      body: msgBody,
      id: id ? String(id) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in send-broadcast-push API:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

