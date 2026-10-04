import { doc, getDoc, updateDoc, increment, setDoc, writeBatch, type Firestore } from 'firebase/firestore';

/**
 * الخدمات الثمان المعتمدة التي تظهر لها الجاهزية ونظام الـ Webhook:
 * 1. يمن موبايل
 * 2. يو (YOU)
 * 3. سبافون (سبأفون)
 * 4. واي
 * 5. يمن فورجي
 * 6. عدن نت
 * 7. الثابت والإنترنت الأرضي
 * 8. الألعاب
 */
export const TELECOM_SERVICES = [
  'يمن موبايل',
  'يو',
  'سبافون',
  'واي',
  'يمن فورجي',
  'عدن نت',
  'الثابت والانترنت الارضي',
  'الالعاب'
] as const;

/**
 * التحقق مما إذا كانت العملية تنتمي للخدمات الثمان المحددة فقط
 */
export function isTelecomService(transactionType?: string | null): boolean {
  if (!transactionType) return false;
  const t = transactionType.toLowerCase().trim();

  // استبعاد عمليات الحسابات العامة والكروت والتحويلات والتغذية
  if (t.includes('تغذية') || t.includes('إيداع') || t.includes('تحويل') || t.includes('استلام') || t.includes('شراء كرت') || t.includes('شبكات')) {
    return false;
  }

  return (
    t.includes('يمن موبايل') ||
    t.includes('موبايل') ||
    t.includes('يو') ||
    t.includes('you') ||
    t.includes('mtn') ||
    t.includes('سبافون') ||
    t.includes('سبأفون') ||
    t.includes('واي') ||
    t.includes('why') ||
    t.includes('فورجي') ||
    t.includes('4g') ||
    t.includes('عدن نت') ||
    t.includes('عدن-نت') ||
    t.includes('aden net') ||
    t.includes('aden-net') ||
    t.includes('هاتف ثابت') ||
    t.includes('الثابت') ||
    t.includes('انترنت') ||
    t.includes('إنترنت') ||
    t.includes('أرضي') ||
    t.includes('ارضي') ||
    t.includes('adsl') ||
    t.includes('فايبر') ||
    t.includes('ألعاب') ||
    t.includes('العاب') ||
    t.includes('شدات') ||
    t.includes('جواهر') ||
    t.includes('ببجي') ||
    t.includes('فري فاير')
  );
}

export type ReadinessStatus = 'success' | 'pending' | 'failed';

