import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import { DEFAULT_SERVICES_CONFIG, SystemServicesConfig, calculateApiTransactionCost } from '@/lib/services-config';
import { 
  validateTelecomRequest, 
  resolveTelecomDetails, 
  generateTransId, 
  generateBackpass 
} from '@/lib/telecom-order';

/**
 * @fileOverview نقطة نهاية سداد العمليات الاحترافية v2.0
 * مطابقة تماماً لنظام الحساب العادي:
 * 1. فحص الحدود الدنيا الصارمة والرفض الفوري دون خصم.
 * 2. أسماء باقات واضحة ومباشرة من رقم الكود وبدون أي ذكر لكلمة API.
 * 3. خصم الرصيد أولاً وتسجيل المعاملة كـ "قيد الانتظار".
 * 4. إذا تأخر المزود تبقى "قيد الانتظار"، وإذا نجح تكتمل "جاهزة"، وإذا فشل يُعاد الرصيد بدون كتابة عبارة الإرجاع.
 * 5. حفظ وتثبيت الرقم المسدد له دائماً.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        code: 'SM_UNAUTHORIZED',
        message: 'Missing or invalid API key',
        transactionId: null,
        data: null,
        timestamp
      }, { status: 401, headers: corsHeaders });
    }

    const apiKey = authHeader.split(' ')[1];
    const { firestore } = initializeServerFirebase();
    
    // 1. التحقق من هوية صاحب المفتاح
    const q = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({
        success: false,
        code: 'SM_FORBIDDEN',
        message: 'Invalid API Key',
        transactionId: null,
        data: null,
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    const requesterDoc = querySnapshot.docs[0];
    const requesterData = requesterDoc.data();
    
    // تحديد ما إذا كان الطالب مديراً (Master Key)
    const isAdmin = requesterData.email === '770326828@shabakat.com' || requesterDoc.id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    const body = await req.json();
    const { mobile, action, service } = body;

    // دعم الاستعلام المباشر عن حالة العملية عبر transid
    if ((action === 'status' || action === 'check') && (body.transid || body.id)) {
      const checkTransId = String(body.transid || body.id).trim();
      const origin = new URL(req.url).origin;
      
      // مزامنة حالة العملية الحية مع المزود
      try {
        await fetch(`${origin}/api/payment/sync-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transid: checkTransId })
        });
      } catch (e) {}

      // قراءة بيانات العملية من قاعدة البيانات
      const txDocRef = doc(firestore, 'paymentTransactions', checkTransId);
      const txSnap = await getDoc(txDocRef);

      if (!txSnap.exists()) {
        return NextResponse.json({
          success: false,
          code: 'SM_NOT_FOUND',
          message: `العملية برقم ${checkTransId} غير موجودة.`,
          transactionId: checkTransId,
          data: null,
          timestamp
        }, { status: 404, headers: corsHeaders });
      }

      const tx = txSnap.data();
      if (!isAdmin && tx.userId !== requesterDoc.id) {
        return NextResponse.json({
          success: false,
          code: 'SM_FORBIDDEN',
          message: 'ليس لديك صلاحية للاطلاع على هذه العملية.',
          transactionId: checkTransId,
          data: null,
          timestamp
        }, { status: 403, headers: corsHeaders });
      }

      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        status: tx.status,
        readiness: tx.readiness,
        transactionId: checkTransId,
        message: tx.readiness === 'جاهزة' 
          ? 'تم تنفيذ العملية بنجاح' 
          : (tx.readiness === 'فاشلة' ? (tx.providerMessage || 'فشلت العملية') : 'العملية قيد المعالجة (قيد الانتظار)'),
        data: {
          transid: checkTransId,
          status: tx.status,
          readiness: tx.readiness,
          amount: tx.amount,
          mobile: tx.recipientPhoneNumber,
          service: tx.transactionType,
          refunded: Boolean(tx.refunded),
          providerMessage: tx.providerMessage || null,
          createdAt: tx.createdAt,
          completedAt: tx.completedAt || null,
          failedAt: tx.failedAt || null
        },
        timestamp
      }, { headers: corsHeaders });
    }

    if (!mobile || !service) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'Missing required fields (mobile, service)',
        transactionId: null,
        data: null,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // 2. التحقق الصارم من الحدود الدنيا وضوابط الشركات (يمن موبايل 21، يو 100، سبأفون 50 وحدة، واي 100، إنترنت 250، هاتف 200، عدن نت باقات فقط)
    const validation = validateTelecomRequest(body);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: validation.error,
        transactionId: null,
        data: null,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // جلب إعدادات الأسعار من النظام
    let systemConfig: SystemServicesConfig = DEFAULT_SERVICES_CONFIG;
    try {
      const configSnap = await getDoc(doc(firestore, 'system_settings', 'telecom_config'));
      if (configSnap.exists()) {
        systemConfig = { ...DEFAULT_SERVICES_CONFIG, ...(configSnap.data() as any) };
      }
    } catch (e) {
      console.warn("Could not read telecom_config in v1/pay:", e);
    }

    // 3. توجيه الخصم (إذا كان الطالب مديراً، نبحث عن العميل صاحب الرقم "mobile" لنخصم منه)
    let effectiveUserId = requesterDoc.id;
    let effectiveUserData = requesterData;

    if (isAdmin) {
      const cleanMobile = mobile.replace(/\D/g, '').slice(-9);
      const targetQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanMobile));
      const targetSnap = await getDocs(targetQ);
      
      if (!targetSnap.empty) {
        effectiveUserId = targetSnap.docs[0].id;
        effectiveUserData = targetSnap.docs[0].data();
      }
    }

    // احتساب السعر الدقيق من الربط البرمجي
    const payAmount = calculateApiTransactionCost(body, systemConfig, effectiveUserData);
    const clientBalance = Number(effectiveUserData.balance || 0);

    if (clientBalance < payAmount) {
      return NextResponse.json({
        success: false,
        code: 'SM_INSUFFICIENT_BALANCE',
        message: isAdmin 
          ? `رصيد العميل ${mobile} غير كافٍ. الرصيد: ${clientBalance} ر.ي، والمطلوب: ${payAmount} ر.ي.`
          : `رصيد حسابك غير كافٍ لتنفيذ هذه العملية. الرصيد: ${clientBalance} ر.ي، والمطلوب: ${payAmount} ر.ي.`,
        transactionId: null,
        data: {
          currentBalance: clientBalance,
          requiredCost: payAmount
        },
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // تحديد ما إذا كان الطلب خاصاً بباقة
    const isExplicitPackage = 
      action === 'billoffer' || 
      action === 'offer' || 
      action === 'package' || 
      service === 'mtnoffer' || 
      Boolean(body.packageid || body.packageId || body.offerid || body.offerId || body.offertype || body.package_code) ||
      (body.israsid === '0' || body.israsid === 0);

    const effectiveAction = action || (isExplicitPackage ? 'billoffer' : 'bill');

    // 4. استخراج مسمى الخدمة واسم الباقة بالعربي بدقة وبدون أي ذكر لـ API
    const telecomDetails = resolveTelecomDetails({
      ...body,
      service,
      action: effectiveAction,
      amount: payAmount,
      mobile: mobile,
      recipientPhoneNumber: mobile
    });

    const transactionId = body.transid || generateTransId();
    const backpass = body.backpass || generateBackpass();

    // 5. خصم الرصيد أولاً وتسجيل المعاملة كـ "قيد الانتظار"
    const userRef = doc(firestore, 'users', effectiveUserId);
    const txRef = doc(firestore, `users/${effectiveUserId}/transactions`, transactionId);
    const globalTxRef = doc(firestore, 'paymentTransactions', transactionId);

    const initBatch = writeBatch(firestore);
    initBatch.update(userRef, { balance: increment(-payAmount) });

    const clientBackUrl = body.backurl || body.backUrl || body.callbackUrl || body.callback_url || null;

    const txRecord = {
      id: transactionId,
      userId: effectiveUserId,
      transactionDate: timestamp,
      createdAt: timestamp,
      amount: payAmount,
      transactionType: telecomDetails.transactionType,
      notes: telecomDetails.notes,
      recipientPhoneNumber: telecomDetails.recipientPhoneNumber || mobile,
      transid: transactionId,
      backpass: backpass,
      status: 'pending',
      readiness: 'قيد الانتظار',
      refunded: false,
      serviceCategory: telecomDetails.serviceName,
      clientBackUrl: clientBackUrl
    };

    initBatch.set(txRef, txRecord);
    initBatch.set(globalTxRef, txRecord);
    await initBatch.commit();

    // 6. استدعاء محرك السداد الداخلي
    const origin = new URL(req.url).origin;
    let telecomResponse: Response;
    let result: any = {};

    try {
      telecomResponse = await fetch(`${origin}/api/telecom`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-internal-handled': 'true',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          ...body,
          action: effectiveAction,
          amount: body.amount || payAmount,
          transid: transactionId,
          backpass: backpass
        })
      });

      result = await telecomResponse.json().catch(() => ({}));
    } catch (fetchErr: any) {
      console.warn("Fetch telecom internal route timed out or error:", fetchErr);
      // إذا تأخر الاتصال، تبقى العملية "قيد الانتظار" والرصيد مخصوم
      return NextResponse.json({
        success: true,
        code: 'SM_PENDING',
        message: 'تم إرسال الطلب وهو قيد المعالجة لدى المزود (قيد الانتظار)',
        transactionId: transactionId,
        data: {
          mobile: telecomDetails.recipientPhoneNumber || mobile,
          amount: payAmount,
          service: telecomDetails.transactionType,
          status: 'pending'
        },
        timestamp
      }, { headers: corsHeaders });
    }

    const rawResultMsg = String(result.resultDesc || result.message || '').trim();
    const normResultMsg = rawResultMsg.toLowerCase();
    const isPending =
      result.status === 'pending' ||
      result.status === 'wait' ||
      result.status === 'waiting' ||
      result.status === 'process' ||
      result.status === 'proccess' ||
      result.status === 'processing' ||
      result.status === 'proccessing' ||
      result.readiness === 'قيد الانتظار' ||
      result.resultCode === "-2" ||
      result.resultCode === -2 ||
      rawResultMsg.includes('انتظار') ||
      rawResultMsg.includes('معالج') ||
      rawResultMsg.includes('تنفيذ') ||
      rawResultMsg.includes('قبول') ||
      rawResultMsg.includes('معلق') ||
      rawResultMsg.includes('جاري') ||
      normResultMsg.includes('proc') ||
      normResultMsg.includes('pend') ||
      normResultMsg.includes('wait') ||
      normResultMsg.includes('queu') ||
      normResultMsg.includes('prog');

    const isSuccess =
      !isPending &&
      (result.status === 'success' ||
       result.action === 'done' ||
       result.readiness === 'جاهزة' ||
       result.resultCode === "0" ||
       result.resultCode === 0);

    if (isSuccess) {
      // نجاح العملية -> تحديث الحالة إلى جاهزة
      const successPayload = {
        status: 'success',
        readiness: 'جاهزة',
        providerMessage: result.resultDesc || result.message || 'تم تنفيذ العملية بنجاح',
        completedAt: new Date().toISOString()
      };

      const successBatch = writeBatch(firestore);
      successBatch.update(txRef, successPayload);
      successBatch.set(globalTxRef, successPayload, { merge: true });
      await successBatch.commit();

      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        status: 'success',
        readiness: 'جاهزة',
        message: 'تم تنفيذ العملية بنجاح',
        transactionId: transactionId,
        data: {
          mobile: telecomDetails.recipientPhoneNumber || mobile,
          amount: payAmount,
          service: telecomDetails.transactionType,
          clientName: effectiveUserData.displayName,
          newBalance: clientBalance - payAmount
        },
        timestamp
      }, { headers: corsHeaders });

    } else if (isPending) {
      // قيد الانتظار لدى المزود
      return NextResponse.json({
        success: true,
        code: 'SM_PENDING',
        status: 'pending',
        readiness: 'قيد الانتظار',
        message: result.resultDesc || result.message || 'تم إرسال الطلب وهو قيد المعالجة لدى المزود (قيد الانتظار)',
        transactionId: transactionId,
        data: {
          mobile: telecomDetails.recipientPhoneNumber || mobile,
          amount: payAmount,
          service: telecomDetails.transactionType,
          status: 'pending',
          readiness: 'قيد الانتظار'
        },
        timestamp
      }, { headers: corsHeaders });

    } else {
      // فشل ورفض من المزود -> إرجاع الرصيد وتحديث المعاملة إلى فاشلة بدون كتابة "تم إرجاع المبلغ"
      const rawError = result.resultDesc || result.message || 'فشلت العملية من المزود.';
      const cleanError = rawError
        .replace(/تمت?\s*إعادة\s*المبلغ[^\n.]*/gi, '')
        .replace(/تم\s*استرجاع\s*المبلغ[^\n.]*/gi, '')
        .trim() || 'تم رفض العملية من قبل مزود الخدمة.';

      const refundBatch = writeBatch(firestore);
      refundBatch.update(userRef, { balance: increment(payAmount) });

      const failPayload = {
        status: 'failed',
        readiness: 'فاشلة',
        refunded: true,
        amount: payAmount,
        providerMessage: cleanError,
        notes: `${telecomDetails.notes}\nالسبب: ${cleanError}`,
        failedAt: new Date().toISOString()
      };

      refundBatch.update(txRef, failPayload);
      refundBatch.set(globalTxRef, failPayload, { merge: true });
      await refundBatch.commit();

      return NextResponse.json({
        success: false,
        code: 'SM_PROVIDER_ERROR',
        message: cleanError,
        transactionId: transactionId,
        data: result,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

  } catch (error: any) {
    console.error('External API Pay Error:', error);
    return NextResponse.json({
      success: false,
      code: 'SM_INTERNAL_ERROR',
      message: 'Server internal error: ' + error.message,
      transactionId: null,
      data: null,
      timestamp
    }, { status: 500, headers: corsHeaders });
  }
}
