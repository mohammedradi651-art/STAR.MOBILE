import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview ويب هوك استقبال إشعارات بنك أمجاد المطور v1.2.
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

    // محرك استخراج البيانات المطور v1.2
    // 1. استخراج المبلغ (أرقام قد تتبعها نصوص مثل ر.ي)
    const amountMatch = rawMessage.match(/بمبلغ\s*([\d,.]+)/);
    
    // 2. استخراج الاسم بدقة (النص المحصور بين "من" و "الى" أو "إلى" أو "حسابك")
    const nameMatch = rawMessage.match(/من\s+(.*?)\s+(?:الى|إلى|حسابك)/);

    const amountStr = amountMatch ? amountMatch[1].replace(/,/g, '') : '0';
    const amount = parseFloat(amountStr);
    
    // إذا فشل الـ Regex في التقاط الاسم، نحاول التقاط أي شيء بعد كلمة "من"
    let senderName = 'غير معروف';
    if (nameMatch && nameMatch[1]) {
        senderName = nameMatch[1].trim();
    } else {
        const fallbackNameMatch = rawMessage.match(/من\s+(.*)/);
        if (fallbackNameMatch) {
            senderName = fallbackNameMatch[1].split(' ')[0] + ' ' + (fallbackNameMatch[1].split(' ')[1] || '');
        }
    }

    // توليد رقم مرجع عشوائي (Random Reference) لتعويض المرجع المفقود في بنك أمجاد
    const randomRef = Math.floor(10000000 + Math.random() * 90000000).toString();

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
      reference: randomRef, // حفظ الرقم المرجعي العشوائي
      rawMessage: rawMessage,
      status: 'unpaid',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ 
        success: true, 
        message: 'تم استلام إشعار بنك أمجاد بنجاح',
        data: { amount, senderName, reference: randomRef }
    });

  } catch (error: any) {
    console.error('Amjad Webhook Critical Error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ داخلي في السيرفر أثناء معالجة الإشعار' }, { status: 500 });
  }
}