export interface ReadinessInfo {
  text: 'جاهزة' | 'قيد الانتظار' | 'فاشلة';
  status: ReadinessStatus;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

/**
 * تحديد الجاهزية ولونها:
 * - جاهزة -> أخضر
 * - قيد الانتظار -> أصفر / عنبري
 * - فاشلة -> أحمر
 */
export function getReadinessDetails(tx: any): ReadinessInfo {
  const status = (tx?.status || '').toString().toLowerCase().trim();
  const readiness = (tx?.readiness || '').toString().trim();

  if (status === 'success' || status === 'done' || status === 'completed' || readiness === 'جاهزة') {
    return {
      text: 'جاهزة',
      status: 'success',
      colorClass: 'text-green-600',
      bgClass: 'bg-green-500/10 text-green-600 border-green-500/20',
      borderClass: 'border-green-500'
    };
  }

  if (status === 'pending' || readiness === 'قيد الانتظار') {
    return {
      text: 'قيد الانتظار',
      status: 'pending',
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      borderClass: 'border-amber-500'
    };
  }

  if (status === 'failed' || status === 'ban' || status === 'cancelled' || readiness === 'فاشلة' || tx?.refunded) {
    return {
      text: 'فاشلة',
      status: 'failed',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-500/10 text-red-600 border-red-500/20',
      borderClass: 'border-red-500'
    };
  }

  // في حال كانت عملية سابقة مكتملة لا تحتوي على حقل status
  return {
    text: 'جاهزة',
    status: 'success',
    colorClass: 'text-green-600',
    bgClass: 'bg-green-500/10 text-green-600 border-green-500/20',
    borderClass: 'border-green-500'
  };
}

/**
 * إنشاء رقم مرجع للعملية فريد من 10 أرقام
 */
export function generateTransId(): string {
  const timePart = Date.now().toString().slice(-8);
  const randPart = Math.floor(10 + Math.random() * 90).toString();
  return `${timePart}${randPart}`;
}

/**
 * إنشاء سر Backpass فريد خاص بكل عملية
 */
export function generateBackpass(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BP${Date.now().toString().slice(-6)}${rand}`;
}

export interface InitiatePaymentParams {
  firestore: Firestore;
  userId: string;
  amount: number;
  transactionType: string;
  recipientPhoneNumber: string;
  notes?: string;
  serviceCategory: string;
}

/**
 * تسجيل العملية فوراً وخصم الرصيد قبل انتظار نتيجة المزود
 */
export async function initiateTelecomPayment({
  firestore,
  userId,
  amount,
  transactionType,
  recipientPhoneNumber,
  notes,
  serviceCategory
}: InitiatePaymentParams): Promise<{ transid: string; backpass: string; txId: string }> {
  const transid = generateTransId();
  const backpass = generateBackpass();
  const createdAt = new Date().toISOString();

  const userDocRef = doc(firestore, 'users', userId);
  const userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
  const globalTxRef = doc(firestore, 'paymentTransactions', transid);

  const initialNotes = notes || `إلى رقم: ${recipientPhoneNumber}. المبلغ: ${amount}.`;

  const txData = {
    id: transid,
    userId: userId,
    transactionDate: createdAt,
    createdAt: createdAt,
    amount: amount,
    transactionType: transactionType,
    notes: initialNotes,
    recipientPhoneNumber: recipientPhoneNumber,
    transid: transid,
    backpass: backpass,
    status: 'pending',
    readiness: 'قيد الانتظار',
    balanceProcessed: true,
    refunded: false,
    serviceCategory: serviceCategory
  };

  const batch = writeBatch(firestore);
  batch.update(userDocRef, { balance: increment(-amount) });
  batch.set(userTxRef, txData);
  batch.set(globalTxRef, txData);

  await batch.commit();

  return { transid, backpass, txId: transid };
}

/**
 * وضع علامة نجاح على العملية بعد رد المزود
 */
export async function markPaymentSuccess(
  firestore: Firestore,
  userId: string,
  transid: string,
  providerMessage?: string
) {
  try {
    const userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
    const globalTxRef = doc(firestore, 'paymentTransactions', transid);
    const updateData = {
      status: 'success',
      readiness: 'جاهزة',
      providerMessage: providerMessage || 'تم تنفيذ العملية بنجاح',
      completedAt: new Date().toISOString()
    };
    const batch = writeBatch(firestore);
    batch.update(userTxRef, updateData);
    batch.update(globalTxRef, updateData);
    await batch.commit();
  } catch (err) {
    console.error('Failed to mark payment success:', err);
  }
}

/**
 * وضع علامة فشل وإرجاع المبلغ للعميل فوراً وتحديث الملاحظات بسبب الرفض
 */
export async function markPaymentFailedAndRefund(
  firestore: Firestore,
  userId: string,
  transid: string,
  amount: number,
  reason: string
) {
  try {
    const userDocRef = doc(firestore, 'users', userId);
    const userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
    const globalTxRef = doc(firestore, 'paymentTransactions', transid);

    // التأكد من عدم تكرار الإرجاع
    const snap = await getDoc(userTxRef);
    if (snap.exists() && snap.data().refunded) {
      return;
    }

    const currentNotes = snap.exists() ? (snap.data().notes || '') : '';
    const updatedNotes = currentNotes ? `${currentNotes}\nالسبب من المزود: ${reason}` : `السبب من المزود: ${reason}`;

    const updateData = {
      status: 'failed',
      readiness: 'فاشلة',
      refunded: true,
      providerMessage: reason,
      notes: updatedNotes,
      failedAt: new Date().toISOString()
    };

    const batch = writeBatch(firestore);
    batch.update(userDocRef, { balance: increment(amount) });
    batch.update(userTxRef, updateData);
    batch.update(globalTxRef, updateData);
    await batch.commit();
  } catch (err) {
    console.error('Failed to refund and mark payment failed:', err);
  }
}

/**
 * تنفيذ طلب المزود مع مؤقت 10 ثوانٍ:
 * - إذا استجاب المزود خلال 10 ثوانٍ بالنجاح: يتم تعيين الحالة جاهزة وإظهار المنبثق
 * - إذا استجاب المزود بالرفض خلال 10 ثوانٍ: يتم إرجاع المبلغ فوراً وإلغاء العملية ورفع الخطأ
 * - إذا تأخر الرد أكثر من 10 ثوانٍ: تبقى العملية معلقة (قيد الانتظار) ويتم إظهار نفس المنبثق تماماً
 */
export async function executeTelecomRequestWithTimeout({
  firestore,
  userId,
  transid,
  amount,
  telecomPayload,
  backpass
}: {
  firestore: Firestore;
  userId: string;
  transid: string;
  amount: number;
  telecomPayload: any;
  backpass: string;
}): Promise<{ isDelayed: boolean; providerResult?: any }> {
  const BACKURL = 'https://star26.vercel.app/api/payment/webhook';

  const fullPayload = {
    ...telecomPayload,
    transid,
    backpass,
    backurl: BACKURL
  };

  // مهلة 10 ثوانٍ
  const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
    setTimeout(() => resolve({ timeout: true }), 10000);
  });

  const fetchPromise = (async () => {
    try {
      const response = await fetch('/api/telecom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload)
      });
      const data = await response.json();
      return { timeout: false, ok: response.ok, data };
    } catch (e: any) {
      return { timeout: false, ok: false, data: { message: e.message } };
    }
  })();

  const raceResult: any = await Promise.race([fetchPromise, timeoutPromise]);

  if (raceResult.timeout) {
    // تأخر الرد أكثر من 10 ثوانٍ -> إظهار منبثق النجاح والعملية تبقى قيد الانتظار
    console.warn(`[Telecom] Trans ${transid} exceeded 10s. Showing success popup as pending.`);
    return { isDelayed: true };
  }

  const { ok, data } = raceResult;

  const isSuccess =
    ok &&
    (data?.resultCode === '0' ||
      data?.resultCode === 0 ||
      data?.resultCode === '-2' ||
      data?.resultCode === -2 ||
      data?.status === 'success' ||
      data?.action === 'done');

  if (isSuccess) {
    await markPaymentSuccess(firestore, userId, transid, data?.resultDesc || data?.message);
    return { isDelayed: false, providerResult: data };
  } else {
    // فشل من المزود خلال الـ 10 ثوانٍ -> إرجاع الفلوس وتحديث الملاحظات
    const providerError = data?.resultDesc || data?.message || 'تم رفض العملية من قبل مزود الخدمة.';
    await markPaymentFailedAndRefund(firestore, userId, transid, amount, providerError);
    throw new Error(providerError);
  }
}
