
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, addDoc } from 'firebase/firestore';

/**
 * @fileOverview مسار استقبال الويب هوك من نظام بيتي (v1.5)
 * الوظيفة: التحقق من صحة الطلب وتسجيل الكرت في حال فشل الاستجابة المباشرة.
 */

const WEBHOOK_SECRET = process.env.BAITYNET_WEBHOOK_SECRET || 'whsec_placeholder'; // استبدله بالسر الحقيقي من لوحة بيتي

function verifySignature(rawBody: string, signatureHeader: string, secret: string) {
    try {
        if (!signatureHeader) return false;
        const [tPart, vPart] = signatureHeader.split(',');
        const ts = Number(tPart.split('=')[1]);
        const sig = vPart.split('=')[1];

        // التأكد من أن الفرق الزمني لا يتجاوز 5 دقائق
        if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

        const expected = crypto
            .createHmac('sha256', secret)
            .update(`${ts}.${rawBody}`)
            .digest('hex');

        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch (e) {
        return false;
    }
}

export async function POST(req: Request) {
    const timestamp = new Date().toISOString();
    
    try {
        // 1. قراءة الجسم الخام للطلب للتحقق من التوقيع
        const rawBody = await req.text();
        const signature = req.headers.get('x-baity-signature') || '';

        if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
            console.error('Invalid Baity Webhook Signature');
            return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const { event, eventId, order } = payload;

        if (event !== 'order.completed') {
            return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
        }

        const { firestore } = initializeServerFirebase();

        // 2. منع المعالجة المكررة (Idempotency)
        const logRef = query(collection(firestore, 'baityWebhookLogs'), where('eventId', '==', eventId));
        const logSnap = await getDocs(logRef);
        if (!logSnap.empty) {
            return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
        }

        // 3. محاولة مطابقة الطلب مع مستخدم (عبر externalRef الذي يمثل userId)
        const userId = order.externalRef;
        const uuidOrder = order.uuidOrder;
        
        // التحقق مما إذا كان الطلب مسجلاً مسبقاً في العمليات
        const txRef = query(collection(firestore, 'allTransactions'), where('uuidOrder', '==', uuidOrder));
        const txSnap = await getDocs(txRef);

        if (txSnap.empty && userId) {
            // الطلب لم يُعالج في الاستجابة المباشرة (هنا تكمن قوة الويب هوك)
            const userRef = doc(firestore, 'users', userId);
            const batch = writeBatch(firestore);
            const amount = order.finalCost;

            batch.update(userRef, { balance: increment(-amount) });
            
            const newTxRef = doc(collection(firestore, `users/${userId}/transactions`));
            batch.set(newTxRef, {
                userId,
                transactionDate: timestamp,
                amount: amount,
                transactionType: `ويب هوك: شراء كرت ${order.class.name}`,
                notes: `شبكة: ${order.class.network.name}`,
                cardNumber: order.card.cardID,
                uuidOrder: uuidOrder
            });

            await batch.commit();
            console.log(`Webhook processed recovery for user ${userId}, order ${uuidOrder}`);
        }

        // 4. تسجيل الحدث لضمان عدم التكرار
        await addDoc(collection(firestore, 'baityWebhookLogs'), {
            eventId,
            uuidOrder,
            timestamp,
            processed: true
        });

        return NextResponse.json({ status: 'ok' }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook Error:', error.message);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
