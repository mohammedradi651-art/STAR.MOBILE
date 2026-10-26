import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { doc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { formatProviderErrorMessage } from '@/lib/telecom-order';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { transid } = await request.json();
    if (!transid) {
      return NextResponse.json({ success: false, message: 'رقم العملية transid مطلوب' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();

    const cleanTransId = String(transid).trim();
    const txDocRef = doc(firestore, 'paymentTransactions', cleanTransId);
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
        refunded: Boolean(txData.refunded),
        message: txData.readiness === 'جاهزة' || txData.status === 'success' 
          ? 'تم تأكيد نجاح العملية مسبقاً' 
          : 'تم إلغاء هذه العملية مسبقاً' 
      });
    }

    // استعلام حالة العملية مباشرة من مزود الخدمة
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const telecomRes = await fetch(`${protocol}://${host}/api/telecom`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-app-source': 'internal'
      },
      body: JSON.stringify({
        action: 'status',
        transid: cleanTransId,
        mobile: txData.recipientPhoneNumber || txData.phoneNumber
      })
    });

    const data = await telecomRes.json();

    // إذا فشل الاتصال التقني بـ telecom أو كانت نتيجة استعلام شبكة وليست رداً حقيقياً من المزود
    const rawMsg = data.message || data.resultDesc || '';
    const isNetworkErr =
      telecomRes.status >= 500 ||
      rawMsg.includes('fetch failed') ||
      rawMsg.includes('تعذر الاتصال') ||
      rawMsg.includes('اتصال') ||
      rawMsg.includes('timeout') ||
      rawMsg.includes('انتهت المهلة');

    if (isNetworkErr) {
      // الاتصال بمزود الخدمة غير متاح حالياً لفحص الحالة -> تظل العملية قيد الانتظار دون مساس بحالتها أو الرصيد
      return NextResponse.json({
        success: true,
        pending: true,
        status: 'pending',
        readiness: 'قيد الانتظار',
        message: 'العملية ما زالت قيد المعالجة لدى المزود'
      });
    }

    const isBan =
      data.isBan === 1 ||
      data.isBan === '1' ||
      data.action === 'ban' ||
      data.status === 'ban' ||
      (data.status === 'failed' && data.refunded);

    const isDone =
      data.isDone === 1 ||
      data.isDone === '1' ||
      data.action === 'done' ||
      data.status === 'done' ||
      data.status === 'success' ||
      data.readiness === 'جاهزة';

    if (isBan) {
      // المزود ألغى العملية -> تحويل إلى فاشلة وإرجاع الرصيد إن لم يُسترجع
      const cancellationReason = formatProviderErrorMessage(data.reason || data.resultDesc || data.message || 'تم إلغاء العملية من المزود');
      const currentNotes = txData.notes || '';
      const cleanNotes = currentNotes.replace(/\(قيد الانتظار\)/g, '').trim();
      const updatedNotes = cleanNotes
        ? `${cleanNotes}\nالسبب من المزود: ${cancellationReason}`
        : `السبب من المزود: ${cancellationReason}`;

      const updatePayload = {
        status: 'failed',
        readiness: 'فاشلة',
        refunded: true,
        providerMessage: cancellationReason,
        notes: updatedNotes,
        failedAt: new Date().toISOString()
      };

      const shouldRefund = !txData.refunded && !data.refunded && Number(txData.amount || 0) > 0;

      const batch = writeBatch(firestore);
      if (shouldRefund && txData.userId) {
        const userRef = doc(firestore, 'users', txData.userId);
        batch.update(userRef, { balance: increment(Number(txData.amount)) });
      }
      batch.set(txDocRef, updatePayload, { merge: true });
      if (txData.userId) {
        const userTxRef = doc(firestore, `users/${txData.userId}/transactions`, cleanTransId);
        batch.set(userTxRef, updatePayload, { merge: true });
      }
      await batch.commit();

      return NextResponse.json({
        success: true,
        status: 'failed',
        readiness: 'فاشلة',
        refunded: true,
        amount: txData.amount,
        reason: cancellationReason,
        message: 'تم رفض العملية من المزود وإرجاع الرصيد'
      });
    }

    if (isDone) {
      // المزود نفذ العملية بنجاح -> تحويل إلى جاهزة
      const currentNotes = txData.notes || '';
      const cleanNotes = currentNotes.replace(/\(قيد الانتظار\)/g, '').trim();

      const updatePayload = {
        status: 'success',
        readiness: 'جاهزة',
        notes: cleanNotes,
        providerMessage: data.resultDesc || data.message || 'تم تنفيذ العملية بنجاح من المزود',
        completedAt: new Date().toISOString()
      };

      const batch = writeBatch(firestore);
      batch.set(txDocRef, updatePayload, { merge: true });
      if (txData.userId) {
        const userTxRef = doc(firestore, `users/${txData.userId}/transactions`, cleanTransId);
        batch.set(userTxRef, updatePayload, { merge: true });
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
      status: 'pending',
      readiness: 'قيد الانتظار',
      message: data.message || data.resultDesc || 'العملية ما زالت قيد المعالجة لدى المزود'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
