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
 * تنظيف رسالة الرفض من المزود وإزالة البادئات والزوائد التقنية لتبدو واضحة ومهنية للعميل
 */
export function formatProviderErrorMessage(rawMsg: string): string {
  if (!rawMsg) return 'تم رفض العملية من قبل مزود الخدمة.';
  let clean = String(rawMsg).trim();

  // تنظيف التكرارات والبادئات والزوائد
  clean = clean.replace(/^(خطأ من نظام المزود:?\s*)+/gi, '').trim();
  clean = clean.replace(/^Error:?\s*/gi, '').trim();
  clean = clean.replace(/^TypeError:?\s*/gi, '').trim();
  clean = clean.replace(/تمت?\s*إعادة\s*المبلغ[^\n.]*/gi, '').trim();
  clean = clean.replace(/تم\s*استرجاع\s*المبلغ[^\n.]*/gi, '').trim();

  // تحسين رسائل الخطأ الشائعة من المزود إلى نصوص عربية واضحة للعميل
  if (clean.includes('Subscribtion Not Registred In PTC') || clean.includes('not registred') || clean.includes('Not Registered')) {
    return 'الرقم غير مسجل في الخدمة أو غير صحيح لدى مزود الاتصالات.';
  }
  if (clean.includes('User with provided account/MSISDN does not exist') || clean.includes('MSISDN does not exist') || clean.includes('100206')) {
    return 'رقم الحساب أو الهاتف غير مسجل لدى مزود الخدمة.';
  }
  if (clean.includes('GSM_NOT_FOUND') || clean.includes('not found') || clean.includes('Not Found')) {
    return 'الرقم المطلوب غير موجود أو غير مفعل في شبكة الاتصالات.';
  }
  if (clean.includes('balance') && (clean.includes('low') || clean.includes('insufficient') || clean.includes('not enough'))) {
    return 'رصيد المشترك غير كافٍ أو لا يسمح بتنفيذ العملية.';
  }
  if (clean.includes('fetch failed') || clean.includes('Connect Timeout') || clean.includes('ETIMEDOUT') || clean.includes('ConnectTimeoutError')) {
    return 'تعذر الاتصال بمزود الخدمة في الوقت الحالي، يرجى المحاولة لاحقاً.';
  }
  if (clean.includes('Mobile number is required, and must be numeric')) {
    return 'رقم الهاتف مطلوب ويجب أن يحتوي على أرقام فقط.';
  }
  if (clean.includes('Mobile number length must be')) {
    return 'طول رقم الهاتف غير صحيح لهذه الخدمة.';
  }

  return clean || 'تم رفض العملية من قبل مزود الخدمة.';
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

    const cleanReason = formatProviderErrorMessage(reason);
    const currentNotes = snap.exists() ? (snap.data().notes || '') : '';
    const cleanNotes = currentNotes.replace(/\(قيد الانتظار\)/g, '').trim();
    const updatedNotes = cleanNotes ? `${cleanNotes}\nالسبب من المزود: ${cleanReason}` : `السبب من المزود: ${cleanReason}`;

    const updateData = {
      status: 'failed',
      readiness: 'فاشلة',
      refunded: true,
      providerMessage: cleanReason,
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

  // مهلة 25 ثانية لضمان استقبال رد تفعيل الباقات وسداد الاتصالات بنجاح
  const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
    setTimeout(() => resolve({ timeout: true }), 25000);
  });

  const fetchPromise = (async () => {
    try {
      const response = await fetch('/api/telecom', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-app-source': 'internal'
        },
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

  const rawDesc = String(data?.resultDesc || data?.message || '');
  const normDesc = rawDesc.toLowerCase();

  const isExplicitDone =
    data?.status === 'success' ||
    data?.status === 'done' ||
    data?.action === 'done' ||
    data?.isDone === 1 ||
    data?.isDone === '1' ||
    data?.readiness === 'جاهزة' ||
    rawDesc.includes('تم تنفيذ') ||
    rawDesc.includes('تم التنفيذ') ||
    rawDesc.includes('تم السداد') ||
    rawDesc.includes('تم الشحن') ||
    rawDesc.includes('تمت العملية') ||
    rawDesc.includes('بنجاح');

  const isPending =
    !isExplicitDone &&
    (data?.status === 'pending' ||
      data?.status === 'wait' ||
      data?.status === 'waiting' ||
      data?.status === 'process' ||
      data?.status === 'proccess' ||
      data?.status === 'processing' ||
      data?.status === 'proccessing' ||
      data?.readiness === 'قيد الانتظار' ||
      data?.resultCode === '-2' ||
      data?.resultCode === -2 ||
      rawDesc.includes('انتظار') ||
      rawDesc.includes('معالج') ||
      rawDesc.includes('قيد التنفيذ') ||
      rawDesc.includes('جاري التنفيذ') ||
      rawDesc.includes('قيد المعالجة') ||
      rawDesc.includes('جاري المعالجة') ||
      rawDesc.includes('قبول') ||
      rawDesc.includes('معلق') ||
      normDesc.includes('proc') ||
      normDesc.includes('pend') ||
      normDesc.includes('wait') ||
      normDesc.includes('queu') ||
      normDesc.includes('prog'));

  // إذا كان الرد الصادر من الـ API يفيد بأن العملية قيد الانتظار والمعالجة لدى المزود
  if (isPending) {
    console.warn(`[Telecom] Trans ${transid} returned pending status from provider. Showing success popup as pending.`);
    return { isDelayed: true, providerResult: data };
  }

  const isSuccess =
    ok &&
    !isPending &&
    (isExplicitDone ||
      data?.resultCode === '0' ||
      data?.resultCode === 0 ||
      data?.status === 'success' ||
      data?.action === 'done' ||
      data?.isDone === 1 ||
      data?.isDone === '1');

  if (isSuccess) {
    await markPaymentSuccess(firestore, userId, transid, data?.resultDesc || data?.message);
    return { isDelayed: false, providerResult: data };
  } else {
    // فشل من المزود خلال الـ 10 ثوانٍ -> إرجاع الفلوس وتحديث الملاحظات
    const providerError = formatProviderErrorMessage(data?.resultDesc || data?.message || 'تم رفض العملية من قبل مزود الخدمة.');
    await markPaymentFailedAndRefund(firestore, userId, transid, amount, providerError);
    throw new Error(providerError || 'فشلت العملية من المزود');
  }
}

/**
 * قاموس أسماء الباقات المعتمدة لجميع الشركات
 */
export const KNOWN_PACKAGE_NAMES: Record<string, string> = {
  // يمن موبايل - مزايا ثري جي
  'A38394': 'باقة مزايا الشهرية',
  'm_monthly': 'باقة مزايا الشهرية',
  'A64329': 'باقة مزايا الأسبوعية',
  'm_weekly': 'باقة مزايا الأسبوعية',
  'A75328': 'باقة مزايا ماكس الشهرية',
  'm_max': 'باقة مزايا ماكس الشهرية',
  'A33881': 'باقة مزايا تواصل',
  'm_connect': 'باقة مزايا تواصل',
  'A33882': 'باقة مزايا تواصل ماكس',
  'm_connect_max': 'باقة مزايا تواصل ماكس',

  // يمن موبايل - مزايا فورجي
  'A5533822': 'باقة سوبر فورجي',
  'A5533821': 'باقة سوبر فورجي',
  'super_4g': 'باقة سوبر فورجي',
  'A4826': 'باقة مزايا فورجي 24 ساعة',
  'A4825': 'باقة مزايا فورجي 24 ساعة',
  '4g_24h': 'باقة مزايا فورجي 24 ساعة',
  'A88337': 'باقة مزايا فورجي 48 ساعة',
  'A4990003': 'باقة مزايا فورجي 48 ساعة',
  '4g_48h': 'باقة مزايا فورجي 48 ساعة',
  'A88336': 'باقة مزايا فورجي الأسبوعية',
  'A88339': 'باقة مزايا فورجي الأسبوعية',
  '4g_weekly': 'باقة مزايا فورجي الأسبوعية',
  'A3823': 'باقة مزايا توفير الشهرية',
  'A4823': 'باقة مزايا توفير الشهرية',
  'm_tawfeer': 'باقة مزايا توفير الشهرية',
  'A88335': 'باقة مزايا فورجي الشهرية',
  '4g_monthly': 'باقة مزايا فورجي الشهرية',
  'A88441': 'باقة مزايا ماكس فورجي',
  'A88440': 'باقة مزايا ماكس فورجي',
  'm_max_4g': 'باقة مزايا ماكس فورجي',
  'A39053': 'باقة مزايا أعمال فورجي',
  'A49053': 'باقة مزايا أعمال فورجي',
  'm_aamal_4g': 'باقة مزايا أعمال فورجي',
  'A31338': 'باقة 800 رسالة',
  'A41338': 'باقة 800 رسالة',
  'sms_800_pre': 'باقة 800 رسالة',

  // يمن موبايل - نت فورجي
  'A4821': 'باقة نت فورجي 4 جيجا',
  'A4820': 'باقة نت فورجي 4 جيجا',
  'net_4g_4gb': 'باقة نت فورجي 4 جيجا',
  'A4828': 'باقة نت فورجي 8 جيجا',
  'A4822': 'باقة نت فورجي 8 جيجا',
  'net_8g_4gb': 'باقة نت فورجي 8 جيجا',
  'A4830': 'باقة نت فورجي 20 جيجا',
  'A4829': 'باقة نت فورجي 20 جيجا',
  'net_20g_4gb': 'باقة نت فورجي 20 جيجا',
  'A3435': 'باقة نت توفير الأسبوعية 3GB',
  'A44355': 'باقة نت توفير الأسبوعية 3GB',
  'net_tawfeer_weekly': 'باقة نت توفير الأسبوعية 3GB',
  'A3436': 'باقة نت توفير الشهرية 6GB',
  'A44356': 'باقة نت توفير الشهرية 6GB',
  'net_tawfeer_monthly': 'باقة نت توفير الشهرية 6GB',
  'A3825': 'باقة نت توفير 5 جيجا',
  'A4819': 'باقة نت توفير 5 جيجا',
  'net_tawfeer_5gb': 'باقة نت توفير 5 جيجا',
  'A34346': 'باقة نت توفير 11 جيجا',
  'A44345': 'باقة نت توفير 11 جيجا',
  'net_tawfeer_11gb': 'باقة نت توفير 11 جيجا',
  'A3347': 'باقة نت توفير 25 جيجا',
  'A44347': 'باقة نت توفير 25 جيجا',
  'net_tawfeer_25gb': 'باقة نت توفير 25 جيجا',

  // يمن موبايل - نت ثري جي
  'A69329': 'باقة نت ثري جي 150 ميجا',
  'A69351': 'باقة نت ثري جي 150 ميجا',
  'net_150mb': 'باقة نت ثري جي 150 ميجا',
  'A69330': 'باقة نت ثري جي 300 ميجا',
  'A69352': 'باقة نت ثري جي 300 ميجا',
  'net_300mb': 'باقة نت ثري جي 300 ميجا',
  'A69338': 'باقة نت ثري جي 700 ميجا',
  'A69355': 'باقة نت ثري جي 700 ميجا',
  'net_700mb': 'باقة نت ثري جي 700 ميجا',
  'A69345': 'باقة نت ثري جي 1.5 جيجا',
  'A69356': 'باقة نت ثري جي 1.5 جيجا',
  'net_1500mb': 'باقة نت ثري جي 1.5 جيجا',

  // يمن موبايل - فولتي
  'volte_1d': 'باقة فولتي 24 ساعة',
  'A4990004': 'باقة فولتي يومين',
  'volte_2d': 'باقة فولتي يومين',
  'A4990005': 'باقة فولتي أسبوعية',
  'volte_7d': 'باقة فولتي أسبوعية',
  'A4990006': 'باقة فولتي شهرية',
  'volte_30d': 'باقة فولتي شهرية',
  'A33000': 'باقة فولتي اتصال الشهرية',
  'volte_call': 'باقة فولتي اتصال الشهرية',
  'A32000': 'باقة فولتي توفير الشهرية',
  'volte_save': 'باقة فولتي توفير الشهرية',
  'A33883': 'باقة فولتي ماكس الشهرية',
  'volte_max': 'باقة فولتي ماكس الشهرية',

  // يمن موبايل - هدايا
  'A68329': 'باقة هدايا الشهرية',
  'h_monthly': 'باقة هدايا الشهرية',
  'A44330': 'باقة هدايا الأسبوعية',
  'h_weekly': 'باقة هدايا الأسبوعية',
  'A66328': 'باقة هدايا توفير',
  'h_tawfeer': 'باقة هدايا توفير',
  'A76328': 'باقة هدايا ماكس الشهرية',
  'h_max': 'باقة هدايا ماكس الشهرية',

  // يو YOU
  'Sawa_300_PRE': 'باقة السعر الموحد 300',
  'unified_300': 'باقة السعر الموحد 300',
  'Mix_4GB_4G_PRE': 'باقة السعر الموحد 4 جيجا فورجي',
  'unified_4gb': 'باقة السعر الموحد 4 جيجا فورجي',
  'Mix_5Giga_4G_PRE': 'باقة فورجي 5 جيجا',
  '4g_5gb': 'باقة فورجي 5 جيجا',
  'Smart4Giga_4G_PRE': 'باقة سمارت فورجي الأسبوعية',
  'smart_4g_weekly': 'باقة سمارت فورجي الأسبوعية',
  'WafferPlus10_4G_PRE': 'باقة وفر بلس 10 جيجا',
  'waffer_plus_10gb': 'باقة وفر بلس 10 جيجا',
  'Mix_5000_PRE': 'باقة سوا مكس 1200',
  'sawa_mix': 'باقة سوا مكس 1200',
  'Mix_12Giga_4G_PRE': 'فورجي مكس 12 جيجا',
  '4g_mix_12gb': 'فورجي مكس 12 جيجا',
  'Smart15Giga_4G_PRE': 'باقة سمارت فورجي 15 جيجا',
  'smart_4g_15gb': 'باقة سمارت فورجي 15 جيجا',
  'Smart3Giga_3G_PRE': 'باقة سمارت اليومية 3 جيجا',
  'smart_daily': 'باقة سمارت اليومية 3 جيجا',
  '4': 'شحن فوري يو 410 ريال',
  '6': 'شحن فوري يو 830 ريال',
  '11': 'شحن فوري يو 1000 ريال',
  '7': 'شحن فوري يو 1250 ريال',
  '8': 'شحن فوري يو 2500 ريال',
  '9': 'شحن فوري يو 5000 ريال',
  '10': 'شحن فوري يو 7500 ريال',
  'you_4': 'شحن فوري يو 410 ريال',
  'you_6': 'شحن فوري يو 830 ريال',
  'you_11': 'شحن فوري يو 1000 ريال',
  'you_7': 'شحن فوري يو 1250 ريال',
  'you_8': 'شحن فوري يو 2500 ريال',
  'you_9': 'شحن فوري يو 5000 ريال',
  'you_10': 'شحن فوري يو 7500 ريال',

  // سبأفون - باقات وشحن فوري
  '68': 'باقة يابلاش اليومية',
  'saba_68': 'باقة يابلاش اليومية',
  'SABA114': 'باقة امان الاسبوعية',
  'saba_SABA114': 'باقة امان الاسبوعية',
  'aman': 'باقة امان الاسبوعية',
  'saba_aman': 'باقة امان الاسبوعية',
  'aman_weekly': 'باقة امان الاسبوعية',
  'saba_aman_weekly': 'باقة امان الاسبوعية',
  '20448': 'باقة امان الاسبوعية',
  'saba_20448': 'باقة امان الاسبوعية',
  '600': 'شحن فوري سبأفون جنوب (فئة 960)',
  'sbay_600': 'شحن فوري سبأفون جنوب (فئة 960)',
  '960': 'شحن فوري سبأفون جنوب (فئة 960)',
  'sbay_960': 'شحن فوري سبأفون جنوب (فئة 960)',
  '940': 'شحن فوري سبأفون جنوب (فئة 960)',
  'sbay_940': 'شحن فوري سبأفون جنوب (فئة 960)',
  '1000': 'شحن فوري سبأفون جنوب (فئة 1600)',
  'sbay_1000': 'شحن فوري سبأفون جنوب (فئة 1600)',
  '1600': 'شحن فوري سبأفون جنوب (فئة 1600)',
  'sbay_1600': 'شحن فوري سبأفون جنوب (فئة 1600)',
  '1568': 'شحن فوري سبأفون جنوب (فئة 1600)',
  'sbay_1568': 'شحن فوري سبأفون جنوب (فئة 1600)',
  '1650': 'شحن فوري سبأفون جنوب (فئة 2640)',
  'sbay_1650': 'شحن فوري سبأفون جنوب (فئة 2640)',
  '2640': 'شحن فوري سبأفون جنوب (فئة 2640)',
  'sbay_2640': 'شحن فوري سبأفون جنوب (فئة 2640)',
  '2587': 'شحن فوري سبأفون جنوب (فئة 2640)',
  'sbay_2587': 'شحن فوري سبأفون جنوب (فئة 2640)',
  '2500': 'شحن فوري سبأفون جنوب (فئة 4000)',
  'sbay_2500': 'شحن فوري سبأفون جنوب (فئة 4000)',
  'sbay_4000': 'شحن فوري سبأفون جنوب (فئة 4000)',
  '3920': 'شحن فوري سبأفون جنوب (فئة 4000)',
  'sbay_3920': 'شحن فوري سبأفون جنوب (فئة 4000)',
  '5000': 'شحن فوري سبأفون جنوب (فئة 8000)',
  'sbay_5000': 'شحن فوري سبأفون جنوب (فئة 8000)',
  'sbay_8000': 'شحن فوري سبأفون جنوب (فئة 8000)',
  '7840': 'شحن فوري سبأفون جنوب (فئة 8000)',
  'sbay_7840': 'شحن فوري سبأفون جنوب (فئة 8000)',
  '10000': 'شحن فوري سبأفون جنوب (فئة 16000)',
  'sbay_10000': 'شحن فوري سبأفون جنوب (فئة 16000)',
  'sbay_16000': 'شحن فوري سبأفون جنوب (فئة 16000)',
  '15680': 'شحن فوري سبأفون جنوب (فئة 16000)',
  'sbay_15680': 'شحن فوري سبأفون جنوب (فئة 16000)',
  '22.5': 'شحن فوري سبأفون شمال (فئة 22.5)',
  'sabaphone_22.5': 'شحن فوري سبأفون شمال (فئة 22.5)',
  '813': 'شحن فوري سبأفون شمال (فئة 22.5)',
  'sabaphone_813': 'شحن فوري سبأفون شمال (فئة 22.5)',
  '40': 'شحن فوري سبأفون شمال (فئة 40)',
  'sabaphone_40': 'شحن فوري سبأفون شمال (فئة 40)',
  '1446': 'شحن فوري سبأفون شمال (فئة 40)',
  'sabaphone_1446': 'شحن فوري سبأفون شمال (فئة 40)',
  '45': 'شحن فوري سبأفون شمال (فئة 45)',
  'sabaphone_45': 'شحن فوري سبأفون شمال (فئة 45)',
  '1626': 'شحن فوري سبأفون شمال (فئة 45)',
  'sabaphone_1626': 'شحن فوري سبأفون شمال (فئة 45)',
  '60': 'شحن فوري سبأفون شمال (فئة 60)',
  'sabaphone_60': 'شحن فوري سبأفون شمال (فئة 60)',
  '2169': 'شحن فوري سبأفون شمال (فئة 60)',
  'sabaphone_2169': 'شحن فوري سبأفون شمال (فئة 60)',
  '85': 'شحن فوري سبأفون شمال (فئة 85)',
  'sabaphone_85': 'شحن فوري سبأفون شمال (فئة 85)',
  '3072': 'شحن فوري سبأفون شمال (فئة 85)',
  'sabaphone_3072': 'شحن فوري سبأفون شمال (فئة 85)',
  '100': 'شحن فوري سبأفون شمال (فئة 100)',
  'sabaphone_100': 'شحن فوري سبأفون شمال (فئة 100)',
  '3615': 'شحن فوري سبأفون شمال (فئة 100)',
  'sabaphone_3615': 'شحن فوري سبأفون شمال (فئة 100)',
  '125': 'شحن فوري سبأفون شمال (فئة 125)',
  'sabaphone_125': 'شحن فوري سبأفون شمال (فئة 125)',
  '4518': 'شحن فوري سبأفون شمال (فئة 125)',
  'sabaphone_4518': 'شحن فوري سبأفون شمال (فئة 125)',
  '150': 'شحن فوري سبأفون شمال (فئة 150)',
  'sabaphone_150': 'شحن فوري سبأفون شمال (فئة 150)',
  '5424': 'شحن فوري سبأفون شمال (فئة 150)',
  'sabaphone_5424': 'شحن فوري سبأفون شمال (فئة 150)',
  '209': 'شحن فوري سبأفون شمال (فئة 209)',
  'sabaphone_209': 'شحن فوري سبأفون شمال (فئة 209)',
  '7554': 'شحن فوري سبأفون شمال (فئة 209)',
  'sabaphone_7554': 'شحن فوري سبأفون شمال (فئة 209)',
  '300': 'شحن فوري سبأفون شمال (فئة 300)',
  'sabaphone_300': 'شحن فوري سبأفون شمال (فئة 300)',
  '10845': 'شحن فوري سبأفون شمال (فئة 300)',
  'sabaphone_10845': 'شحن فوري سبأفون شمال (فئة 300)',
  '505': 'شحن فوري سبأفون شمال (فئة 505)',
  'sabaphone_505': 'شحن فوري سبأفون شمال (فئة 505)',
  '18255': 'شحن فوري سبأفون شمال (فئة 505)',
  'sabaphone_18255': 'شحن فوري سبأفون شمال (فئة 505)',
  '1270': 'شحن فوري سبأفون شمال (فئة 1270)',
  'sabaphone_1270': 'شحن فوري سبأفون شمال (فئة 1270)',
  '45912': 'شحن فوري سبأفون شمال (فئة 1270)',
  'sabaphone_45912': 'شحن فوري سبأفون شمال (فئة 1270)',

  // واي Why
  '91': 'باقة كرم 250',
  'why_91': 'باقة كرم 250',
  '92': 'باقة كرم 500',
  'why_92': 'باقة كرم 500',
  '93': 'باقة كرم 900',
  'why_93': 'باقة كرم 900',
  '94': 'باقة كرم 2000',
  'why_94': 'باقة كرم 2000',

  // عدن نت
  '20gb': 'باقة عدن نت 20 جيجا',
  '3000': 'باقة عدن نت 20 جيجا',
  '40gb': 'باقة عدن نت 40 جيجا',
  '6000': 'باقة عدن نت 40 جيجا',
  '60gb': 'باقة عدن نت 60 جيجا',
  '9000': 'باقة عدن نت 60 جيجا',
  '80gb': 'باقة عدن نت 80 جيجا',
  '12000': 'باقة عدن نت 80 جيجا',
  '120gb': 'باقة عدن نت 120 جيجا (تجارية)',
  '30000': 'باقة عدن نت 120 جيجا (تجارية)',

  // يمن فورجي
  '4g_15gb': 'باقة يمن فورجي 15 جيجا',
  '4G_15GB': 'باقة يمن فورجي 15 جيجا',
  '2400': 'باقة يمن فورجي 15 جيجا',
  '4g_25gb': 'باقة يمن فورجي 25 جيجا',
  '4G_25GB': 'باقة يمن فورجي 25 جيجا',
  '4000': 'باقة يمن فورجي 25 جيجا',
  '4g_60gb': 'باقة يمن فورجي 60 جيجا',
  '4G_60GB': 'باقة يمن فورجي 60 جيجا',
  '8000': 'باقة يمن فورجي 60 جيجا',
  '4g_130gb': 'باقة يمن فورجي 130 جيجا',
  '4G_130GB': 'باقة يمن فورجي 130 جيجا',
  '16000': 'باقة يمن فورجي 130 جيجا',
  '4g_250gb': 'باقة يمن فورجي 250 جيجا',
  '4G_250GB': 'باقة يمن فورجي 250 جيجا',
  '26000': 'باقة يمن فورجي 250 جيجا',
  '4g_500gb': 'باقة يمن فورجي 500 جيجا',
  '4G_500GB': 'باقة يمن فورجي 500 جيجا',
  '46000': 'باقة يمن فورجي 500 جيجا',
};

export const YEMEN_4G_PACKAGE_PRICES_MAP: Record<string, number> = {
  '4g_15gb': 2400,
  '4G_15GB': 2400,
  '2400': 2400,
  '4g_25gb': 4000,
  '4G_25GB': 4000,
  '4000': 4000,
  '4g_60gb': 8000,
  '4G_60GB': 8000,
  '8000': 8000,
  '4g_130gb': 16000,
  '4G_130GB': 16000,
  '16000': 16000,
  '4g_250gb': 26000,
  '4G_250GB': 26000,
  '26000': 26000,
  '4g_500gb': 46000,
  '4G_500GB': 46000,
  '46000': 46000
};

export interface TelecomDetailsInput {
  service?: string;
  action?: string;
  amount?: number | string;
  num?: string | number;
  offerid?: string | number;
  packageid?: string | number;
  israsid?: string | number;
  mobile?: string;
  phone?: string;
  recipientPhoneNumber?: string;
}

/**
 * تحديد مسمى الخدمة واسم الباقة بالعربي بدقة تامة دون ذكر كلمة API
 */
export function resolveTelecomDetails(input: TelecomDetailsInput): {
  serviceName: string;
  packageName?: string;
  transactionType: string;
  notes: string;
  recipientPhoneNumber: string;
} {
  const rawPhone = String(input.recipientPhoneNumber || input.mobile || input.phone || '').trim();
  const cleanPhone = rawPhone.replace(/\D/g, '').slice(-9) || rawPhone;
  const s = (input.service || 'yemen').toLowerCase().trim();
  const act = (input.action || 'bill').toLowerCase().trim();
  const pkgKey = String(input.offerid || input.packageid || input.num || input.amount || '').trim();
  const knownPkg = KNOWN_PACKAGE_NAMES[pkgKey] || KNOWN_PACKAGE_NAMES[String(input.offerid || '')] || KNOWN_PACKAGE_NAMES[String(input.packageid || '')] || KNOWN_PACKAGE_NAMES[String(input.num || '')] || KNOWN_PACKAGE_NAMES[String(input.amount || '')];

  // 1. يمن موبايل
  if (s === 'yemen' || s === 'yem' || s === 'offeryem') {
    const isOffer = act === 'billoffer' || Boolean(knownPkg) || Boolean(input.offerid);
    if (isOffer) {
      const pkgName = knownPkg || `باقة (${pkgKey})`;
      return {
        serviceName: 'يمن موبايل',
        packageName: pkgName,
        transactionType: `يمن موبايل - ${pkgName}`,
        notes: `تفعيل ${pkgName} للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    return {
      serviceName: 'يمن موبايل',
      transactionType: 'يمن موبايل - سداد رصيد',
      notes: `سداد رصيد للرقم: ${cleanPhone} بمبلغ: ${input.amount || '0'} ريال`,
      recipientPhoneNumber: cleanPhone
    };
  }

  // 2. يو YOU
  if (s === 'you' || s === 'mtn' || s === 'mtnoffer') {
    const rawPkgKey = String(
      input.offerid || 
      (input as any).offerId || 
      input.packageid || 
      (input as any).packageId || 
      (input as any).offertype || 
      (input as any).package_code ||
      input.num || 
      ''
    ).trim();

    const knownPkg = 
      KNOWN_PACKAGE_NAMES[rawPkgKey] || 
      KNOWN_PACKAGE_NAMES[String(input.offerid || '')] || 
      KNOWN_PACKAGE_NAMES[String((input as any).offerId || '')] ||
      KNOWN_PACKAGE_NAMES[String(input.packageid || '')] || 
      KNOWN_PACKAGE_NAMES[String((input as any).packageId || '')] ||
      KNOWN_PACKAGE_NAMES[String((input as any).offertype || '')] ||
      KNOWN_PACKAGE_NAMES[String(input.num || '')];

    const isOffer = 
      s === 'mtnoffer' ||
      act === 'billoffer' || 
      act === 'offer' || 
      act === 'package' || 
      act === 'packages' ||
      Boolean(knownPkg) || 
      Boolean(input.offerid) || 
      Boolean((input as any).offerId) ||
      Boolean(input.packageid) || 
      Boolean((input as any).packageId) || 
      Boolean((input as any).offertype) || 
      Boolean((input as any).package_code) ||
      ((input as any).israsid === '0' || (input as any).israsid === 0);

    if (isOffer) {
      const finalPkgName = knownPkg || (rawPkgKey ? `باقة يو (${rawPkgKey})` : 'باقة يو');
      return {
        serviceName: 'يو',
        packageName: finalPkgName,
        transactionType: `يو - ${finalPkgName}`,
        notes: `تفعيل ${finalPkgName} للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    return {
      serviceName: 'يو',
      transactionType: 'يو - سداد رصيد',
      notes: `سداد رصيد يو للرقم: ${cleanPhone} بمبلغ: ${input.amount || '0'} ريال`,
      recipientPhoneNumber: cleanPhone
    };
  }

  // 3. سبأفون
  if (s === 'sabaphone' || s === 'sbay' || s === 'sabaunits' || s === 'sabaoffer' || s === 'sabafon' || s === 'saba' || s === 'saba_units' || s === 'saba_south' || s === 'sabasouth') {
    const isUnits = 
      s === 'sabaunits' || 
      s === 'saba_units' || 
      act === 'units' || 
      act === 'sabaunits' || 
      (input as any).type === 'units' || 
      Boolean((input as any).units) || 
      Boolean((input as any).count);

    if (isUnits) {
      const rawUnitsStr = String(
        (input as any).units || 
        (input as any).unit || 
        (input as any).count || 
        (input as any).quantity || 
        input.num || 
        (input as any).unum || 
        (input.amount && parseFloat(String(input.amount)) < 500 ? input.amount : '') || 
        '50'
      ).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
      const unitsCount = parseFloat(rawUnitsStr) || 50;
      return {
        serviceName: 'سبأفون',
        transactionType: `سبأفون - شحن وحدات (${unitsCount} وحدة)`,
        notes: `شحن ${unitsCount} وحدة سبأفون للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }

    if (s === 'sabaoffer' || Boolean(knownPkg) || pkgKey.toLowerCase().includes('aman')) {
      const pkgName = knownPkg || (pkgKey.toLowerCase().includes('aman') || pkgKey === 'SABA114' ? 'باقة امان الاسبوعية' : `باقة (${pkgKey})`);
      return {
        serviceName: 'سبأفون',
        packageName: pkgName,
        transactionType: `سبأفون - ${pkgName}`,
        notes: `تفعيل ${pkgName} سبأفون للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }

    if (s === 'sbay' || s === 'saba_south' || s === 'sabasouth') {
      const rawCategory = String(input.num || (input as any).category || (input as any).packageid || (input.amount ? String(input.amount) : '')).trim();
      const southCategoryTitles: Record<string, string> = {
        '600': 'فئة 960 (600)',
        '960': 'فئة 960',
        '940': 'فئة 960',
        '941': 'فئة 960',
        '1000': 'فئة 1600 (1000)',
        '1600': 'فئة 1600',
        '1568': 'فئة 1600',
        '1650': 'فئة 2640 (1650)',
        '2640': 'فئة 2640',
        '2587': 'فئة 2640',
        '2500': 'فئة 4000 (2500)',
        '4000': 'فئة 4000',
        '3920': 'فئة 4000',
        '5000': 'فئة 8000 (5000)',
        '8000': 'فئة 8000',
        '7840': 'فئة 8000',
        '10000': 'فئة 16000 (10000)',
        '16000': 'فئة 16000',
        '15680': 'فئة 16000'
      };
      const catLabel = southCategoryTitles[rawCategory] || (rawCategory ? `فئة ${rawCategory}` : 'فئة 960');
      return {
        serviceName: 'سبأفون',
        transactionType: `سبأفون - شحن فوري جنوب (${catLabel})`,
        notes: `شحن فوري سبأفون جنوب (${catLabel}) للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }

    const rawNorthInput = String(input.num || (input as any).category || (input as any).packageid || (input.amount ? String(input.amount) : '')).trim();
    const northCategoryTitles: Record<string, string> = {
      '22.5': '22.5',
      '813': '22.5',
      '40': '40',
      '1446': '40',
      '45': '45',
      '1626': '45',
      '60': '60',
      '2169': '60',
      '85': '85',
      '3072': '85',
      '100': '100',
      '3615': '100',
      '125': '125',
      '4518': '125',
      '150': '150',
      '5424': '150',
      '209': '209',
      '7554': '209',
      '300': '300',
      '10845': '300',
      '505': '505',
      '18255': '505',
      '1270': '1270',
      '45912': '1270'
    };
    const resolvedNorthCat = northCategoryTitles[rawNorthInput];
    if (resolvedNorthCat) {
      return {
        serviceName: 'سبأفون',
        transactionType: `سبأفون - شحن فوري شمال (فئة ${resolvedNorthCat})`,
        notes: `شحن فوري سبأفون شمال (فئة ${resolvedNorthCat}) للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }

    return {
      serviceName: 'سبأفون',
      transactionType: 'سبأفون - سداد رصيد',
      notes: `سداد رصيد سبأفون للرقم: ${cleanPhone} بمبلغ: ${input.amount || '0'} ريال`,
      recipientPhoneNumber: cleanPhone
    };
  }

  // 4. واي Why
  if (s === 'why') {
    const isOffer = input.israsid !== '1' && (Boolean(knownPkg) || Boolean(input.packageid));
    if (isOffer) {
      const pkgName = knownPkg || `باقة (${pkgKey})`;
      return {
        serviceName: 'واي',
        packageName: pkgName,
        transactionType: `واي - ${pkgName}`,
        notes: `تفعيل ${pkgName} واي للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    return {
      serviceName: 'واي',
      transactionType: 'واي - سداد رصيد',
      notes: `سداد رصيد واي للرقم: ${cleanPhone}`,
      recipientPhoneNumber: cleanPhone
    };
  }

  // 5. عدن نت (باقات فقط - لا تسجل سداد رصيد نهائياً)
  if (s === 'adenet' || s === 'aden_net' || s === 'aden') {
    const rawAmt = String(input.amount || '').trim();
    const pkgName = knownPkg || KNOWN_PACKAGE_NAMES[rawAmt] || `باقة عدن نت (${pkgKey || rawAmt || 'إنترنت'})`;
    return {
      serviceName: 'عدن نت',
      packageName: pkgName,
      transactionType: `عدن نت - ${pkgName}`,
      notes: `تفعيل ${pkgName} للرقم: ${cleanPhone}`,
      recipientPhoneNumber: cleanPhone
    };
  }

  // 6. يمن فورجي (إذا كان سداد باقة يكتب اسم الباقة، ولا يكتب سداد رصيد إلا عند سداد رصيد حر)
  if (s === 'yem4g' || s === 'yemen_4g' || s === 'yemen4g' || s === '4g') {
    const rawAmt = String(input.amount || '').trim();
    const parsedAmt = parseFloat(rawAmt) || 0;
    const valid4gAmounts = [2400, 4000, 8000, 16000, 26000, 46000];
    const pkgName = knownPkg || KNOWN_PACKAGE_NAMES[rawAmt];

    const isOffer = Boolean(pkgName) || 
                    act === 'billoffer' || 
                    act === 'offer' || 
                    (input as any).type === '1' || 
                    (input as any).type === 1 || 
                    (input as any).type === 'package' || 
                    (input as any).type === 'packages' || 
                    Boolean((input as any).offertype) || 
                    (valid4gAmounts.includes(parsedAmt) && (input as any).type !== '2' && (input as any).israsid !== '1');

    if (isOffer) {
      const finalPkgName = pkgName || (valid4gAmounts.includes(parsedAmt) ? KNOWN_PACKAGE_NAMES[String(parsedAmt)] : `باقة فورجي (${pkgKey || rawAmt})`);
      return {
        serviceName: 'يمن فورجي',
        packageName: finalPkgName,
        transactionType: `يمن فورجي - ${finalPkgName}`,
        notes: `تفعيل ${finalPkgName} للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    return {
      serviceName: 'يمن فورجي',
      transactionType: 'يمن فورجي - سداد رصيد',
      notes: `سداد رصيد يمن فورجي للرقم: ${cleanPhone} بمبلغ: ${input.amount || '0'} ريال`,
      recipientPhoneNumber: cleanPhone
    };
  }

  // 7. الهاتف الثابت والإنترنت الأرضي
  if (
    s === 'post' || 
    s === 'landline_adsl' || 
    s === 'adsl' || 
    s === 'internet' || 
    s === 'net' || 
    s === 'landline' || 
    s === 'phone' || 
    s === 'telephone' || 
    s === 'hatif'
  ) {
    const isPhone = 
      act === 'queryphone' || 
      (input as any).type === 'line' || 
      (input as any).type === 'phone' || 
      s === 'phone' || 
      s === 'landline' || 
      s === 'telephone' || 
      s === 'hatif';

    if (isPhone) {
      return {
        serviceName: 'الهاتف الثابت',
        transactionType: 'الهاتف الثابت - سداد فاتورة',
        notes: `سداد فاتورة الهاتف الثابت للرقم: ${rawPhone}`,
        recipientPhoneNumber: rawPhone
      };
    }
    return {
      serviceName: 'الإنترنت المنزلي ADSL',
      transactionType: 'الإنترنت المنزلي ADSL - سداد',
      notes: `سداد اشتراك الإنترنت الأرضي ADSL للرقم: ${rawPhone}`,
      recipientPhoneNumber: rawPhone
    };
  }

  // عام
  return {
    serviceName: 'اتصالات',
    transactionType: `سداد خدمة (${s})`,
    notes: `سداد للرقم: ${cleanPhone || rawPhone}`,
    recipientPhoneNumber: cleanPhone || rawPhone
  };
}

/**
 * التحقق الصارم من الحدود الدنيا المعتمدة وضوابط الخدمات
 */
export function validateTelecomRequest(input: {
  service?: string;
  action?: string;
  amount?: number | string;
  num?: string | number;
  offerid?: string | number;
  packageid?: string | number;
  israsid?: string | number;
  mobile?: string;
}): { valid: boolean; error?: string } {
  const s = (input.service || 'yemen').toLowerCase().trim();
  const act = (input.action || 'bill').toLowerCase().trim();
  const amt = parseFloat(String(input.amount || '0')) || 0;
  const numVal = parseFloat(String(input.num || '0')) || 0;

  // 1. يمن موبايل: إذا سدد أقل من 21 ريال يتم الرفض مباشرة
  if ((s === 'yemen' || s === 'yem' || s === 'offeryem') && act !== 'billoffer' && !input.offerid) {
    const checkAmt = amt > 0 ? amt : numVal;
    if (checkAmt < 21) {
      return { valid: false, error: 'أقل مبلغ سداد مسموح به في يمن موبايل هو 21 ريال.' };
    }
  }

  // 2. يو: التحقق من الرقم وضوابط الباقات وسداد الرصيد
  if (s === 'you' || s === 'mtn' || s === 'mtnoffer') {
    const phoneNum = String(input.mobile || (input as any).phone || '').replace(/\D/g, '').slice(-9);
    if (phoneNum && phoneNum.length > 0) {
      if (phoneNum.length !== 9 || !phoneNum.startsWith('73')) {
        return { valid: false, error: 'رقم هاتف شركة يو (YOU) يجب أن يتكون من 9 أرقام ويبدأ بـ 73.' };
      }
    }

    const pkgCheckKey = String(
      input.offerid || 
      (input as any).offerId || 
      input.packageid || 
      (input as any).packageId || 
      (input as any).offertype || 
      (input as any).package_code ||
      input.num || 
      ''
    ).trim();

    const isOffer = 
      s === 'mtnoffer' ||
      act === 'billoffer' || 
      act === 'offer' || 
      act === 'package' || 
      Boolean(input.offerid) || 
      Boolean((input as any).offerId) ||
      Boolean(input.packageid) || 
      Boolean((input as any).packageId) || 
      Boolean((input as any).offertype) || 
      Boolean((input as any).package_code) ||
      Boolean(KNOWN_PACKAGE_NAMES[pkgCheckKey]) ||
      (input.israsid === '0' || input.israsid === 0);

    if (isOffer) {
      if (!pkgCheckKey) {
        return { valid: false, error: 'يرجى تحديد كود أو رقم الباقة المطلوبة لشركة يو (مثلاً: Mix_4GB_4G_PRE أو Sawa_300_PRE).' };
      }
    } else {
      const checkAmt = amt > 0 ? amt : numVal;
      if (checkAmt < 100) {
        return { valid: false, error: 'أقل مبلغ سداد للرصيد في شركة يو هو 100 ريال.' };
      }
    }
  }

  // 3. سبأفون: أقل وحدات 50 وحدة
  // 3. سبأفون: أقل وحدات 50 وحدة
  const isSabaUnits = 
    s === 'sabaunits' || 
    s === 'saba_units' || 
    ((s === 'sabaphone' || s === 'sabafon' || s === 'saba') && (
      act === 'units' || 
      act === 'sabaunits' || 
      (input as any).type === 'units' || 
      Boolean((input as any).units) || 
      Boolean((input as any).count)
    ));

  if (isSabaUnits) {
    const rawUnitsStr = String(
      (input as any).units || 
      (input as any).unit || 
      (input as any).count || 
      (input as any).quantity || 
      input.num || 
      (input as any).unum || 
      (amt > 0 && amt <= 1000 ? amt : '') || 
      '0'
    ).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    const units = parseFloat(rawUnitsStr) || 0;
    if (units > 0 && units < 50) {
      return { valid: false, error: 'أقل كمية شحن مسموح بها لوحدات سبأفون هي 50 وحدة.' };
    }
  }

  // 4. واي: أقل سداد للرصيد 100 ريال
  if (s === 'why' && (input.israsid === '1' || (!input.packageid && act === 'bill'))) {
    const checkAmt = amt > 0 ? amt : numVal;
    if (checkAmt < 100) {
      return { valid: false, error: 'أقل مبلغ سداد للرصيد في شركة واي هو 100 ريال.' };
    }
  }

  // 5. عدن نت: باقات فقط ولا تقبل سداد رصيد
  if (s === 'adenet' || s === 'aden_net' || s === 'aden') {
    if (act === 'query' || act === 'balance' || act === 'lookup') {
      return { valid: false, error: 'خدمة عدن نت مخصصة للباقات فقط، لا يوجد استعلام رصيد أو فواتير.' };
    }
    // منع سداد الرصيد نهائياً
    if (input.israsid === '1' || (input as any).type === '2' || (input as any).type === 'balance' || (input as any).type === 'rasid') {
      return { valid: false, error: 'خدمة عدن نت مخصصة للباقات فقط، لا يوجد سداد رصيد.' };
    }
    const checkAmt = amt > 0 ? amt : numVal;
    const pkgKey = String(input.num || input.packageid || input.offerid || '').toLowerCase().trim();
    const validAdenAmounts = [3000, 6000, 9000, 12000, 30000];
    const validAdenCodes = ['20gb', '40gb', '60gb', '80gb', '120gb', '20', '40', '60', '80', '120', '3000', '6000', '9000', '12000', '30000'];

    const hasValidCode = validAdenCodes.includes(pkgKey);
    const hasValidAmount = validAdenAmounts.includes(checkAmt);

    if (!hasValidCode && !hasValidAmount) {
      return { valid: false, error: 'خدمة عدن نت مخصصة للباقات فقط. المبلغ لا يطابق أي باقة معتمدة في عدن نت (3000، 6000، 9000، 12000، 30000).' };
    }
  }

  // 6. يمن فورجي: باقات وسداد رصيد
  if (s === 'yem4g' || s === 'yemen_4g' || s === 'yemen4g' || s === '4g') {
    const pkgKey = String(input.packageid || input.offerid || (input as any).offertype || input.num || '').toLowerCase().trim();
    const isExplicitPackage = act === 'billoffer' || act === 'offer' || 
      (input as any).type === '1' || (input as any).type === 1 || 
      (input as any).type === 'package' || (input as any).type === 'packages' ||
      Boolean(input.packageid) || Boolean(input.offerid) || Boolean((input as any).offertype) ||
      (input as any).israsid === '0' || (input as any).israsid === 0;

    const checkAmt = amt > 0 ? amt : (numVal > 0 ? numVal : 0);
    const valid4gAmounts = [2400, 4000, 8000, 16000, 26000, 46000];

    if (isExplicitPackage) {
      // في باقات يمن فورجي: إذا كان المبلغ غير مطابق للباقات لا تسويه عملية نهائياً ورجع له رد: المبلغ لايساوي اي قيمة باقة في يمن فورجي
      const effectiveAmt = checkAmt > 0 ? checkAmt : (YEMEN_4G_PACKAGE_PRICES_MAP[pkgKey] || 0);
      if (!valid4gAmounts.includes(effectiveAmt)) {
        return { valid: false, error: 'المبلغ لايساوي اي قيمة باقة في يمن فورجي' };
      }
    } else {
      // سداد الرصيد في يمن فورجي يبدأ من 100 ريال
      if (checkAmt > 0 && checkAmt < 100) {
        return { valid: false, error: 'أقل مبلغ سداد للرصيد في يمن فورجي هو 100 ريال.' };
      }
    }
  }

  // 7. الهاتف الثابت والإنترنت الأرضي (الهاتف الثابت يبدأ من 200 ريال - الإنترنت الأرضي يبدأ من 250 ريال)
  if (
    s === 'post' || 
    s === 'landline_adsl' || 
    s === 'adsl' || 
    s === 'internet' || 
    s === 'net' || 
    s === 'landline' || 
    s === 'phone' || 
    s === 'telephone' || 
    s === 'hatif'
  ) {
    const checkAmt = amt > 0 ? amt : numVal;
    const isPhone = 
      act === 'queryphone' || 
      (input as any).type === 'line' || 
      (input as any).type === 'phone' || 
      s === 'phone' || 
      s === 'landline' || 
      s === 'telephone' || 
      s === 'hatif';

    if (isPhone && checkAmt > 0 && checkAmt < 200) {
      return { valid: false, error: 'أقل مبلغ سداد للهاتف الثابت هو 200 ريال.' };
    }
    if (!isPhone && checkAmt > 0 && checkAmt < 250) {
      return { valid: false, error: 'أقل مبلغ سداد للإنترنت الأرضي هو 250 ريال.' };
    }

    // رقم هاتف الإنترنت والهاتف الثابت يتكون من 8 أرقام فقط
    const phoneNum = String(input.mobile || (input as any).phone || '').replace(/\D/g, '');
    if (phoneNum && phoneNum.length > 0) {
      if (phoneNum.length !== 8 && phoneNum.length !== 7) {
        return { valid: false, error: 'رقم الهاتف الأرضي أو الإنترنت يجب أن يتكون من 8 أرقام فقط.' };
      }
    }
  }

  return { valid: true };
}