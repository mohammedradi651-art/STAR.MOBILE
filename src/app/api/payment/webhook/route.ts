import { NextRequest, NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import {
  collection,
  doc,
  getDoc,
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
 * يستقبل طلبات GET (ويدعم POST) بالصيغة:
 * ?action=xxx&backpass=xxx&transid=xxx&message=xxx
 * 
 * action:
 * - done: تحديث العملية إلى جاهزة (نجاح)
 * - ban: تحديث العملية إلى فاشلة وإرجاع الرصيد للعميل
 */

export const dynamic = 'force-dynamic';

interface ExtractedParams {
  action: string | null;
  backpass: string | null;
  transid: string | null;
  message: string | null;
}

/**
 * استخراج المرادفات بمرونة تامة ودون حساسية لحالة الأحرف
 */
function extractFromSearchParams(searchParams: URLSearchParams, names: string[]): string | null {
  for (const [key, value] of searchParams.entries()) {
    if (names.some(n => n.toLowerCase() === key.toLowerCase().trim())) {
      const clean = String(value || '').trim();
      if (clean) return clean;
    }
  }
  return null;
}

/**
 * استخراج المتغيرات من نص الـ URL الخام في حال كانت التشفيرات غير قياسية أو مكررة
 */
function extractFromRawUrl(urlStr: string, names: string[]): string | null {
  try {
    const qIndex = urlStr.indexOf('?');
    if (qIndex === -1) return null;
    const rawQuery = urlStr.substring(qIndex + 1);
    const pairs = rawQuery.split('&');
    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const key = decodeURIComponent(pair.substring(0, equalIndex)).trim().toLowerCase();
        if (names.some(n => n.toLowerCase() === key)) {
          const val = decodeURIComponent(pair.substring(equalIndex + 1)).trim();
          if (val) return val;
        }
      }
    }
  } catch (e) {
    // تجاهل أخطاء فك التشفير
  }
  return null;
}

async function parseIncomingRequest(request: NextRequest): Promise<{
  params: ExtractedParams;
  rawUrl: string;
  method: string;
  bodyPayload?: any;
}> {
  const method = request.method;
  const rawUrl = request.url;
  const nextUrlParams = request.nextUrl.searchParams;
  const parsedUrlParams = new URL(request.url).searchParams;

  let bodyPayload: any = null;
  if (method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        bodyPayload = await request.json();
      } catch (e) {
        // ليس JSON صالحاً
      }
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        bodyPayload = {};
        formData.forEach((val, key) => {
          bodyPayload[key] = String(val);
        });
      } catch (e) {
        // خطأ قراءة FormData
      }
    } else {
      try {
        const rawText = await request.text();
        if (rawText) {
          const searchParams = new URLSearchParams(rawText);
          bodyPayload = {};
          searchParams.forEach((val, key) => {
            bodyPayload[key] = val;
          });
        }
      } catch (e) {
        // تجاهل
      }
    }
  }

  const findValue = (names: string[]): string | null => {
    // 1. من searchParams
    const fromNextUrl = extractFromSearchParams(nextUrlParams, names);
    if (fromNextUrl) return fromNextUrl;

    const fromParsed = extractFromSearchParams(parsedUrlParams, names);
    if (fromParsed) return fromParsed;

    // 2. من الـ URL الخام
    const fromRaw = extractFromRawUrl(rawUrl, names);
    if (fromRaw) return fromRaw;

    // 3. من الـ Body في حال كان POST
    if (bodyPayload && typeof bodyPayload === 'object') {
      for (const [k, v] of Object.entries(bodyPayload)) {
        if (names.some(n => n.toLowerCase() === k.toLowerCase().trim())) {
          const clean = String(v || '').trim();
          if (clean) return clean;
        }
      }
    }

    return null;
  };

  const action = findValue(['action', 'act', 'status']);
  const backpass = findValue(['backpass', 'back_pass', 'pass', 'password']);
  const transid = findValue(['transid', 'trans_id', 'transId', 'id']);
  const message = findValue(['message', 'msg', 'reason', 'resultDesc', 'notes', 'note']);

  return {
    params: { action, backpass, transid, message },
    rawUrl,
    method,
    bodyPayload
  };
}

