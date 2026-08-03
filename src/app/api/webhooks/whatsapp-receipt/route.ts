
import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';
import { processAlomqyReceipt } from '@/ai/flows/process-alomqy-receipt-flow';

/**
 * @fileOverview محرك الشحن التلقائي عبر الواتساب (v1.0)
 * يستقبل الصور من Wassenger، يحللها بالذكاء الاصطناعي، ويشحن رصيد العميل فوراً.
 */

async function imageUrlToBase64(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('فشل تحميل صورة الإيصال من السيرفر.');
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
}

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        // 1. التحقق من أن الرسالة واردة وتحتوي على وسائط (صورة)
        if (payload.event !== 'message:in:new' || !payload.data?.media?.url) {
            return NextResponse.json({ status: 'ignored' });
        }

        const senderPhone = payload.data.from; // الرقم الدولي للمرسل
        const mediaUrl = payload.data.media.url;
        const cleanPhone = senderPhone.replace(/\D/g, '').slice(-9); // استخراج آخر 9 أرقام (7xxxxxxxx)

        const { firestore } = initializeServerFirebase();

        // 2. البحث عن المستخدم في قاعدة البيانات
        const userQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanPhone));
        const userSnap = await getDocs(userQ);

        if (userSnap.empty) {
            console.log(`User not found for phone: ${cleanPhone}`);
            return NextResponse.json({ status: 'user_not_found' });
        }

        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        // 3. تحليل الإيصال باستخدام الذكاء الاصطناعي
        const base64Image = await imageUrlToBase64(mediaUrl);
        const aiResult = await processAlomqyReceipt({ receiptImage: base64Image });

        if (!aiResult.isAlomqy || !aiResult.amount || !aiResult.receiptNumber) {
            console.warn('AI failed to validate receipt content');
            return NextResponse.json({ status: 'invalid_receipt' });
        }

        // 4. التحقق من تكرار العملية (Idempotency)
        const txQ = query(collection(firestore, 'users', userId, 'transactions'), where('transid', '==', aiResult.receiptNumber));
        const txSnap = await getDocs(txQ);
        
        if (!txSnap.empty) {
            return NextResponse.json({ status: 'duplicate_transaction' });
        }

        // 5. تنفيذ الشحن الآلي
        const batch = writeBatch(firestore);
        const now = new Date().toISOString();
        const amount = aiResult.amount;

        // تحديث الرصيد
        batch.update(userDoc.ref, { balance: increment(amount) });

        // تسجيل العملية
        const txRef = doc(collection(firestore, `users/${userId}/transactions`));
        batch.set(txRef, {
            userId,
            transactionDate: now,
            amount: amount,
            transactionType: 'تغذية تلقائية (إيصال)',
            notes: `رقم السند: ${aiResult.receiptNumber} - تم عبر الواتساب`,
            transid: aiResult.receiptNumber
        });

        // إرسال إشعار داخلي
        const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
        batch.set(notifRef, {
            title: 'تم شحن حسابك تلقائياً',
            body: `بناءً على إيصالك المرسل، تمت إضافة مبلغ ${amount.toLocaleString()} ريال لحسابك بنجاح.`,
            timestamp: now
        });

        await batch.commit();

        // 6. إرسال رسالة تأكيد للعميل عبر الواتساب
        const confirmationMsg = `⭐ ستار موبايل\n\nمرحباً ${userData.displayName || 'عميلنا'}\n\nتم تأكيد إيصالك وشحن حسابك تلقائياً ✅\n\nالمبلغ المضاف: ${amount.toLocaleString()} ر.ي\nرصيدك الجديد: ${(userData.balance + amount).toLocaleString()} ر.ي\n\nشكراً لاستخدامك النظام الآلي 💙`;
        
        await fetch(`${new URL(req.url).origin}/api/send-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: cleanPhone,
                message: confirmationMsg
            })
        });

        return NextResponse.json({ success: true, processed: true, amount });

    } catch (error: any) {
        console.error('WhatsApp Webhook AI Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
