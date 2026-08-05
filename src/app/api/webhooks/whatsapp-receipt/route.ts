import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview مستقبل شحن الرصيد التلقائي المطور (v1.7)
 * ينفذ عمليات الإيداع الفورية بناءً على تأكيد نظام الواتساب.
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, amount, receiptNumber } = body;

    if (!phone || !amount || !receiptNumber) {
      return NextResponse.json({ 
        success: false, 
        message: 'بيانات ناقصة: يرجى إرسال phone و amount و receiptNumber' 
      }, { status: 400 });
    }

    // 1. تنظيف رقم الهاتف (نظام 9 أرقام يبدأ بـ 7)
    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-9);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
        return NextResponse.json({ success: false, message: 'مبلغ الشحن غير صحيح.' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();

    // 2. البحث عن المستخدم بدقة بالرقم
    const usersRef = collection(firestore, 'users');
    const qUser = query(usersRef, where('phoneNumber', '==', cleanPhone));
    const userSnapshot = await getDocs(qUser);

    if (userSnapshot.empty) {
      return NextResponse.json({ 
        success: false, 
        message: `الرقم ${cleanPhone} غير مسجل في قاعدة بيانات التطبيق حالياً.` 
      }, { status: 404 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    // 3. منع التكرار باستخدام حقل مرجعي خاص
    const txRef = collection(firestore, 'users', userId, 'transactions');
    const qTx = query(txRef, where('receiptReference', '==', receiptNumber));
    const txSnapshot = await getDocs(qTx);

    if (!txSnapshot.empty) {
        return NextResponse.json({ 
            success: false, 
            message: 'هذا الإيصال تم شحنه مسبقاً، لا يمكن تكرار العملية.' 
        }, { status: 409 });
    }

    // 4. تنفيذ العملية (الخصم والتسجيل) في حزمة واحدة (Batch)
    const batch = writeBatch(firestore);
    const now = new Date().toISOString();

    // تحديث رصيد المستخدم
    batch.update(userDoc.ref, { balance: increment(numericAmount) });

    // تسجيل العملية في كشف الحساب
    const newTxRef = doc(collection(firestore, 'users', userId, 'transactions'));
    batch.set(newTxRef, {
        userId,
        transactionDate: now,
        amount: numericAmount,
        transactionType: 'تغذية رصيد (واتساب آلي)',
        notes: `تم الإيداع تلقائياً بناءً على الإيصال رقم: ${receiptNumber}`,
        receiptReference: receiptNumber // حقل حاسم لمنع التكرار
    });

    // إضافة إشعار للمستخدم داخل التطبيق
    const notifRef = doc(collection(firestore, 'users', userId, 'notifications'));
    batch.set(notifRef, {
        title: 'تم شحن رصيدك بنجاح ✅',
        body: `شكراً لك! تم إضافة ${numericAmount.toLocaleString()} ريال إلى حسابك آلياً.`,
        timestamp: now
    });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        message: 'تمت عملية الشحن بنجاح.',
        data: {
            userName: userData.displayName,
            deposited: numericAmount,
            newBalance: (userData.balance || 0) + numericAmount,
            receipt: receiptNumber
        }
    });

  } catch (error: any) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ 
        success: false, 
        message: 'خطأ داخلي في الخادم: ' + error.message 
    }, { status: 500 });
  }
}
