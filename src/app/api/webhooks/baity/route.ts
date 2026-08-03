
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, addDoc } from 'firebase/firestore';

/**
 * @fileOverview مسار استقبال الويب هوك من نظام بيتي (v1.5)
 * الوظيفة: التحقق من صحة الطلب وتسجيل الكرت في حال فشل الاستجابة المباشرة.
 */

// المفتاح السري الذي زودنا به العميل للتحقق من التوقيع
const WEBHOOK_SECRET = 'whsec_8aaea1f3216aea653f8c58dbbb409d6e76e3f59cdbab5f458c5e63c0731e93d7';

function verifySignature(rawBody: string, signatureHeader: string, secret: string) {
    try {
        if (!signatureHeader) return false;
        
        // التوقيع يأتي بتنسيق: t=TIMESTAMP,v1=SIGNATURE
        const parts = signatureHeader.split(',');
        const tPart = parts.find(p => p.startsWith('t='));
        const vPart = parts.find(p => p.startsWith('v1='));

        if (!tPart || !vPart) return false;

        const ts = Number(tPart.split('=')[1]);
        const sig = vPart.split('=')[1];

        // 1. التحقق من صلاحية الوقت (Tolerance: 5 minutes) لمنع هجمات Replay
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - ts) > 300) {
            console.error('Webhook Error: Timestamp expired');
            return false;
        }

        // 2. إنشاء التوقيع المتوقع بناءً على الجسم الخام (Raw Body)
        // الصيغة: HMAC-SHA256(secret, timestamp + "." + rawBody)
        const expected = crypto
            .createHmac('sha256', secret)
            .update(`${ts}.${rawBody}`)
            .digest('hex');

        // 3. مقارنة آمنة زمنياً للتواقيع
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch (e) {
        console.error('Webhook Verification Exception:', e);
        return false;
    }
}

export async function POST(req: Request) {
    const timestamp = new Date().toISOString();
    
    try {
        // قراءة الجسم الخام (ضروري جداً للتحقق من التوقيع قبل أي JSON.parse)
        const rawBody = await req.text();
        const signature = req.headers.get('x-baity-signature') || '';

        if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
            console.error('Security Alert: Invalid Baity Webhook Signature');
            return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const { event, eventId, order } = payload;

        // نحن مهتمون فقط بحدث اكتمال الطلب
        if (event !== 'order.completed') {
            return NextResponse.json({ message: 'Event type not handled' }, { status: 200 });
        }

        const { firestore } = initializeServerFirebase();

        // 1. التحقق من عدم معالجة هذا الحدث مسبقاً (Idempotency)
        const logRef = query(collection(firestore, 'baityWebhookLogs'), where('eventId', '==', eventId));
        const logSnap = await getDocs(logRef);
        if (!logSnap.empty) {
            return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
        }

        // 2. استرجاع معرف المستخدم من المرجع الخارجي
        const userId = order.externalRef;
        const uuidOrder = order.uuidOrder;

        if (!userId) {
            console.warn(`Webhook received without externalRef (userId) for order ${uuidOrder}`);
            return NextResponse.json({ message: 'No user ID provided in externalRef' }, { status: 200 });
        }

        // 3. التحقق من وجود العملية مسبقاً في سجلات المستخدم لمنع الخصم المزدوج
        const txRef = query(collection(firestore, `users/${userId}/transactions`), where('uuidOrder', '==', uuidOrder));
        const txSnap = await getDocs(txRef);

        if (txSnap.empty) {
            // الحالة: الطلب تم بنجاح في بيتي ولكن الرد المباشر لم يصل للتطبيق (انقطاع نت مثلاً)
            // هنا نقوم بتسجيل الكرت وخصم الرصيد يدوياً للمستخدم
            const userRef = doc(firestore, 'users', userId);
            const batch = writeBatch(firestore);
            const amount = order.finalCost;

            batch.update(userRef, { balance: increment(-amount) });
            
            const newTxRef = doc(collection(firestore, `users/${userId}/transactions`));
            batch.set(newTxRef, {
                userId,
                transactionDate: timestamp,
                amount: amount,
                transactionType: `ويب هوك: كرت ${order.class.name}`,
                notes: `شبكة: ${order.class.network.name}`,
                cardNumber: order.card.cardID,
                cardPassword: order.card.cardPass || '',
                uuidOrder: uuidOrder // لحماية idempontency المستقبلية
            });

            await batch.commit();
            console.log(`Webhook successfully recovered order ${uuidOrder} for user ${userId}`);
        } else {
            console.log(`Order ${uuidOrder} was already processed by Direct HTTP Response.`);
        }

        // 4. تسجيل الحدث في الأرشيف العام لضمان عدم تكرار المعالجة
        await addDoc(collection(firestore, 'baityWebhookLogs'), {
            eventId,
            uuidOrder,
            timestamp,
            processed: true,
            recovered: txSnap.empty
        });

        // الرد بالنجاح لإيقاف إعادة المحاولات من "بيتي"
        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Critical Webhook Error:', error.message);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
