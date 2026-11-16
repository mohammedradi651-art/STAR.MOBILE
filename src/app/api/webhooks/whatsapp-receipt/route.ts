import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { sendPushNotificationToUser } from '@/lib/push-notification';

/**
 * @fileOverview المسار الرسمي والنهائي لإيداع الرصيد آلياً عبر بوت الواتساب.
 * 
 * الرابط: https://star26.vercel.app/api/webhooks/whatsapp-receipt
 * الطريقة: POST
 * التوثيق المطلوب في الـ Header:
 * X-API-Key: YOUR_SECRET_WHATSAPP_KEY
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];
  
  const projectId = process.env.FIREBASE_PROJECT_ID || "studio-239662212-1b7b6";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.error("❌ خطأ: مفاتيح Firebase Admin مفقودة.");
    return null;
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
    console.error("❌ فشل تهيئة Firebase Admin:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    // 1. التحقق من مفتاح الأمان في الهيدر
    const apiKey = req.headers.get('X-API-Key');
    const SECRET_KEY = process.env.WHATSAPP_WEBHOOK_SECRET || 'star_default_secret_123';

    if (!apiKey || apiKey !== SECRET_KEY) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const body = await req.json();
    const { phone, amount, receiptNumber } = body;

    // 2. التحقق من البيانات الواردة
    if (!phone || !amount || !receiptNumber) {
      return NextResponse.json({ success: false, message: 'Missing fields: phone, amount, or receiptNumber' }, { status: 400 });
    }

    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-9);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid amount' }, { status: 400 });
    }

    const app = getAdminApp();
    if (!app) {
        return NextResponse.json({ success: false, message: 'Database Connection Error' }, { status: 500 });
    }

    const db = admin.firestore(app);

    // 3. البحث عن المستخدم بالرقم
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('phoneNumber', '==', cleanPhone).limit(1).get();

    if (userSnapshot.empty) {
      return NextResponse.json({ success: false, message: 'User not found in app' }, { status: 404 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    // 4. منع تكرار شحن نفس الإيصال (فحص في المستند الموحد history)
    const historyRef = db.collection('users').doc(userId).collection('transactions').doc('history');
    const histSnap = await historyRef.get();
    const existingList = histSnap.exists ? (histSnap.data()?.list || histSnap.data()?.transactions || []) : [];
    const isDuplicate = existingList.some((t: any) => t.receiptReference === receiptNumber || t.rcpt === receiptNumber);

    if (isDuplicate) {
      return NextResponse.json({ success: false, message: 'Receipt already processed' }, { status: 409 });
    }

    // 5. تنفيذ عملية الإيداع الحقيقية (Atomic Transaction)
    const batch = db.batch();
    const now = new Date().toISOString();

    batch.update(userDoc.ref, { 
        balance: admin.firestore.FieldValue.increment(numericAmount) 
    });

    const txId = `WA-${Date.now()}`;
    const newTxEntry = {
        id: txId,
        userId,
        transactionDate: now,
        date: now,
        amount: numericAmount,
        a: numericAmount,
        transactionType: 'تغذية رصيد (آلي)',
        t: 'تغذية رصيد (آلي)',
        notes: `شحن آلي للإيصال: ${receiptNumber}`,
        receiptReference: receiptNumber,
        rcpt: receiptNumber,
        status: 'success',
        readiness: 'جاهزة'
    };

    const updatedList = [newTxEntry, ...existingList];
    batch.set(historyRef, {
        list: updatedList,
        transactions: updatedList,
        lastUpdated: now,
        schema: 'compact_v1'
    }, { merge: true });

    await batch.commit();

    // إرسال إشعار سحابي FCM فوري وتوثيقه في المستند الموحد
    try {
        await sendPushNotificationToUser(null, userId, {
            title: 'تم شحن رصيدك بنجاح ✅',
            body: `تم إضافة ${numericAmount.toLocaleString()} ريال إلى حسابك عبر الواتساب.`,
            transid: txId,
            status: 'success',
            amount: numericAmount,
        });
    } catch (_) {}

    return NextResponse.json({ 
        success: true, 
        message: 'Deposit successful',
        data: { 
            userName: userData.displayName,
            deposited: numericAmount, 
            newBalance: (userData.balance || 0) + numericAmount
        }
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