async function handleWebhookExecution(
  extracted: ExtractedParams,
  rawUrl: string,
  method: string,
  requestIp: string
): Promise<Response> {
  const { firestore } = initializeServerFirebase();
  const logsRef = collection(firestore, 'webhookLogs');

  const { action, backpass, transid, message } = extracted;

  const logBase: any = {
    receivedAt: new Date().toISOString(),
    rawUrl,
    method,
    action: action || null,
    transid: transid || null,
    message: message || null,
    backpassReceived: Boolean(backpass),
    ip: requestIp
  };

  // 1. التحقق من وجود المدخلات الأساسية
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

  const cleanAction = action.toLowerCase().trim();
  const isDone = ['done', 'success', 'completed', 'ok', '1', 'جاهزة', 'جاهز'].includes(cleanAction);
  const isBan = ['ban', 'failed', 'fail', 'reject', 'rejected', 'cancelled', 'canceled', 'error', '0', 'فاشلة', 'ملغي', 'ملغية'].includes(cleanAction);

  if (!isDone && !isBan) {
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

  // 2. البحث عن العملية بواسطة transid بمرونة شاملة
  const cleanTransId = transid.trim();
  let txDocRef: any = null;
  let userTxRef: any = null;
  let txData: any = null;
  let userId: string = '';

  // أ) البحث المباشر في paymentTransactions/{cleanTransId}
  const directDocRef = doc(firestore, 'paymentTransactions', cleanTransId);
  const directSnap = await getDoc(directDocRef);

  if (directSnap.exists()) {
    txData = directSnap.data();
    userId = txData.userId;
    txDocRef = directDocRef;
    if (userId) {
      userTxRef = doc(firestore, `users/${userId}/transactions`, cleanTransId);
    }
  } else {
    // ب) البحث في paymentTransactions عبر حقل transid (كنص)
    try {
      const qText = query(collection(firestore, 'paymentTransactions'), where('transid', '==', cleanTransId));
      const textSnap = await getDocs(qText);
      if (!textSnap.empty) {
        const found = textSnap.docs[0];
        txData = found.data();
        userId = txData.userId;
        txDocRef = found.ref;
        if (userId) {
          userTxRef = doc(firestore, `users/${userId}/transactions`, cleanTransId);
        }
      }
    } catch (e) {
      console.warn('Error querying paymentTransactions by transid string:', e);
    }

    // ج) البحث في paymentTransactions عبر حقل transid (كرقم إذا كان رقمياً)
    if (!txData && !isNaN(Number(cleanTransId))) {
      try {
        const qNum = query(collection(firestore, 'paymentTransactions'), where('transid', '==', Number(cleanTransId)));
        const numSnap = await getDocs(qNum);
        if (!numSnap.empty) {
          const found = numSnap.docs[0];
          txData = found.data();
          userId = txData.userId;
          txDocRef = found.ref;
          if (userId) {
            userTxRef = doc(firestore, `users/${userId}/transactions`, cleanTransId);
          }
        }
      } catch (e) {
        console.warn('Error querying paymentTransactions by transid number:', e);
      }
    }

    // د) البحث الاحتياطي عبر Collection Group في حال لم توجد في الفهرس المباشر
    if (!txData) {
      try {
        const qGroup = query(collectionGroup(firestore, 'transactions'), where('transid', '==', cleanTransId));
        const groupSnap = await getDocs(qGroup);
        if (!groupSnap.empty) {
          const foundDoc = groupSnap.docs[0];
          txData = foundDoc.data();
          userId = txData.userId || foundDoc.ref.parent.parent?.id;
          userTxRef = foundDoc.ref;
          txDocRef = directDocRef;
        }
      } catch (queryErr) {
        console.error('Error during fallback collectionGroup search:', queryErr);
      }
    }
  }

  if (!txData) {
    await addDoc(logsRef, {
      ...logBase,
      transactionFound: false,
      processingResult: 'rejected_not_found',
      error: `Transaction with transid ${cleanTransId} was not found.`
    });
    return new Response('Transaction not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. التحقق الأمني من كلمة السر Backpass
  const savedBackpass = txData.backpass ? String(txData.backpass).trim() : '';
  const incomingBackpass = backpass.trim();

  // السماح بالتطابق المباشر أو التطابق غير الحساس لحالة الأحرف
  const isBackpassValid =
    !savedBackpass || // إن لم تكن مسجلة مسبقاً (معاملات قديمة) نقبل التحديث
    savedBackpass === incomingBackpass ||
    savedBackpass.toLowerCase() === incomingBackpass.toLowerCase();

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
  if (isDone) {
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
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const currentNotes = txData.notes || '';
    const cleanNotes = currentNotes.replace(/\(قيد الانتظار\)/g, '').trim();

    // تحديث العملية إلى success وتعيين الجاهزية إلى جاهزة
    const updatePayload = {
      status: 'success',
      readiness: 'جاهزة',
      notes: cleanNotes,
      providerMessage: message || 'تم تنفيذ العملية بنجاح',
      completedAt: new Date().toISOString()
    };

    const batch = writeBatch(firestore);
    if (txDocRef) batch.set(txDocRef, updatePayload, { merge: true });
    if (userTxRef) batch.set(userTxRef, updatePayload, { merge: true });
    await batch.commit();

    // إشعار نظام العميل عبر Webhook إذا قام بتمرير backurl
    if (txData.clientBackUrl) {
      try {
        fetch(txData.clientBackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'StarMobile-Webhook/1.0' },
          body: JSON.stringify({
            transid: cleanTransId,
            status: 'success',
            readiness: 'جاهزة',
            amount: amount,
            mobile: txData.recipientPhoneNumber || txData.phoneNumber,
            service: txData.transactionType,
            message: message || 'تم تنفيذ العملية بنجاح'
          })
        }).catch(() => {});
      } catch (e) {}
    }

    await addDoc(logsRef, {
      ...logBase,
      transactionFound: true,
      backpassValid: true,
      previousStatus,
      newStatus: 'success',
      processingResult: 'success_done_applied'
    });

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // 5. معالجة حالة الإلغاء/الفشل: action = ban
  if (isBan) {
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
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const currentNotes = txData.notes || '';
    const cleanNotes = currentNotes.replace(/\(قيد الانتظار\)/g, '').trim();
    const cancellationReason = message || 'تم إلغاء العملية من المزود';
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

    // تنفيذ إرجاع الرصيد وتحديث العملية ذرياً
    const batch = writeBatch(firestore);
    if (userId && amount > 0) {
      const userRef = doc(firestore, 'users', userId);
      batch.update(userRef, { balance: increment(amount) });
    }
    if (txDocRef) batch.set(txDocRef, updatePayload, { merge: true });
    if (userTxRef) batch.set(userTxRef, updatePayload, { merge: true });
    await batch.commit();

    // إشعار نظام العميل عبر Webhook إذا قام بتمرير backurl
    if (txData.clientBackUrl) {
      try {
        fetch(txData.clientBackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'StarMobile-Webhook/1.0' },
          body: JSON.stringify({
            transid: cleanTransId,
            status: 'failed',
            readiness: 'فاشلة',
            amount: amount,
            mobile: txData.recipientPhoneNumber || txData.phoneNumber,
            service: txData.transactionType,
            refunded: true,
            message: cancellationReason
          })
        }).catch(() => {});
      } catch (e) {}
    }

    await addDoc(logsRef, {
      ...logBase,
      transactionFound: true,
      backpassValid: true,
      previousStatus,
      newStatus: 'failed',
      refundAmount: amount,
      processingResult: 'success_ban_refunded'
    });

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/**
 * معالج طلبات GET الواردة من مزود الخدمة
 */
export async function GET(request: NextRequest) {
  try {
    const { params, rawUrl, method } = await parseIncomingRequest(request);
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    return await handleWebhookExecution(params, rawUrl, method, ip);
  } catch (error: any) {
    console.error('Webhook execution fatal error:', error);
    return new Response(`Internal Server Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/**
 * دعم طلبات POST في حال أرسلها المزود كـ POST Body أو Form Data
 */
export async function POST(request: NextRequest) {
  try {
    const { params, rawUrl, method } = await parseIncomingRequest(request);
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    return await handleWebhookExecution(params, rawUrl, method, ip);
  } catch (error: any) {
    console.error('Webhook POST execution fatal error:', error);
    return new Response(`Internal Server Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
