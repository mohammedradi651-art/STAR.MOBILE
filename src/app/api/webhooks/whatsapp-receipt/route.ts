import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

/**
 * @fileOverview المسار الرسمي والنهائي لإيداع الرصيد آلياً عبر بوت الواتساب.
 * 
 * الرابط: /api/webhooks/whatsapp-receipt
 * الطريقة: POST
 * الجسم المطلوب: { "phone": "string", "amount": number, "receiptNumber": "string" }
 */

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];
  
  const projectId = process.env.FIREBASE_PROJECT_ID || "studio-239662212-1b7b6";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.error("❌ خطأ: مفاتيح Firebase Admin مفقودة في إعدادات فيرسل.");
    return null;
  }

  // تنظيف ومعالجة المفتاح الخاص لضمان عمله على فيرسل
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
    const body = await req.json();
    const { phone, amount, receiptNumber } = body;

    // 1. التحقق من البيانات الواردة
    if (!phone || !amount || !receiptNumber) {
      return NextResponse.json({ success: false, message: 'بيانات الطلب ناقصة' }, { status: 400 });
    }

    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-9);
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, message: 'المبلغ غير صحيح' }, { status: 400 });
    }

    const app = getAdminApp();
    if (!app) {
        return NextResponse.json({ success: false, message: 'فشل في الاتصال بقاعدة البيانات (Admin Error)' }, { status: 500 });
    }

    const db = admin.firestore(app);

    // 2. البحث عن المستخدم بالرقم
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('phoneNumber', '==', cleanPhone).limit(1).get();

    if (userSnapshot.empty) {
      return NextResponse.json({ success: false, message: 'هذا الرقم غير مسجل في التطبيق' }, { status: 404 });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    // 3. منع تكرار شحن نفس الإيصال
    const txRef = db.collection('users').doc(userId).collection('transactions');
    const duplicateCheck = await txRef.where('receiptReference', '==', receiptNumber).limit(1).get();

    if (!duplicateCheck.empty) {
      return NextResponse.json({ success: false, message: 'هذا الإيصال تم شحنه مسبقاً' }, { status: 409 });
    }

    // 4. تنفيذ عملية الإيداع الحقيقية (Atomic Transaction)
    const batch = db.batch();
    const now = new Date().toISOString();

    // تحديث رصيد المستخدم
    batch.update(userDoc.ref, { 
        balance: admin.firestore.FieldValue.increment(numericAmount) 
    });

    // تسجيل العملية في كشف الحساب
    const newTxRef = txRef.doc();
    batch.set(newTxRef, {
        userId,
        transactionDate: now,
        amount: numericAmount,
        transactionType: 'تغذية رصيد (واتساب)',
        notes: `شحن آلي للإيصال رقم: ${receiptNumber}`,
        receiptReference: receiptNumber,
        status: 'success'
    });

    // إضافة إشعار داخل التطبيق
    const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
    batch.set(notifRef, {
        title: 'تم شحن رصيدك بنجاح ✅',
        body: `تم إضافة ${numericAmount.toLocaleString()} ريال إلى حسابك عبر الواتساب.`,
        timestamp: now,
        type: 'deposit'
    });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        message: 'تمت عملية الإيداع بنجاح',
        data: { 
            userName: userData.displayName,
            deposited: numericAmount, 
            newBalance: (userData.balance || 0) + numericAmount,
            receipt: receiptNumber 
        }
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, message: 'خطأ داخلي: ' + error.message }, { status: 500 });
  }
}
