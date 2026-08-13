import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview ويب هوك استقبال إشعارات بنك أمجاد.
 * الصيغة: تم إيداع حوالة بمبلغ 5000ر.ي من علي محفوظ احمد بازياد الى حسابك
 * الرابط: https://star26.vercel.app/api/webhooks/amjad
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rawMessage } = body;

    if (!rawMessage) {
      return NextResponse.json({ success: false, message: 'الرسالة مطلوبة' }, { status: 400 });
    }

    // محرك استخراج البيانات باستخدام Regex
    // 1. استخراج المبلغ (أرقام بعد كلمة بمبلغ)
    const amountMatch = rawMessage.match(/بمبلغ\s*(\d+)/);
    // 2. استخراج الاسم (النص بين "من" و "الى")
    const nameMatch = rawMessage.match(/من\s*(.*?)\s*الى/);

    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    const senderName = nameMatch ? nameMatch[1].trim() : 'غير معروف';

    if (amount <= 0) {
        return NextResponse.json({ success: false, message: 'تعذر استخراج المبلغ من الرسالة' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();
    const notificationsRef = collection(firestore, 'bankNotifications');

    await addDoc(notificationsRef, {
      bank: 'amjad',
      amount: amount,
      senderName: senderName,
      rawMessage: rawMessage,
      status: 'unpaid',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ 
        success: true, 
        message: 'تم استلام إشعار بنك أمجاد وحفظه بنجاح',
        extracted: { amount, senderName }
    });
  } catch (error: any) {
    console.error('Amjad Webhook Error:', error);
    return NextResponse.json({ success: false, message: 'خطأ داخلي' }, { status: 500 });
  }
}
