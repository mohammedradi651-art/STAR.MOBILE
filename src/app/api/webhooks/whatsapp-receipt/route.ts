
import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview مستقبل شحن الرصيد التلقائي (Webhook)
 * يستقبل البيانات الجاهزة من نظام الواتساب وينفذ الشحن فوراً.
 */

export async function POST(req: Request) {
  try {
    const { phone, amount, receiptNumber } = await req.json();

    if (!phone || !amount || !receiptNumber) {
      return NextResponse.json({ 
        success: false, 
        message: 'بيانات ناقصة: يرجى إرسال phone و amount و receiptNumber' 
      }, { status: 400 });
    }

    // 1. تنظيف رقم الهاتف (نظام 9 أرقام)
    const cleanPhone = phone.replace(/\D/g, '').slice(-9);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
        return NextResponse.json({ success: false, message: 'مبلغ غير صحيح' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();

    // 2. البحث عن المستخدم بالرقم
    const usersRef = collection(firestore, 'users');
    const qUser = query(usersRef, where('phoneNumber', '==', cleanPhone));
    const userSnapshot = await getDocs(qUser);

    if (userSnapshot.empty) {
      return NextResponse.json({ 
        success: false, 
        message: `الرقم ${cleanPhone} غير مسجل في التطبيق.` 
      }, { status: 404 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    // 3. منع التكرار (التحقق هل تم شحن هذا الإيصال مسبقاً؟)
    const txRef = collection(firestore, 'users', userId, 'transactions');
    const qTx = query(txRef, where('notes', '>=', `مرجع: ${receiptNumber}`));
    const txSnapshot = await getDocs(qTx);

    // ملاحظة: نتحقق من وجود رقم الإيصال في الملاحظات لضمان عدم الشحن المزدوج
    const alreadyProcessed = txSnapshot.docs.some(d => d.data().notes?.includes(receiptNumber));
    if (alreadyProcessed) {
        return NextResponse.json({ 
            success: false, 
            message: 'هذا الإيصال تم معالجته وشحنه مسبقاً.' 
        }, { status: 409 });
    }

    // 4. تنفيذ عملية الشحن (Batch)
    const batch = writeBatch(firestore);
    const now = new Date().toISOString();

    // تحديث الرصيد
    batch.update(userDoc.ref, { balance: increment(numericAmount) });

    // تسجيل العملية
    const newTxRef = doc(collection(firestore, 'users', userId, 'transactions'));
    batch.set(newTxRef, {
        userId,
        transactionDate: now,
        amount: numericAmount,
        transactionType: 'شحن تلقائي (واتساب)',
        notes: `تم الشحن تلقائياً عبر الواتساب. مرجع: ${receiptNumber}`,
    });

    // إضافة إشعار داخلي
    const notifRef = doc(collection(firestore, 'users', userId, 'notifications'));
    batch.set(notifRef, {
        title: 'تم شحن رصيدك تلقائياً',
        body: `شكراً لك! تم إضافة ${numericAmount} ريال إلى حسابك عبر الواتساب بنجاح.`,
        timestamp: now
    });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        message: 'تم الشحن بنجاح',
        data: {
            userName: userData.displayName,
            amount: numericAmount,
            newBalance: (userData.balance || 0) + numericAmount
        }
    });

  } catch (error: any) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ 
        success: false, 
        message: 'خطأ داخلي في السيرفر: ' + error.message 
    }, { status: 500 });
  }
}
