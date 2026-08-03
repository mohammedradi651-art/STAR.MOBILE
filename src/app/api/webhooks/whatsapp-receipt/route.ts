
import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview محرك الشحن التلقائي المباشر (v1.5)
 * الوظيفة: استقبال البيانات المستخرجة جاهزة من نظام الواتساب وإيداعها فوراً.
 * تم إلغاء الذكاء الاصطناعي بناءً على طلب العميل للاعتماد على ذكاء نظام الواتساب الخارجي.
 */

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        /**
         * البيانات المتوقعة من نظام الواتساب الخاص بك:
         * {
         *   "phone": "77xxxxxxx",
         *   "amount": 5000,
         *   "receiptNumber": "8-1234567"
         * }
         */
        const { phone, amount, receiptNumber } = payload;

        if (!phone || !amount || !receiptNumber) {
            console.error('WhatsApp Webhook: Missing required fields');
            return NextResponse.json({ status: 'invalid_data', message: 'phone, amount, and receiptNumber are required' });
        }

        // تنظيف رقم الهاتف (آخر 9 أرقام)
        const cleanPhone = phone.replace(/\D/g, '').slice(-9);

        const { firestore } = initializeServerFirebase();

        // 1. البحث عن المستخدم بالرقم
        const userQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanPhone));
        const userSnap = await getDocs(userQ);

        if (userSnap.empty) {
            console.warn(`User not found for phone: ${cleanPhone}`);
            return NextResponse.json({ status: 'user_not_found' });
        }

        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        // 2. التحقق من تكرار رقم الإيصال (Idempotency)
        const txQ = query(collection(firestore, 'users', userId, 'transactions'), where('transid', '==', receiptNumber));
        const txSnap = await getDocs(txQ);
        
        if (!txSnap.empty) {
            return NextResponse.json({ status: 'duplicate_transaction' });
        }

        // 3. تنفيذ الإيداع المباشر
        const batch = writeBatch(firestore);
        const now = new Date().toISOString();
        const numAmount = parseFloat(amount);

        // تحديث الرصيد
        batch.update(userDoc.ref, { balance: increment(numAmount) });

        // تسجيل العملية في السجل
        const txRef = doc(collection(firestore, `users/${userId}/transactions`));
        batch.set(txRef, {
            userId: userId,
            transactionDate: now,
            amount: numAmount,
            transactionType: 'شحن تلقائي (واتساب)',
            notes: `تم التأكيد عبر الواتساب - رقم الإشعار: ${receiptNumber}`,
            transid: receiptNumber
        });

        // إرسال إشعار داخلي للتطبيق
        const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
        batch.set(notifRef, {
            title: 'تم شحن رصيدك ✅',
            body: `بناءً على تأكيد الواتساب، أضفنا ${numAmount.toLocaleString()} ريال لحسابك.`,
            timestamp: now
        });

        await batch.commit();

        console.log(`Successfully credited ${numAmount} to user ${cleanPhone}`);

        return NextResponse.json({ 
            success: true, 
            processed: true, 
            amount: numAmount,
            user: userData.displayName 
        });

    } catch (error: any) {
        console.error('WhatsApp Webhook Critical Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
