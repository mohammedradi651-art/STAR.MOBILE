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
    const cleanError = providerError.replace(/تمت?\s*إعادة\s*المبلغ[^\n.]*/gi, '').replace(/تم\s*استرجاع\s*المبلغ[^\n.]*/gi, '').trim();
    await markPaymentFailedAndRefund(firestore, userId, transid, amount, cleanError);
    throw new Error(cleanError || 'فشلت العملية من المزود');
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
  'Mix_4GB_4G_PRE': 'باقة السعر الموحد 4 جيجا فورجي',
  'Mix_5Giga_4G_PRE': 'باقة فورجي 5 جيجا',
  'Smart4Giga_4G_PRE': 'باقة سمارت فورجي الأسبوعية',
  'WafferPlus10_4G_PRE': 'باقة وفر بلس 10 جيجا',
  'Mix_5000_PRE': 'باقة سوا مكس 1200',
  'Mix_12Giga_4G_PRE': 'فورجي مكس 12 جيجا',
  'Smart15Giga_4G_PRE': 'باقة سمارت فورجي 15 جيجا',
  'Smart3Giga_3G_PRE': 'باقة سمارت اليومية 3 جيجا',
  'you_4': 'شحن فوري يو 410 ريال',
  'you_6': 'شحن فوري يو 830 ريال',
  'you_11': 'شحن فوري يو 1000 ريال',
  'you_7': 'شحن فوري يو 1250 ريال',
  'you_8': 'شحن فوري يو 2500 ريال',
  'you_9': 'شحن فوري يو 5000 ريال',
  'you_10': 'شحن فوري يو 7500 ريال',

  // سبأفون
  '68': 'باقة يابلاش اليومية',
  'saba_68': 'باقة يابلاش اليومية',
  'SABA114': 'باقة امان الاسبوعية',
  'saba_SABA114': 'باقة امان الاسبوعية',

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
    const isOffer = act === 'billoffer' || Boolean(knownPkg) || Boolean(input.offerid);
    if (isOffer) {
      const pkgName = knownPkg || `باقة (${pkgKey})`;
      return {
        serviceName: 'يو',
        packageName: pkgName,
        transactionType: `يو - ${pkgName}`,
        notes: `تفعيل ${pkgName} للرقم: ${cleanPhone}`,
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
  if (s === 'sabaphone' || s === 'sbay' || s === 'sabaunits' || s === 'sabaoffer') {
    if (s === 'sabaunits') {
      const unitsCount = input.num || input.amount || 0;
      return {
        serviceName: 'سبأفون',
        transactionType: `سبأفون - شحن وحدات (${unitsCount} وحدة)`,
        notes: `شحن ${unitsCount} وحدة سبأفون للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    if (s === 'sabaoffer' || Boolean(knownPkg)) {
      const pkgName = knownPkg || `باقة (${pkgKey})`;
      return {
        serviceName: 'سبأفون',
        packageName: pkgName,
        transactionType: `سبأفون - ${pkgName}`,
        notes: `تفعيل ${pkgName} سبأفون للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    if (s === 'sbay') {
      return {
        serviceName: 'سبأفون',
        transactionType: 'سبأفون - شحن فوري جنوب',
        notes: `شحن فوري سبأفون جنوب للرقم: ${cleanPhone}`,
        recipientPhoneNumber: cleanPhone
      };
    }
    return {
      serviceName: 'سبأفون',
      transactionType: 'سبأفون - سداد رصيد',
      notes: `سداد رصيد سبأفون للرقم: ${cleanPhone}`,
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

  // 2. يو: أقل سداد للرصيد هو 100 ريال
  if ((s === 'you' || s === 'mtn') && act !== 'billoffer' && !input.offerid) {
    const checkAmt = amt > 0 ? amt : numVal;
    if (checkAmt < 100) {
      return { valid: false, error: 'أقل مبلغ سداد للرصيد في شركة يو هو 100 ريال.' };
    }
  }

  // 3. سبأفون: أقل وحدات 50 وحدة
  if (s === 'sabaunits') {
    const units = numVal > 0 ? numVal : amt;
    if (units < 50) {
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