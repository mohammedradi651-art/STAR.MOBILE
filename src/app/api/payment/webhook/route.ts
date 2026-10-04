import { NextRequest, NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  increment,
  writeBatch,
  addDoc,
  collectionGroup,
  query,
  where,
  getDocs
} from 'firebase/firestore';

/**
 * @fileOverview Webhook / BackURL Endpoint لاستقبال تحديثات المزود الرسمية
 * الرابط الأساسي المعتمد: https://star26.vercel.app/api/payment/webhook
 * 
 * يستقبل طلبات GET بالصيغة:
 * ?action=xxx&backpass=xxx&transid=xxx&message=xxx
 */

export const dynamic = 'force-dynamic';

async function handleWebhook(
  action: string | null,
  backpass: string | null,
  transid: string | null,
  message: string | null,
  requestIp: string
) {
  const { firestore } = initializeServerFirebase();
  const logsRef = collection(firestore, 'webhookLogs');

  const logBase: any = {
    receivedAt: new Date().toISOString(),
    action: action || null,
    transid: transid || null,
    message: message || null,
    backpassReceived: Boolean(backpass),
    ip: requestIp
  };

  // 1. التحقق من المدخلات الأساسية
  if (!transid || !backpass || !action) {
    await addDoc(logsRef, {
      ...logBase,
      processingResult: 'rejected_missing_parameters',
      error: 'Missing required parameters: action, transid, or backpass'
    });
    return new Response('Missing required parameters: action, transid, and backpass are required.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const normalizedAction = action.toLowerCase().trim();
  if (normalizedAction !== 'done' && normalizedAction !== 'ban') {
    await addDoc(logsRef, {
      ...logBase,
      processingResult: 'rejected_invalid_action',
      error: `Invalid action: ${action}. Only 'done' and 'ban' are supported.`
    });
    return new Response('Invalid action: only "done" and "ban" are supported.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 2. البحث عن العملية بواسطة transid
  let txDocRef: any = null;
  let userTxRef: any = null;
  let txData: any = null;
  let userId: string = '';

  // أ) البحث السريع المباشر في paymentTransactions/{transid}
  const globalDocRef = doc(firestore, 'paymentTransactions', transid);
  const globalSnap = await getDoc(globalDocRef);

  if (globalSnap.exists()) {
    txData = globalSnap.data();
    userId = txData.userId;
    txDocRef = globalDocRef;
    if (userId) {
      userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
    }
  } else {
    // ب) البحث الاحتياطي عبر Collection Group في حال لم توجد في الفهرس المباشر
    try {
      const q = query(collectionGroup(firestore, 'transactions'), where('transid', '==', transid));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const foundDoc = querySnap.docs[0];
        txData = foundDoc.data();
        userId = txData.userId || foundDoc.ref.parent.parent?.id;
        userTxRef = foundDoc.ref;
        txDocRef = globalDocRef; // سننشئ أيضاً المستند في paymentTransactions للتسريع مستقبلاً
      }
    } catch (queryErr) {
      console.error('Error during fallback collectionGroup search:', queryErr);
    }
  }

  if (!txData) {
    await addDoc(logsRef, {
      ...logBase,
      transactionFound: false,
      processingResult: 'rejected_not_found',
      error: `Transaction with transid ${transid} was not found.`
    });
    return new Response('Transaction not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. التحقق الأمني الصارم من كلمة السر Backpass
  const savedBackpass = txData.backpass;
  const isBackpassValid = savedBackpass && savedBackpass.trim() === backpass.trim();

  if (!isBackpassValid) {
    await addDoc(logsRef, {
      ...logBase,
      transactionFound: true,
      backpassValid: false,
      processingResult: 'rejected_unauthorized_backpass',
      error: 'Backpass mismatch. Unauthorized webhook request.'
    });
    return new Response('Forbidden: Invalid Backpass.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const previousStatus = txData.status || 'pending';
  const amount = Number(txData.amount || 0);

  // 4. معالجة حالة النجاح: action = done
  if (normalizedAction === 'done') {
    // Idempotency: إذا كانت العملية ناجحة بالفعل، لا تقم بأي تأثير إضافي
    if (previousStatus === 'success' || txData.readiness === 'جاهزة') {
      await addDoc(logsRef, {
        ...logBase,
        transactionFound: true,
        backpassValid: true,
        previousStatus,
        newStatus: 'success',
        processingResult: 'ignored_duplicate_done'
      });
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // إذا كانت العملية تم إلغاؤها سابقاً وحصل تعارض
    if (previousStatus === 'failed' || previousStatus === 'cancelled' || txData.refunded) {
      await addDoc(logsRef, {
        ...logBase,
        transactionFound: true,
        backpassValid: true,
        previousStatus,
        newStatus: previousStatus,
        processingResult: 'ignored_done_after_ban_conflict'
      });
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // تحديث العملية إلى success وتعيين الجاهزية إلى جاهزة (دون إعادة خصم الرصيد لأنه مخصوم سلفاً)
    const updatePayload = {
      status: 'success',
      readiness: 'جاهزة',
      providerMessage: message || 'تم تنفيذ العملية بنجاح',
      completedAt: new Date().toISOString()
    };

    const batch = writeBatch(firestore);
    if (globalDocRef) batch.set(globalDocRef, updatePayload, { merge: true });
    if (userTxRef) batch.update(userTxRef, updatePayload);
    await batch.commit();

    await addDoc(logsRef, {
      ...logBase,
      transactionFound: true,
      backpassValid: true,
      previousStatus,
      newStatus: 'success',
      processingResult: 'success_done_applied'
    });

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // 5. معالجة حالة الإلغاء/الفشل: action = ban
  if (normalizedAction === 'ban') {
    // إذا كانت العملية ناجحة بالفعل، لا يجوز تحويلها إلى فاشلة أو إرجاع الرصيد
    if (previousStatus === 'success' || txData.readiness === 'جاهزة') {
      await addDoc(logsRef, {
        ...logBase,
        transactionFound: true,
        backpassValid: true,
        previousStatus,
        newStatus: 'success',
        processingResult: 'ignored_ban_after_done_conflict'
      });
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // Idempotency: إذا كانت العملية قد عولجت كفاشلة وتم إرجاع الرصيد مسبقاً، امنع تكرار الإرجاع
    if (previousStatus === 'failed' || previousStatus === 'cancelled' || txData.refunded) {
      await addDoc(logsRef, {
        ...logBase,
        transactionFound: true,
        backpassValid: true,
        previousStatus,
        newStatus: 'failed',
        processingResult: 'ignored_duplicate_ban'
      });
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const currentNotes = txData.notes || '';
    const cancellationReason = message || 'تم إلغاء العملية من المزود';
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

    // تنفيذ إرجاع الرصيد وتحديث العملية ذرياً
    const batch = writeBatch(firestore);
    if (userId && amount > 0) {
      const userRef = doc(firestore, 'users', userId);
      batch.update(userRef, { balance: increment(amount) });
    }
    if (globalDocRef) batch.set(globalDocRef, updatePayload, { merge: true });
    if (userTxRef) batch.update(userTxRef, updatePayload);
    await batch.commit();

    await addDoc(logsRef, {
      ...logBase,
      transactionFound: true,
      backpassValid: true,
      previousStatus,
      newStatus: 'failed',
      refundAmount: amount,
      processingResult: 'success_ban_refunded'
    });

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

/**
 * معالج طلبات GET الواردة من مزود الخدمة
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const backpass = searchParams.get('backpass');
    const transid = searchParams.get('transid');
    const message = searchParams.get('message');
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    return await handleWebhook(action, backpass, transid, message, ip);
  } catch (error: any) {
    console.error('Webhook execution fatal error:', error);
    return new Response(`Internal Server Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/**
 * دعم احتياطي لطلبات POST في حال أرسلها المزود كـ POST Body
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let action = url.searchParams.get('action');
    let backpass = url.searchParams.get('backpass');
    let transid = url.searchParams.get('transid');
    let message = url.searchParams.get('message');

    // إذا لم تكن في الـ Query params، فحص الـ Body
    if (!action || !transid || !backpass) {
      try {
        const body = await request.json();
        action = action || body.action;
        backpass = backpass || body.backpass;
        transid = transid || body.transid;
        message = message || body.message;
      } catch (jsonErr) {
        // ليس json
      }
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    return await handleWebhook(action, backpass, transid, message, ip);
  } catch (error: any) {
    console.error('Webhook POST execution fatal error:', error);
    return new Response(`Internal Server Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
