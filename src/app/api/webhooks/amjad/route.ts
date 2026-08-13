import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview ويب هوك استقبال إشعارات بنك أمجاد المطور v1.1.
 * الرابط: https://star26.vercel.app/api/webhooks/amjad
 * يدعم الصيغة: تم إيداع حوالة بمبلغ 5000ر.ي من علي محفوظ احمد بازياد الى حسابك
 */

export async function POST(req: Request) {
  try {
    // قراءة نص الطلب أولاً للتعامل مع أي هيكلية JSON
    const body = await req.json();
    
    // البحث عن الرسالة في أكثر من حقل متوقع من تطبيقات قارئ الإشعارات
    const rawMessage = body.rawMessage || body.message || body.text || body.content || '';

    if (!rawMessage) {
      return NextResponse.json({ success: false, message: 'الرسالة مطلوبة ولم يتم العثور عليها في الطلب' }, { status: 400 });
    }

    // محرك استخراج البيانات المطور
    // 1. استخراج المبلغ (أرقام قد تتبعها نصوص مثل ر.ي)
    const amountMatch = rawMessage.match(/بمبلغ\s*([\d,.]+)/);
    // 2. استخراج الاسم (النص المحصور بين "من" و "الى")
    const nameMatch = rawMessage.match(/من\s*(.*?)\s*الى/);

    const amountStr = amountMatch ? amountMatch[1].replace(/,/g, '') : '0';
    const amount = parseFloat(amountStr);
    const senderName = nameMatch ? nameMatch[1].trim() : 'غير معروف';

    if (amount <= 0) {
        console.error('Failed to extract amount from:', rawMessage);
        return NextResponse.json({ success: false, message: 'تعذر استخراج المبلغ من الرسالة بشكل صحيح' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();
    const notificationsRef = collection(firestore, 'bankNotifications');

    // حفظ الإشعار في قاعدة البيانات للمطابقة الآلية
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
        message: 'تم استلام إشعار بنك أمجاد بنجاح',
        data: { amount, senderName }
    });

  } catch (error: any) {
    console.error('Amjad Webhook Critical Error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي في السيرفر أثناء معالجة الإشعار' }, { status: 500 });
  }
}
