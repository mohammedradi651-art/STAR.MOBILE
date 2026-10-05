import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { initializeServerFirebase } from '@/firebase/server-init';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, increment } from 'firebase/firestore';
import { 
  DEFAULT_SERVICES_CONFIG, 
  SystemServicesConfig, 
  calculateApiTransactionCost 
} from '@/lib/services-config';
import { generateTransId, generateBackpass } from '@/lib/telecom-order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_API_BASE_URL = 'http://echehanly.yrbso.net/api/yr/';

const generateToken = (password: string, username: string, transid: string, identifier: string) => {
  if (!password || !username) return '';
  const hashPassword = CryptoJS.MD5(password).toString();
  // التوكن المعتمد: MD5(MD5(password) + transid + username + identifier)
  const tokenString = hashPassword + transid + username + identifier;
  return CryptoJS.MD5(tokenString).toString();
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, service, ...payload } = body;

    // 1. استخراج بيانات الاعتماد من البيئة أولاً كقيم افتراضية
    let userId = process.env.TELECOM_USERID || '';
    let username = process.env.TELECOM_USERNAME || '';
    let password = process.env.TELECOM_PASSWORD || '';
    let apiBaseUrl = DEFAULT_API_BASE_URL;
    let customBackUrl = 'https://star26.vercel.app/api/payment/webhook';
    let validApiKey = process.env.TELECOM_CLIENT_API_KEY || 'star_live_key_9f8e7d6c5b4a3210';
    let systemConfig: SystemServicesConfig = DEFAULT_SERVICES_CONFIG;

    const { firestore } = initializeServerFirebase();

    // 2. جلب الإعدادات المحدثة من Firestore (لوحة تحكم المدير)
    try {
      const settingsRef = doc(firestore, 'system_settings', 'telecom_config');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const configData = settingsSnap.data() as Partial<SystemServicesConfig>;
        systemConfig = {
          ...DEFAULT_SERVICES_CONFIG,
          ...configData,
          telecomApi: { ...DEFAULT_SERVICES_CONFIG.telecomApi, ...(configData?.telecomApi || {}) },
          yemen_mobile: { ...DEFAULT_SERVICES_CONFIG.yemen_mobile, ...(configData?.yemen_mobile || {}) },
          you: { ...DEFAULT_SERVICES_CONFIG.you, ...(configData?.you || {}) },
          sabafon: { ...DEFAULT_SERVICES_CONFIG.sabafon, ...(configData?.sabafon || {}) },
          why: { ...DEFAULT_SERVICES_CONFIG.why, ...(configData?.why || {}) },
          yemen_4g: { ...DEFAULT_SERVICES_CONFIG.yemen_4g, ...(configData?.yemen_4g || {}) },
          aden_net: { ...DEFAULT_SERVICES_CONFIG.aden_net, ...(configData?.aden_net || {}) },
          landline_adsl: { ...DEFAULT_SERVICES_CONFIG.landline_adsl, ...(configData?.landline_adsl || {}) },
          networks: { ...DEFAULT_SERVICES_CONFIG.networks, ...(configData?.networks || {}) }
        };

        const apiCreds = systemConfig.telecomApi;
        if (apiCreds?.userId) userId = apiCreds.userId.trim();
        if (apiCreds?.username) username = apiCreds.username.trim();
        if (apiCreds?.password) password = apiCreds.password.trim();
        if (apiCreds?.apiBaseUrl) {
          apiBaseUrl = apiCreds.apiBaseUrl.trim();
          if (!apiBaseUrl.endsWith('/')) apiBaseUrl += '/';
        }
        if (apiCreds?.backUrl) customBackUrl = apiCreds.backUrl.trim();
        if (apiCreds?.clientApiKey) validApiKey = apiCreds.clientApiKey.trim();
      }
    } catch (e) {
      console.warn("Could not read dynamic telecom settings from Firestore, using defaults:", e);
    }

    // 3. استخراج مفتاح الـ API والتحقق من هوية الطالب
    const authHeader = request.headers.get('authorization') || '';
    const xApiKey = request.headers.get('x-api-key') || '';
    const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const { searchParams } = new URL(request.url);
    const queryApiKey = searchParams.get('apiKey') || searchParams.get('api_key') || '';
    const incomingApiKey = (xApiKey || bearerKey || queryApiKey || payload.apiKey || '').trim();
    const isInternalHandled = request.headers.get('x-internal-handled') === 'true';

    // فحص مصدر الطلب (من داخل التطبيق أم ربط خارجي)
    const host = request.headers.get('host') || '';
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const secFetchSite = request.headers.get('sec-fetch-site') || '';
    const isAppSourceHeader = request.headers.get('x-app-source') === 'internal' || isInternalHandled;

    const isSameOrigin = secFetchSite === 'same-origin' || 
                         (!!origin && !!host && origin.includes(host)) || 
                         (!!referer && !!host && referer.includes(host));

    // استعلامات مجانية (لا تكلف رصيداً ولا تتطلب مفتاح API لعملاء التطبيق)
    const isQueryAction = ['query', 'solfa', 'queryoffer', 'check', 'status'].includes(action);

    // تحديد طبيعة الطلب:
    // أي طلب لا يحتوي على مفتاح API يعتبر طلباً داخلياً من واجهة الموقع/التطبيق فوراً وبدون أي شروط
    // السداد والاستعلام من داخل الموقع لا يتطلب أي مفتاح API على الإطلاق
    let isInternalAppRequest = false;

    if (!incomingApiKey || payload.backpass || payload.transid || isAppSourceHeader || isSameOrigin || isQueryAction) {
      isInternalAppRequest = true;
    }

    let clientUserId: string | null = null;
    let clientUserData: any = null;

    // لا يتم طلب مفتاح الـ API إلا إذا كان طلباً موجهاً كربط خارجي صريح
    if (!isInternalAppRequest && !incomingApiKey) {
      return NextResponse.json({
        resultCode: "-401",
        status: "failed",
        message: "مطلوب مفتاح الوصول للربط البرمجي (API Key is required). يرجى تمرير المفتاح عبر ترويسة x-api-key أو Authorization: Bearer."
      }, { status: 401 });
    }

    // إذا تم تمرير مفتاح API (طلب من مطور أو عميل ربط خارجي)، نتحقق من صحة المفتاح ونحدد هويته ورصيده
    if (incomingApiKey) {
      // البحث عن العميل صاحب المفتاح في Firestore
      const userQuery = query(collection(firestore, 'users'), where('apiKey', '==', incomingApiKey));
      const userSnap = await getDocs(userQuery);

      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        clientUserId = userDoc.id;
        clientUserData = userDoc.data();
      } else {
        // التحقق من مفاتيح النظام الرئيسية (Master Keys)
        const masterKeys = [
          validApiKey,
          'star_live_key_9f8e7d6c5b4a3210',
          'star_27cwiz9sw1ehc7t38svv9am'
        ].filter(Boolean);

        if (masterKeys.includes(incomingApiKey)) {
          if (payload.mobile) {
            const cleanMobile = String(payload.mobile).replace(/\D/g, '').slice(-9);
            const targetQuery = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanMobile));
            const targetSnap = await getDocs(targetQuery);
            if (!targetSnap.empty) {
              clientUserId = targetSnap.docs[0].id;
              clientUserData = targetSnap.docs[0].data();
            }
          }
          if (!clientUserId) {
            clientUserId = 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';
            const adminDoc = await getDoc(doc(firestore, 'users', clientUserId));
            if (adminDoc.exists()) {
              clientUserData = adminDoc.data();
            } else {
              clientUserData = { balance: 9999999, displayName: 'مدير النظام' };
            }
          }
        } else {
          return NextResponse.json({
            resultCode: "-401",
            status: "failed",
            message: "مفتاح الوصول غير صحيح أو غير مصرح به (Invalid API Key). يرجى فحص مفتاح الـ API الخاص بحسابك."
          }, { status: 401 });
        }
      }
    }

    // 4. معالجة طلب فحص الرصيد للعميل (إذا كان الأكشن balance)
    const isBillingAction = !action || action === 'bill' || action === 'billoffer' || service === 'sabaunits' || service === 'sabaoffer';

    if (action === 'balance' && !isInternalAppRequest) {
      if (service === 'info' && payload.type === 'provider') {
        // فحص رصيد الوكيل لدى المزود
      } else {
        return NextResponse.json({
          resultCode: "0",
          status: "success",
          user: clientUserData?.displayName || clientUserData?.phoneNumber || 'عميل',
          balance: clientUserData?.balance || 0,
          currency: "YER",
          resultDesc: `رصيد حسابك المتاح في المنظومة: ${clientUserData?.balance || 0} ريال يمني`
        });
      }
    }

    // 5. فحص الرصيد والخصم الفوري المسبق قبل إرسال الطلب للمزود
    let requiredCost = 0;
    const transid = payload.transid || generateTransId();
    const backpass = payload.backpass || generateBackpass();
    const targetMobile = String(payload.mobile || payload.playerid || username || '');
    let initialBalance = Number(clientUserData?.balance || 0);

    const shouldPerformImmediateDeduction = Boolean(isBillingAction && !isInternalAppRequest && !isInternalHandled && clientUserId);

    if (shouldPerformImmediateDeduction && clientUserId) {
      requiredCost = calculateApiTransactionCost({
        service,
        action,
        amount: payload.amount,
        num: payload.num,
        offerid: payload.offerid,
        packageid: payload.packageid,
        israsid: payload.israsid
      }, systemConfig, clientUserData);

      // الشرط الحاسم: منع أي سداد بدون رصيد كافٍ
      if (initialBalance < requiredCost) {
        return NextResponse.json({
          resultCode: "-402",
          status: "failed",
          message: `عذراً، رصيدك غير كافٍ لتنفيذ هذه العملية. الرصيد المتاح: ${initialBalance} ر.ي، التكلفة المطلوبة: ${requiredCost} ر.ي. يرجى شحن الحساب والمحاولة مجدداً.`,
          currentBalance: initialBalance,
          requiredCost: requiredCost
        }, { status: 400 });
      }

      // الخصم المباشر والفوري من الرصيد مع تسجيل المعاملة بحالة "قيد الانتظار"
      try {
        const batch = writeBatch(firestore);
        const userRef = doc(firestore, 'users', clientUserId);
        const clientTxRef = doc(firestore, `users/${clientUserId}/transactions`, transid);
        const globalTxRef = doc(firestore, 'paymentTransactions', transid);

        const timestamp = new Date().toISOString();

        batch.update(userRef, { balance: increment(-requiredCost) });

        const txRecord = {
          id: transid,
          userId: clientUserId,
          transactionDate: timestamp,
          createdAt: timestamp,
          amount: requiredCost,
          transactionType: `API: ${service || 'yemen'} (${action || 'bill'})`,
          recipientPhoneNumber: targetMobile,
          notes: `سداد عبر الربط البرمجي API. الخدمة: ${service}. المبلغ: ${requiredCost} ر.ي. (قيد الانتظار)`,
          transid: transid,
          backpass: backpass,
          status: 'pending',
          readiness: 'قيد الانتظار',
          refunded: false,
          serviceCategory: service || 'اتصالات'
        };

        batch.set(clientTxRef, txRecord);
        batch.set(globalTxRef, txRecord);

        await batch.commit();
        initialBalance -= requiredCost;
      } catch (deductErr: any) {
        console.error("Failed immediate deduction:", deductErr);
        return NextResponse.json({
          resultCode: "-500",
          status: "failed",
          message: "حدث خطأ أثناء حسم العملية من الرصيد: " + deductErr.message
        }, { status: 500 });
      }
    }

    // 6. التحقق من بيانات الاتصال بالمزود
    if (!userId || !username || !password) {
      // إذا فشلت بيانات الاعتماد، نعيد المبلغ فوراً إذا تم الخصم
      if (shouldPerformImmediateDeduction && clientUserId) {
        await refundUser(firestore, clientUserId, transid, requiredCost, 'بيانات اتصال الـ API غير مهيأة بالسيرفر');
      }
      return NextResponse.json({ 
        resultCode: "-1", 
        status: "failed",
        refunded: shouldPerformImmediateDeduction,
        message: 'بيانات اتصال الـ API غير مهيأة في السيرفر. يرجى التأكد من إعدادات الربط في لوحة تحكم المدير.' 
      }, { status: 400 });
    }

    // المعرف المستخدم في التوكن (الرقم أو رقم اللاعب أو اسم المستخدم)
    const identifier = targetMobile || username;
    const token = generateToken(password, username, transid, identifier);

    let endpoint = '';
    let apiRequestParams: any = {
      userid: userId,
      transid: transid,
      token: token,
      backurl: customBackUrl,
      backpass: backpass,
      ...payload
    };

    // توجيه الطلبات حسب نوع الخدمة والأكشن
    if (action === 'balance' || action === 'status') {
      endpoint = 'info';
      apiRequestParams.action = action;
    } else if (service === 'yem4g') {
      endpoint = 'yem4g';
      apiRequestParams.action = action || 'bill';
    } else if (service === 'post') {
      endpoint = 'post';
      apiRequestParams.action = action || 'bill';
    } else if (service === 'adenet') {
      endpoint = 'adenet';
      apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaphone') {
      endpoint = 'sabaphone';
      apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaoffer') {
      endpoint = 'sabaoffer';
      delete apiRequestParams.action;
    } else if (service === 'sbay') {
      endpoint = 'sbay';
      apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaunits') {
      endpoint = 'sabaunits';
      delete apiRequestParams.action;
    } else if (service === 'why') {
      endpoint = 'why';
      apiRequestParams.action = 'bill';
      const finalNum = String(payload.num || payload.amount || "");
      apiRequestParams.num = finalNum;
      if (payload.israsid === '1') {
        apiRequestParams.rasid = finalNum;
      } else {
        if (payload.packageid) {
          apiRequestParams.packageid = String(payload.packageid).trim();
        }
      }
    } else if (service === 'you') {
      if (action === 'billoffer' || action === 'queryoffer') {
        endpoint = 'mtnoffer';
        delete apiRequestParams.action;
      } else {
        endpoint = 'mtn';
        apiRequestParams.action = action || 'bill';
      }
    } else if (service === 'games') {
      endpoint = 'gameswcards';
    } else if (service === 'yemen' || service === 'yem' || !service) {
      if (action === 'billoffer') {
        endpoint = 'offeryem';
        apiRequestParams.action = 'billoffer';
        if (apiRequestParams.offerid) {
          apiRequestParams.offerkey = apiRequestParams.offerid;
          delete apiRequestParams.offerid;
        }
      } else {
        endpoint = 'yem';
        apiRequestParams.action = action || 'bill';
      }
    } else { 
      endpoint = 'yem';
      apiRequestParams.action = action || 'bill';
    }

    delete apiRequestParams.service;
    delete apiRequestParams.apiKey;
    const params = new URLSearchParams();
    Object.keys(apiRequestParams).forEach(key => {
      if (apiRequestParams[key] !== undefined && apiRequestParams[key] !== null) {
        params.append(key, String(apiRequestParams[key]));
      }
    });

    const fullUrl = `${apiBaseUrl}${endpoint}?${params.toString()}`;

    // 7. إرسال الطلب للمزود مع مهلة 10 ثوانٍ صارمة
    // - إذا استجاب خلال 10 ثوانٍ بالنجاح -> اعتماد العملية وإرجاع النتيجة
    // - إذا استجاب خلال 10 ثوانٍ بالرفض -> إرجاع الفلوس فوراً وإرجاع الخطأ للعميل
    // - إذا تأخر المزود عن 10 ثوانٍ -> إرجاع رد ناجح للعميل كـ "قيد الانتظار" مع بقاء الخصم
    const TIMEOUT_MS = 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const fetchPromise = fetch(fullUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 
          'Accept': 'application/json, text/plain, */*',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (StarMobile)',
        },
        cache: 'no-store'
      });

      const response = await fetchPromise;
      clearTimeout(timeoutId);

      const responseText = (await response.text()).trim();
      if (!responseText) throw new Error('رد فارغ من السيرفر المزود.');

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        const balanceMatch = responseText.match(/Your balance:?\s*([\d.]+)/i);
        if (balanceMatch) {
          return NextResponse.json({ 
            balance: balanceMatch[1], 
            resultCode: "0",
            status: "success",
            resultDesc: responseText
          });
        }
        data = { message: responseText, resultCode: "-1" };
      }

      const isSuccess = data?.resultCode === "0" || data?.resultCode === 0 || data?.resultCode === "-2" || data?.resultCode === -2 || data?.status === 'success' || data?.action === 'done';

      if (isSuccess) {
        // نجاح مؤكد من المزود خلال الـ 10 ثوانٍ -> تحديث المعاملة إلى جاهزة
        if (shouldPerformImmediateDeduction && clientUserId) {
          await markSuccessInDb(firestore, clientUserId, transid, data.resultDesc || data.message || 'تم السداد بنجاح');
        }

        return NextResponse.json({
          ...data,
          resultCode: "0",
          status: "success",
          transid: transid,
          chargedCost: requiredCost,
          remainingBalance: initialBalance,
          message: data.resultDesc || data.message || "تم تنفيذ العملية بنجاح",
          resultDesc: data.resultDesc || data.message || "تم تنفيذ العملية بنجاح"
        });

      } else {
        // رفض مؤكد من المزود خلال الـ 10 ثوانٍ -> إرجاع الفلوس فوراً وإعلام العميل
        const failReason = data.resultDesc || data.message || 'تم رفض العملية من قبل مزود الخدمة.';
        if (shouldPerformImmediateDeduction && clientUserId) {
          await refundUser(firestore, clientUserId, transid, requiredCost, failReason);
          initialBalance += requiredCost;
        }

        return NextResponse.json({
          ...data,
          resultCode: data.resultCode || "-1",
          status: "failed",
          refunded: shouldPerformImmediateDeduction,
          transid: transid,
          currentBalance: initialBalance,
          message: `${failReason} (تمت إعادة المبلغ إلى رصيدك)`,
          resultDesc: `${failReason} (تمت إعادة المبلغ إلى رصيدك)`
        }, { status: 400 });
      }

    } catch (fetchErr: any) {
      clearTimeout(timeoutId);

      // إذا تأخر المزود عن 10 ثوانٍ (AbortError) -> نعتبرها مقبولة مبدئياً وقيد الانتظار مع بقاء الخصم
      if (fetchErr.name === 'AbortError') {
        console.warn(`[Telecom API] Trans ${transid} exceeded 10s. Marking pending.`);
        return NextResponse.json({
          resultCode: "0",
          status: "pending",
          transid: transid,
          chargedCost: requiredCost,
          remainingBalance: initialBalance,
          message: "تم إرسال الطلب وهو قيد المعالجة لدى المزود (قيد الانتظار)",
          resultDesc: "تم إرسال الطلب وهو قيد المعالجة لدى المزود (قيد الانتظار)"
        });
      }

      // خطأ شبكة غير التايم آوت
      const errReason = 'فشل الاتصال بسيرفر المزود: ' + fetchErr.message;
      if (shouldPerformImmediateDeduction && clientUserId) {
        await refundUser(firestore, clientUserId, transid, requiredCost, errReason);
        initialBalance += requiredCost;
      }

      return NextResponse.json({ 
        resultCode: "-1", 
        status: "failed",
        refunded: shouldPerformImmediateDeduction,
        transid: transid,
        currentBalance: initialBalance,
        message: errReason, 
        resultDesc: errReason 
      }, { status: 504 });
    }

  } catch (error: any) {
    return NextResponse.json({ 
      resultCode: "-1", 
      status: "failed",
      message: `خطأ داخلي في الخادم: ${error.message}` 
    }, { status: 500 });
  }
}

