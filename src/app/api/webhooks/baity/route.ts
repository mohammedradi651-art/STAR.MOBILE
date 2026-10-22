import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * @fileOverview مسار استقبال إشعارات الويب هوك من منصة بيتي (Baitynet).
 * 
 * الرابط: https://star26.vercel.app/api/webhooks/baity
 * أو: https://star-mobile.vercel.app/api/webhooks/baity
 * 
 * الترويسات المستلمة:
 * X-Baity-Event: order.completed
 * X-Baity-Event-Id: order.completed:order:...
 * X-Baity-Delivery: ...
 * X-Baity-Attempt: ...
 * X-Baity-Timestamp: 1755512400
 * X-Baity-Signature: t=...,v1=...
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-239662212-1b7b6';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    try {
      return admin.initializeApp({ projectId });
    } catch {
      return null;
    }
  }

  const formattedKey = privateKey.replace(/\\n/g, '\n').trim();

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
    });
  } catch (error) {
    console.error('[Baity Webhook] Failed to initialize Firebase Admin:', error);
    return null;
  }
}

async function getWebhookSecret(db: admin.firestore.Firestore | null): Promise<string | null> {
  const envSecret = process.env.BAITY_WEBHOOK_SECRET || process.env.BAITYNET_WEBHOOK_SECRET;
  if (envSecret && envSecret.trim()) {
    return envSecret.trim();
  }

  if (db) {
    try {
      const settingsDoc = await db.collection('settings').doc('baity').get();
      if (settingsDoc.exists) {
        const val = settingsDoc.data()?.webhookSecret;
        if (val && typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    } catch (e) {
      console.warn('[Baity Webhook] Could not read secret from settings collection:', e);
    }
  }

  return null;
}

async function sendSmsNotification(phone: string, message: string) {
  try {
    let cleanPhone = phone.toString().trim().replace(/\D/g, '');
    while (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.length > 9) cleanPhone = cleanPhone.slice(-9);

    await fetch('https://star-sms.vercel.app/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': 'STAR-OTP-770326828',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message,
      }),
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[Baity Webhook] SMS error:', err);
  }
}

export async function POST(req: Request) {
  try {
    // قراءة الجسم الخام بدقة بالغة قبل أي فك تشفير JSON للحفاظ على التوقيع
    const raw = await req.text();

    const sigHeader = req.headers.get('x-baity-signature') || req.headers.get('X-Baity-Signature');
    if (!sigHeader) {
      console.error('[Baity Webhook] Missing x-baity-signature header');
      return new NextResponse('Missing signature header', { status: 400 });
    }

    // تفكيك ترويسة التوقيع: t=1755512400,v1=5f8a...c2
    const parts = sigHeader.split(',');
    let timestamp = 0;
    let signature = '';

    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k?.trim() === 't') timestamp = Number(v?.trim());
      if (k?.trim() === 'v1') signature = v?.trim();
    }

    if (!timestamp || !signature) {
      console.error('[Baity Webhook] Invalid signature header format:', sigHeader);
      return new NextResponse('Invalid signature header format', { status: 400 });
    }

    // التحقق من الفارق الزمني (أقل من 300 ثانية لمنع هجمات إعادة التشغيل Replay Attacks)
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > 300) {
      console.error(`[Baity Webhook] Timestamp delta > 300s. Current: ${nowSec}, Received: ${timestamp}`);
      return new NextResponse('Timestamp out of range', { status: 400 });
    }

    const app = getAdminApp();
    const db = app ? admin.firestore(app) : null;

    const secret = await getWebhookSecret(db);
    if (!secret) {
      console.error('[Baity Webhook] Secret key (whsec_...) is not configured in BAITY_WEBHOOK_SECRET.');
      return new NextResponse('Webhook secret not configured', { status: 500 });
    }

    // حساب التوقيع المتوقع HMAC-SHA256 لنص "{timestamp}.{raw body}"
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${raw}`)
      .digest('hex');

    // التحقق الثابت في الزمن (timingSafeEqual)
    const ok =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

    if (!ok) {
      console.error('[Baity Webhook] Signature verification failed');
      return new NextResponse('Invalid signature', { status: 400 });
    }

    const eventName = req.headers.get('x-baity-event') || 'order.completed';
    const eventId = req.headers.get('x-baity-event-id');
    const deliveryId = req.headers.get('x-baity-delivery');
    const attempt = req.headers.get('x-baity-attempt');

    // منع تكرار معالجة نفس الحدث (Idempotency)
    if (db && eventId) {
      const eventDocRef = db.collection('baityWebhookEvents').doc(eventId);
      const eventDoc = await eventDocRef.get();
      if (eventDoc.exists) {
        console.log(`[Baity Webhook] Duplicate event ${eventId} received, responding 200 immediately.`);
        return NextResponse.json({ success: true, duplicate: true });
      }

      // حفظ معرّف الحدث
      await eventDocRef.set({
        eventId,
        eventName,
        deliveryId: deliveryId || null,
        attempt: attempt || null,
        receivedAt: new Date().toISOString(),
      });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[Baity Webhook] JSON parse error:', parseErr);
      return new NextResponse('Invalid JSON body', { status: 400 });
    }

    // في حال كان حدث اختباري (Test Webhook)
    if (payload.event === 'test' || !payload.order) {
      console.log('[Baity Webhook] Test event verified successfully.');
      return NextResponse.json({ success: true, message: 'Test webhook verified successfully' });
    }

    const orderData = payload.order;
    const externalRef = orderData?.externalRef;
    const uuidOrder = orderData?.uuidOrder;
    const isCompleted = orderData?.isCompleted;
    const cardData = orderData?.card;

    console.log(`[Baity Webhook] Processing event: ${payload.event || eventName}, externalRef: ${externalRef || 'none'}`);

    if (db && externalRef) {
      const orderRef = db.collection('baityOrders').doc(externalRef);
      const orderSnap = await orderRef.get();

      if (orderSnap.exists) {
        const existingOrder = orderSnap.data() || {};
        const userId = existingOrder.userId;
        const transactionId = existingOrder.transactionId;
        const nowIso = new Date().toISOString();

        if (isCompleted && cardData && cardData.cardID) {
          // 1. تحديث سجل الطلب في baityOrders
          await orderRef.update({
            status: 'completed',
            cardNumber: cardData.cardID,
            cardPass: cardData.cardPass || '',
            uuidOrder: uuidOrder || existingOrder.uuidOrder || '',
            completedAt: nowIso,
            updatedAt: nowIso,
          });

          // 2. تحديث سجل معاملة العميل في transactions
          if (userId && transactionId) {
            const txRef = db.collection('users').doc(userId).collection('transactions').doc(transactionId);
            await txRef.update({
              status: 'completed',
              readiness: 'جاهزة',
              cardNumber: cardData.cardID,
              cardPassword: cardData.cardPass || cardData.cardID,
              completedAt: nowIso,
            });
          }

          // 3. إضافة إشعار داخل التطبيق للعميل
          if (userId) {
            const networkTitle = orderData?.class?.network?.name || existingOrder.networkName || 'الخير';
            const classTitle = orderData?.class?.name || existingOrder.className || '';
            await db.collection('users').doc(userId).collection('notifications').add({
              title: 'تم إصدار كرت الشبكة بنجاح 🎉',
              body: `تم تجهيز كرتك لشبكة: ${networkTitle} (${classTitle})\nرقم الكرت: ${cardData.cardID}`,
              timestamp: nowIso,
              type: 'card_delivered',
              cardNumber: cardData.cardID,
            });
          }

          // 4. إرسال رسالة SMS للعميل إذا توفر رقم جواله
          if (existingOrder.phoneNumber) {
            const shortName = existingOrder.displayName ? existingOrder.displayName.trim().split(/\s+/)[0] : 'عميلنا';
            const networkTitle = orderData?.class?.network?.name || existingOrder.networkName || 'الخير';
            const classTitle = orderData?.class?.name || existingOrder.className || '';
            const smsMsg = `ستار موبايل\nمرحباً ${shortName}،\n\nتم شراء كرت الإنترنت الخاص بك بنجاح.\n\nالشبكة: ${networkTitle}\nالفئة: ${classTitle}\nرقم الكرت: ${cardData.cardID}`;
            sendSmsNotification(existingOrder.phoneNumber, smsMsg);
          }
        } else if (isCompleted === false || payload.event === 'order.failed') {
          // في حال فشل الطلب لدى المزود: إعادة المبلغ لحساب العميل بصمت وتحديث الحالة لفشل
          if (existingOrder.status !== 'failed' && existingOrder.status !== 'refunded') {
            const refundAmount = existingOrder.price || 0;
            if (userId && refundAmount > 0) {
              await db.collection('users').doc(userId).update({
                balance: admin.firestore.FieldValue.increment(refundAmount),
              });

              // إشعار العميل بفشل الإصدار دون ذكر استرجاع الرصيد
              await db.collection('users').doc(userId).collection('notifications').add({
                title: 'تعذر إصدار الكرت ⚠️',
                body: `تعذر إصدار كرت ${existingOrder.className || ''}، يرجى التواصل مع الادارة 770326828`,
                timestamp: nowIso,
                type: 'card_failed',
              });
            }

            await orderRef.update({
              status: 'failed',
              failedAt: nowIso,
              updatedAt: nowIso,
            });

            if (userId && transactionId) {
              await db.collection('users').doc(userId).collection('transactions').doc(transactionId).update({
                status: 'failed',
                readiness: 'فاشلة',
                notes: (existingOrder.notes || '') + ' (فشلت العملية)',
              });
            }
          }
        }
      } else {
        // في حال لم يتم العثور على الطلب في baityOrders، البحث في transactions
        const txGroupQuery = await db.collectionGroup('transactions').where('externalRef', '==', externalRef).limit(1).get();
        if (!txGroupQuery.empty && cardData?.cardID) {
          const txDoc = txGroupQuery.docs[0];
          await txDoc.ref.update({
            status: 'completed',
            cardNumber: cardData.cardID,
            cardPassword: cardData.cardPass || cardData.cardID,
            completedAt: new Date().toISOString(),
          });
        }
      }
    }

    // الرد بـ 200 بنجاح
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Baity Webhook] Exception:', err);
    return new NextResponse('Internal Webhook Error', { status: 500 });
  }
}
