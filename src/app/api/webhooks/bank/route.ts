import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview ويب هوك موحد لاستقبال إشعارات البنوك (العمقي والكريمي).
 * الرابط: https://star26.vercel.app/api/webhooks/bank
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bank, account, amount, senderName, reference, rawMessage } = body;

    // التحقق من البيانات الأساسية
    if (!bank || !amount) {
      return NextResponse.json({ success: false, message: 'بيانات ناقصة: يجب إرسال bank و amount' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();
    const notificationsRef = collection(firestore, 'bankNotifications');

    await addDoc(notificationsRef, {
      bank: bank.toLowerCase(), // 'alomqy' or 'kuraimi'
      account: account ? account.toString().trim() : '', // للعمقي
      reference: reference ? reference.toString().trim() : '', // للكريمي
      amount: parseFloat(amount),
      senderName: senderName || 'غير معروف',
      rawMessage: rawMessage || '',
      status: 'unpaid',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, message: `تم استلام إشعار ${bank} وحفظه بنجاح` });
  } catch (error: any) {
    console.error('Bank Webhook Error:', error);
    return NextResponse.json({ success: false, message: 'خطأ داخلي في السيرفر' }, { status: 500 });
  }
}
