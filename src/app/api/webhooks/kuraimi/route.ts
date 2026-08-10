import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview ويب هوك استقبال إشعارات بنك الكريمي المباشرة.
 * الرابط: https://star26.vercel.app/api/webhooks/kuraimi
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reference, amount, senderName, rawMessage } = body;

    if (!reference || !amount) {
      return NextResponse.json({ success: false, message: 'بيانات ناقصة: يجب إرسال reference و amount' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();
    const notificationsRef = collection(firestore, 'bankNotifications');

    await addDoc(notificationsRef, {
      bank: 'kuraimi',
      reference: reference.toString().trim(),
      amount: parseFloat(amount),
      senderName: senderName || 'غير معروف',
      rawMessage: rawMessage || '',
      status: 'unpaid',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, message: 'تم استلام إشعار الكريمي وحفظه' });
  } catch (error: any) {
    console.error('Kuraimi Webhook Error:', error);
    return NextResponse.json({ success: false, message: 'خطأ داخلي في السيرفر' }, { status: 500 });
  }
}
