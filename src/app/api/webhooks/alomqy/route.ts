import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview ويب هوك استقبال إشعارات العمقي المباشرة.
 * الرابط: https://star26.vercel.app/api/webhooks/alomqy
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { account, amount, senderName, rawMessage } = body;

    if (!account || !amount) {
      return NextResponse.json({ success: false, message: 'بيانات ناقصة' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();
    const notificationsRef = collection(firestore, 'alomqyNotifications');

    await addDoc(notificationsRef, {
      account: account.toString().trim(),
      amount: parseFloat(amount),
      senderName: senderName || 'غير معروف',
      rawMessage: rawMessage || '',
      status: 'unpaid', // الحالة الافتراضية "غير مدفوع" (أخضر في الواجهة)
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, message: 'تم استلام الإشعار وحفظه' });
  } catch (error: any) {
    console.error('Al-Omqy Webhook Error:', error);
    return NextResponse.json({ success: false, message: 'خطأ داخلي' }, { status: 500 });
  }
}