/**
 * تحديث حالة العملية إلى ناجحة وجاهزة
 */
async function markSuccessInDb(firestore: any, userId: string, transid: string, message: string) {
  try {
    const userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
    const globalTxRef = doc(firestore, 'paymentTransactions', transid);
    const updateData = {
      status: 'success',
      readiness: 'جاهزة',
      providerMessage: message,
      completedAt: new Date().toISOString()
    };
    const batch = writeBatch(firestore);
    batch.update(userTxRef, updateData);
    batch.update(globalTxRef, updateData);
    await batch.commit();
  } catch (e) {
    console.error("Failed to update transaction to success:", e);
  }
}

/**
 * إرجاع المبلغ للعميل وتحديث حالة المعاملة إلى فاشلة ومسترجعة
 */
async function refundUser(firestore: any, userId: string, transid: string, amount: number, reason: string) {
  try {
    const userRef = doc(firestore, 'users', userId);
    const userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
    const globalTxRef = doc(firestore, 'paymentTransactions', transid);

    // التأكد من عدم تكرار الاسترجاع
    const snap = await getDoc(userTxRef);
    if (snap.exists() && snap.data()?.refunded) {
      return;
    }

    const currentNotes = snap.exists() ? (snap.data()?.notes || '') : '';
    const updatedNotes = currentNotes ? `${currentNotes}\nسبب الرفض: ${reason}` : `سبب الرفض: ${reason}`;

    const updateData = {
      status: 'failed',
      readiness: 'فاشلة',
      refunded: true,
      providerMessage: reason,
      notes: updatedNotes,
      failedAt: new Date().toISOString()
    };

    const batch = writeBatch(firestore);
    batch.update(userRef, { balance: increment(amount) });
    batch.update(userTxRef, updateData);
    batch.update(globalTxRef, updateData);
    await batch.commit();
  } catch (e) {
    console.error("Failed to refund user in API route:", e);
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    status: 'online',
    system: 'Star Mobile Telecom API Engine',
    version: '3.0.0',
    documentation: 'https://star26.vercel.app/api-docs',
    authMethod: 'API Key (Headers: x-api-key or Authorization: Bearer <API_KEY>)',
    balanceProtection: 'Immediate deduction before execution + 10s response SLA + auto refund on rejection',
    pricingEngine: 'Dynamic System Services Configuration',
    supportedServices: {
      yemen_mobile: ['query', 'bill', 'solfa', 'queryoffer', 'billoffer'],
      you: ['bill', 'billoffer', 'queryoffer'],
      sabafon: ['sabaphone (شمال)', 'sbay (جنوب)', 'sabaunits (وحدات)', 'sabaoffer (باقات) - يدعم 71 و 72'],
      why: ['bill (رصيد وباقات كرم)'],
      yemen_4g: ['query', 'bill'],
      aden_net: ['query', 'bill'],
      landline_adsl: ['query', 'bill'],
      info: ['balance', 'status']
    },
    timestamp: new Date().toISOString()
  });
}
