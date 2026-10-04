import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, writeBatch, increment } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-239662212-1b7b6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-239662212-1b7b6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-239662212-1b7b6.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "330089855562",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:330089855562:web:6565f4922129a0083163eb"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export async function POST(request: Request) {
  try {
    const { transid } = await request.json();
    if (!transid) {
      return NextResponse.json({ success: false, message: 'رقم العملية transid مطلوب' }, { status: 400 });
    }

    const txDocRef = doc(firestore, 'paymentTransactions', transid);
    const txSnap = await getDoc(txDocRef);

    if (!txSnap.exists()) {
      return NextResponse.json({ success: false, message: 'العملية غير موجودة' }, { status: 404 });
    }

    const txData = txSnap.data();
    if (txData.status !== 'pending' && txData.readiness !== 'قيد الانتظار') {
      return NextResponse.json({ 
        success: true, 
        alreadyProcessed: true, 
        status: txData.status, 
        readiness: txData.readiness,
        message: 'تم تحديث هذه العملية مسبقاً' 
      });
    }

    // استعلام حالة العملية مباشرة من مزود الخدمة
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const telecomRes = await fetch(`${protocol}://${host}/api/telecom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        transid: transid,
        mobile: txData.recipientPhoneNumber
      })
    });

    const data = await telecomRes.json();
    const isBan = data.isBan === 1 || data.isBan === '1';
    const isDone = data.isDone === 1 || data.isDone === '1';

    if (isBan) {
      // المزود ألغى العملية -> تحويل إلى فاشلة وإرجاع الرصيد
      if (txData.refunded) {
        return NextResponse.json({ success: true, status: 'failed', readiness: 'فاشلة', message: 'العملية ملغية ومستردة مسبقاً' });
      }

      const cancellationReason = data.reason || data.resultDesc || 'تم إلغاء العملية من المزود';
      const currentNotes = txData.notes || '';
      const updatedNotes = currentNotes
        ? `${currentNotes}\nالسبب من المزود: ${cancellationReason}`
        : `السبب من المزود: ${cancellationReason}`;

      const updatePayload = {
        status: 'failed',
        readiness: 'فاشلة',
        refunded: true,
        providerMessage: cancellationReason,
        notes: updatedNotes,
        failedAt: new Date().toISOString()
      };

      const batch = writeBatch(firestore);
      if (txData.userId && txData.amount > 0) {
        const userRef = doc(firestore, 'users', txData.userId);
        batch.update(userRef, { balance: increment(txData.amount) });
      }
      batch.update(txDocRef, updatePayload);
      if (txData.userId) {
        const userTxRef = doc(firestore, `users/${txData.userId}/transactions`, transid);
        batch.update(userTxRef, updatePayload);
      }
      await batch.commit();

      return NextResponse.json({
        success: true,
        status: 'failed',
        readiness: 'فاشلة',
        refunded: true,
        amount: txData.amount,
        reason: cancellationReason,
        message: 'تم تأكيد إلغاء العملية من المزود وإرجاع الرصيد للعميل بنجاح'
      });
    }

    if (isDone) {
      // المزود نفذ العملية بنجاح -> تحويل إلى جاهزة
      const updatePayload = {
        status: 'success',
        readiness: 'جاهزة',
        providerMessage: data.resultDesc || 'تم تنفيذ العملية بنجاح من المزود',
        completedAt: new Date().toISOString()
      };

      const batch = writeBatch(firestore);
      batch.update(txDocRef, updatePayload);
      if (txData.userId) {
        const userTxRef = doc(firestore, `users/${txData.userId}/transactions`, transid);
        batch.update(userTxRef, updatePayload);
      }
      await batch.commit();

      return NextResponse.json({
        success: true,
        status: 'success',
        readiness: 'جاهزة',
        message: 'تم تأكيد نجاح العملية من المزود بنجاح'
      });
    }

    return NextResponse.json({
      success: true,
      pending: true,
      message: data.resultDesc || 'العملية ما زالت قيد المعالجة لدى المزود'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
