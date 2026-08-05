import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

/**
 * @fileOverview مستقبل شحن الرصيد التلقائي (v2.0)
 * يستخدم Firebase Admin لتجاوز قيود الحماية وإضافة الرصيد مباشرة.
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];
  
  const projectId = process.env.FIREBASE_PROJECT_ID || "studio-239662212-1b7b6";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    // Fallback if env vars are missing - note: in production these MUST be in Vercel
    console.warn("⚠️ Admin SDK credentials missing, using default initialization.");
    return null;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, amount, receiptNumber } = body;

    if (!phone || !amount || !receiptNumber) {
      return NextResponse.json({ success: false, message: 'بيانات ناقصة' }, { status: 400 });
    }

    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-9);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, message: 'مبلغ غير صحيح' }, { status: 400 });
    }

    const app = getAdminApp();
    if (!app) {
        return NextResponse.json({ success: false, message: 'فشل تهيئة السيرفر - تأكد من مفاتيح Admin في فيرسل' }, { status: 500 });
    }

    const db = admin.firestore(app);

    // 1. البحث عن المستخدم
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('phoneNumber', '==', cleanPhone).limit(1).get();

    if (userSnapshot.empty) {
      return NextResponse.json({ success: false, message: 'الرقم غير مسجل' }, { status: 404 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;

    // 2. منع التكرار
    const txRef = db.collection('users').doc(userId).collection('transactions');
    const duplicateCheck = await txRef.where('receiptReference', '==', receiptNumber).limit(1).get();

    if (!duplicateCheck.empty) {
      return NextResponse.json({ success: false, message: 'الإيصال مشحون مسبقاً' }, { status: 409 });
    }

    // 3. تنفيذ العملية (الخصم والتسجيل)
    const batch = db.batch();
    const now = new Date().toISOString();

    // تحديث الرصيد
    batch.update(userDoc.ref, { 
        balance: admin.firestore.FieldValue.increment(numericAmount) 
    });

    // تسجيل العملية
    const newTxRef = txRef.doc();
    batch.set(newTxRef, {
        userId,
        transactionDate: now,
        amount: numericAmount,
        transactionType: 'تغذية رصيد (آلي)',
        notes: `تم الشحن تلقائياً للإيصال: ${receiptNumber}`,
        receiptReference: receiptNumber
    });

    // إشعار داخلي
    const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
    batch.set(notifRef, {
        title: 'تم شحن رصيدك ✅',
        body: `تم إضافة ${numericAmount.toLocaleString()} ريال إلى حسابك بنجاح.`,
        timestamp: now
    });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        message: 'تم الشحن بنجاح',
        data: { deposited: numericAmount, receipt: receiptNumber }
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
