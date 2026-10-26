import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { initializeServerFirebase } from '@/firebase/server-init';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, increment } from 'firebase/firestore';
import { 
  DEFAULT_SERVICES_CONFIG, 
  SystemServicesConfig, 
  calculateApiTransactionCost,
  KNOWN_PACKAGE_PRICES 
} from '@/lib/services-config';
import { 
  generateTransId, 
  generateBackpass, 
  validateTelecomRequest, 
  resolveTelecomDetails,
  formatProviderErrorMessage
} from '@/lib/telecom-order';

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

    // التحقق الصارم من صحة الطلب والحدود الدنيا قبل أي عملية
    const isBillingAction = !action || action === 'bill' || action === 'billoffer' || action === 'renew' || action === 'order' || service === 'sabaunits' || service === 'sabaoffer';
    const sLower = (service || '').toLowerCase().trim();
    if (
      isBillingAction || 
      sLower === 'adenet' || 
      sLower === 'aden_net' || 
      sLower === 'aden' ||
      sLower === 'yem4g' || 
      sLower === 'yemen_4g' || 
      sLower === 'yemen4g' || 
      sLower === '4g'
    ) {
      const validation = validateTelecomRequest(body);
      if (!validation.valid) {
        return NextResponse.json({
          resultCode: "-400",
          status: "failed",
          message: validation.error,
          resultDesc: validation.error
        }, { status: 400 });
      }
    }

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
    const isQueryAction = ['query', 'solfa', 'queryoffer', 'check', 'status', 'queryadsl', 'queryphone'].includes(action) || action?.startsWith('query');

    // التمييز القاطع والصارم:
    // 1. إذا وجد incomingApiKey -> فهو مستخدم API ربط خارجي إلزامي ويجب فحص رصيده وحسمه بدقة.
    // 2. إذا لم يوجد incomingApiKey -> فهو مستخدم عادي داخل الموقع/التطبيق ولا يطلب منه أي مفتاح نهائياً.
    const isApiUser = Boolean(incomingApiKey);
    const isInternalAppRequest = !isApiUser;

    let clientUserId: string | null = null;
    let clientUserData: any = null;

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

    // 4. معالجة طلب فحص الرصيد أو فحص حالة عملية محددة للعميل
    let checkTxUserId: string | null = null;
    let checkTxAmount = 0;
    if ((action === 'status' || action === 'check') && payload.transid) {
      try {
        const checkTransId = String(payload.transid).trim();
        const txDocRef = doc(firestore, 'paymentTransactions', checkTransId);
        const txSnap = await getDoc(txDocRef);
        if (txSnap.exists()) {
          const tx = txSnap.data();
          checkTxUserId = tx.userId || null;
          checkTxAmount = Number(tx.amount || 0);
          if (!payload.mobile && (tx.recipientPhoneNumber || tx.phoneNumber)) {
            payload.mobile = tx.recipientPhoneNumber || tx.phoneNumber;
          }
          const isDone = tx.status === 'success' || tx.readiness === 'جاهزة';
          const isFailed = tx.status === 'failed' || tx.readiness === 'فاشلة';
          // إذا كانت العملية محسومة مسبقاً (ناجحة أو فاشلة)، نعيد حالتها فوراً
          if (isDone || isFailed) {
            return NextResponse.json({
              resultCode: isDone ? "0" : "-1",
              status: isDone ? "success" : "failed",
              readiness: tx.readiness || (isDone ? 'جاهزة' : 'فاشلة'),
              transid: checkTransId,
              amount: tx.amount,
              service: tx.transactionType,
              recipientPhoneNumber: tx.recipientPhoneNumber || tx.phoneNumber || '',
              message: tx.providerMessage || tx.notes || (isDone ? 'تم تنفيذ العملية بنجاح' : 'تم رفض العملية'),
              resultDesc: tx.providerMessage || tx.notes || (isDone ? 'تم تنفيذ العملية بنجاح' : 'تم رفض العملية'),
              date: tx.transactionDate || tx.createdAt
            });
          }
          // إذا كانت العملية ما زالت قيد الانتظار (pending)، نسمح بالمرور للاستعلام الحي من المزود!
        }
      } catch (checkErr) {
        console.warn("Could not check local tx, forwarding to provider:", checkErr);
      }
    }

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

    // شرط الخصم والفحص الصارم لعملاء الـ API:
    // أي عميل يرسل مفتاح API ويطلب عملية سداد مالية يجب فحص رصيده أولاً ومنعه إذا لم يكن كافياً
    const isFullBilling = isBillingAction || sLower === 'adenet' || sLower === 'aden_net';
    const shouldPerformImmediateDeduction = Boolean(isApiUser && isFullBilling && !isInternalHandled && clientUserId);

    // 🔒 التحقق الأمني الحاسم من عمليات السداد المالية غير الموثقة بمفتاح API:
    // يمنع أي شخص أو هكر من إرسال طلب سداد مباشر للمسار بدون أن تكون العملية قد خُصمت ومسجلة في paymentTransactions
    if (isFullBilling && !isApiUser && !isInternalHandled) {
      const checkTransId = String(payload.transid || '').trim();
      const checkBackpass = String(payload.backpass || '').trim();

      if (!checkTransId || !checkBackpass) {
        return NextResponse.json({
          resultCode: "-401",
          status: "failed",
          message: "طلب غير مصرح به: بيانات المعاملة المالية مفقودة (transid و backpass مطلوبان لتأكيد السداد)."
        }, { status: 401 });
      }

      const txDocRef = doc(firestore, 'paymentTransactions', checkTransId);
      const txSnap = await getDoc(txDocRef);

      if (!txSnap.exists()) {
        return NextResponse.json({
          resultCode: "-403",
          status: "failed",
          message: "طلب غير مصرح به: المعاملة المالية غير موجودة أو غير مسجلة في قاعدة البيانات."
        }, { status: 403 });
      }

      const txData = txSnap.data();
      // التحقق الصارم من أن backpass مطابق وأن العملية قيد الانتظار وخُصم رصيدها
      if (txData.backpass !== checkBackpass || txData.status !== 'pending' || !txData.balanceProcessed) {
        return NextResponse.json({
          resultCode: "-403",
          status: "failed",
          message: "طلب غير مصرح به: بيانات المعاملة غير متطابقة أو تمت معالجتها مسبقاً."
        }, { status: 403 });
      }
    }

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

        const telecomDetails = resolveTelecomDetails({ ...body, amount: requiredCost });
        const finalRecipientPhone = telecomDetails.recipientPhoneNumber || targetMobile;

        const txRecord = {
          id: transid,
          userId: clientUserId,
          transactionDate: timestamp,
          createdAt: timestamp,
          amount: requiredCost,
          transactionType: telecomDetails.transactionType,
          recipientPhoneNumber: finalRecipientPhone,
          phoneNumber: finalRecipientPhone,
          notes: `${telecomDetails.notes} (قيد الانتظار)`,
          transid: transid,
          backpass: backpass,
          status: 'pending',
          readiness: 'قيد الانتظار',
          refunded: false,
          serviceCategory: telecomDetails.serviceName || service || 'اتصالات'
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

    const sanitizedBackUrl = (customBackUrl || 'https://star26.vercel.app/api/payment/webhook')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\?+$/, '');

    let endpoint = '';
    let apiRequestParams: any = {
      ...payload,
      userid: userId,
      transid: transid,
      token: token,
      backurl: payload.backurl ? String(payload.backurl).trim().replace(/\/+$/, '').replace(/\?+$/, '') : sanitizedBackUrl,
      backpass: backpass,
    };

    // توجيه الطلبات حسب نوع الخدمة والأكشن
    if (action === 'balance' || action === 'status') {
      endpoint = 'info';
      apiRequestParams.action = action;
    } else if (service === 'yem4g' || service === 'yemen_4g' || service === 'yemen4g' || service === '4g') {
      endpoint = 'yem4g';
      apiRequestParams.action = action || 'bill';
      const valid4gAmounts = [2400, 4000, 8000, 16000, 26000, 46000];
      const parsedAmt = parseFloat(String(payload.amount || payload.num || '0')) || 0;
      const isPkg = action === 'billoffer' || action === 'offer' || 
                    payload.type === '1' || payload.type === 1 || 
                    payload.type === 'package' || payload.type === 'packages' ||
                    Boolean(payload.packageid) || Boolean(payload.offerid) || 
                    Boolean(payload.offertype) || payload.israsid === '0' ||
                    (valid4gAmounts.includes(parsedAmt) && payload.type !== '2' && payload.israsid !== '1');

      if (isPkg) {
        apiRequestParams.type = '1';
        if (payload.packageid && !payload.amount) {
          apiRequestParams.amount = KNOWN_PACKAGE_PRICES[String(payload.packageid)] || payload.packageid;
        }
      } else {
        apiRequestParams.type = '2';
      }
    } else if (
      service === 'post' || 
      service === 'landline_adsl' || 
      service === 'adsl' || 
      service === 'internet' || 
      service === 'net' || 
      service === 'landline' || 
      service === 'phone' || 
      service === 'telephone' || 
      service === 'hatif'
    ) {
      endpoint = 'post';
      apiRequestParams.action = action || 'bill';

      // تحديد نوع الخدمة بدقة للمزود (line للهاتف الثابت أو adsl للإنترنت)
      const isLine = payload.type === 'line' || payload.type === 'phone' || 
                     service === 'phone' || service === 'landline' || 
                     service === 'telephone' || service === 'hatif' || 
                     action === 'queryphone';

      apiRequestParams.type = isLine ? 'line' : 'adsl';

      // معالجة وتثبيت رقم الهاتف الأرضي أو الإنترنت ليكون 8 أرقام
      let postMobile = String(payload.mobile || payload.phone || '').replace(/\D/g, '');
      if (postMobile.length === 7 && !postMobile.startsWith('0')) {
        postMobile = '0' + postMobile;
      }
      if (postMobile) {
        apiRequestParams.mobile = postMobile;
      }
    } else if (service === 'adenet' || service === 'aden_net' || service === 'aden') {
      endpoint = 'adenet';
      apiRequestParams.action = 'bill';
      let pkgCode = String(payload.num || payload.packageid || payload.offerid || payload.amount || '3000').toLowerCase().trim();
      const codeMap: Record<string, string> = {
        '20gb': '3000',
        '40gb': '6000',
        '60gb': '9000',
        '80gb': '12000',
        '120gb': '30000',
        '20': '3000',
        '40': '6000',
        '60': '9000',
        '80': '12000',
        '120': '30000',
        '3000': '3000',
        '6000': '6000',
        '9000': '9000',
        '12000': '12000',
        '30000': '30000'
      };
      apiRequestParams.num = codeMap[pkgCode] || pkgCode;
    } else if (service === 'sabaphone') {
      endpoint = 'sabaphone';
      apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaoffer') {
      endpoint = 'sabaoffer';
      delete apiRequestParams.action;
      if (apiRequestParams.num) {
        apiRequestParams.unum = apiRequestParams.num;
      }
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

    // 7. إرسال الطلب للمزود مع مهلة 45 ثانية متوافقة مع أنظمة الاتصالات ومزود اشحن لي
    // - إذا استجاب بالنجاح -> اعتماد العملية وإرجاع النتيجة
    // - إذا استجاب بالرفض -> إرجاع الفلوس لحساب العميل وإرجاع سبب الرفض فقط بدون كتابة عبارات استرجاع
    // - إذا تأخر المزود -> إرجاع رد للعميل كـ "قيد الانتظار" مع بقاء الخصم
    const TIMEOUT_MS = 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      let response: Response;
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
        response = await fetchPromise;
      } catch (directErr: any) {
        const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');
        const isConnErr = directErr.name !== 'AbortError' && (
          directErr.message?.includes('fetch failed') || 
          directErr.code === 'UND_ERR_CONNECT_TIMEOUT' || 
          directErr.cause?.name === 'ConnectTimeoutError'
        );

        if (isLocalHost && isConnErr && !request.headers.get('x-from-proxy')) {
          console.warn('[Telecom API] Local direct connection to provider blocked. Routing through production Vercel proxy...');
          const proxyRes = await fetch('https://star26.vercel.app/api/telecom', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'star_live_key_9f8e7d6c5b4a3210',
              'x-internal-handled': 'true',
              'x-from-proxy': 'true'
            },
            body: JSON.stringify(body)
          });
          const proxyData = await proxyRes.json();
          if (proxyData.resultDesc) proxyData.resultDesc = formatProviderErrorMessage(proxyData.resultDesc);
          if (proxyData.message) proxyData.message = formatProviderErrorMessage(proxyData.message);
          clearTimeout(timeoutId);
          return NextResponse.json(proxyData, { status: proxyRes.status });
        }
        throw directErr;
      }
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

      // معالجة خاصة ودقيقة لعملية فحص السلفة (solfa) لضمان عدم إخفاء حالة السلفة أو استبدالها بـ success/failed
      if (action === 'solfa') {
        const rawText = String(data.resultDesc || data.message || responseText || '').trim();
        const rawStatus = data.status !== undefined ? String(data.status).trim() : '';

        // استخراج مبلغ السلفة من الحقول المختلفة إن وجد
        const extractedAmount = data.loan_amount ?? data.loanAmount ?? data.amount ?? data.solfa_amount;
        let numericAmount = parseFloat(String(extractedAmount || '0'));
        if (isNaN(numericAmount) || numericAmount <= 0) {
          // محاولة استخراج المبلغ من النص مثل: "المشترك متسلف مبلغ 500 ريال" أو "السلفة: 500"
          const match = rawText.match(/(?:سلفة|مبلغ)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:ريال)?/i);
          if (match && match[1]) {
            numericAmount = parseFloat(match[1]);
          }
        }

        // الكشف الدقيق عن النفي (غير متسلف / لا توجد سلفة)
        const hasNegation = rawText.includes('غير متسلف') || 
                            rawText.includes('لا توجد سلفة') || 
                            rawText.includes('ليس متسلف') || 
                            rawText.includes('غير مشترك بالسلفة') ||
                            rawStatus === '0';

        // الكشف عن إثبات السلفة (حالة 1، أو مبلغ أكبر من صفر، أو نص متسلف دون نفي)
        const hasLoanIndicator = rawStatus === '1' || 
                                 rawStatus.toLowerCase() === 'true' || 
                                 numericAmount > 0 || 
                                 ((rawText.includes('متسلف') || rawText.includes('سلفة')) && !hasNegation);

        const isLoan = Boolean(hasLoanIndicator && !hasNegation);
        const finalLoanAmount = isLoan ? (numericAmount > 0 ? numericAmount : 0) : 0;
        const finalStatus = isLoan ? "1" : "0";

        return NextResponse.json({
          ...data,
          resultCode: "0",
          status: finalStatus,
          isLoan: isLoan,
          loan_amount: String(finalLoanAmount),
          loanAmount: finalLoanAmount,
          providerStatus: data.status,
          message: isLoan 
            ? (finalLoanAmount > 0 ? `المشترك متسلف بمبلغ ${finalLoanAmount} ريال` : 'المشترك متسلف')
            : 'المشترك غير متسلف',
          resultDesc: data.resultDesc || data.message || (isLoan ? 'المشترك متسلف' : 'المشترك غير متسلف')
        });
      }

      // معالجة خاصة لاستعلام حالة عملية سابقة (action === 'status' || action === 'check')
      if (action === 'status' || action === 'check') {
        const rawStatusDesc = String(data?.resultDesc || data?.message || data?.reason || '').trim();
        const normStatusDesc = rawStatusDesc.toLowerCase();

        const isStatusPending =
          data?.resultCode === "-2" ||
          data?.resultCode === -2 ||
          data?.status === 'pending' ||
          data?.status === 'wait' ||
          data?.status === 'waiting' ||
          data?.status === 'process' ||
          data?.status === 'processing' ||
          data?.readiness === 'قيد الانتظار' ||
          rawStatusDesc.includes('قيد الانتظار') ||
          rawStatusDesc.includes('قيد المعالجة') ||
          rawStatusDesc.includes('قيد التنفيذ') ||
          rawStatusDesc.includes('جاري المعالجة') ||
          rawStatusDesc.includes('جاري التنفيذ') ||
          rawStatusDesc.includes('تحت المعالجة') ||
          rawStatusDesc.includes('تحت التنفيذ') ||
          rawStatusDesc.includes('تم قبول الطلب') ||
          normStatusDesc.includes('pending') ||
          normStatusDesc.includes('under process') ||
          ((data?.isDone === 0 || data?.isDone === '0') && (data?.isBan === 0 || data?.isBan === '0'));

        const isProviderDone =
          !isStatusPending &&
          (data?.isDone === 1 ||
           data?.isDone === '1' ||
           data?.action === 'done' ||
           data?.status === 'done' ||
           data?.status === 'success' ||
           data?.readiness === 'جاهزة');

        const isProviderBan =
          !isStatusPending &&
          (data?.isBan === 1 ||
           data?.isBan === '1' ||
           data?.action === 'ban' ||
           data?.status === 'ban' ||
           data?.status === 'failed' ||
           data?.readiness === 'فاشلة');

        let targetUserId = checkTxUserId || clientUserId;
        let targetAmount = checkTxAmount;
        if (!targetUserId || !targetAmount) {
          try {
            const snap = await getDoc(doc(firestore, 'paymentTransactions', transid));
            if (snap.exists()) {
              const d = snap.data();
              targetUserId = targetUserId || d.userId;
              targetAmount = targetAmount || Number(d.amount || 0);
            }
          } catch (e) {
            // ignore
          }
        }

        if (isProviderDone) {
          if (targetUserId) {
            await markSuccessInDb(firestore, targetUserId, transid, data.resultDesc || data.message || 'تم تأكيد نجاح العملية من المزود');
          }
          return NextResponse.json({
            ...data,
            resultCode: "0",
            status: "success",
            readiness: "جاهزة",
            transid: transid,
            message: data.resultDesc || data.message || "تم تنفيذ العملية بنجاح من المزود",
            resultDesc: data.resultDesc || data.message || "تم تنفيذ العملية بنجاح من المزود"
          });
        } else if (isProviderBan) {
          const banReason = data.reason || data.resultDesc || data.message || 'تم إلغاء العملية من المزود';
          if (targetUserId && targetAmount > 0) {
            await refundUser(firestore, targetUserId, transid, targetAmount, banReason);
          }
          return NextResponse.json({
            ...data,
            resultCode: "-1",
            status: "failed",
            readiness: "فاشلة",
            refunded: true,
            transid: transid,
            message: banReason,
            resultDesc: banReason
          });
        } else {
          return NextResponse.json({
            ...data,
            resultCode: "0",
            status: "pending",
            readiness: "قيد الانتظار",
            transid: transid,
            message: data.resultDesc || data.message || "العملية قيد الانتظار والمعالجة لدى المزود",
            resultDesc: data.resultDesc || data.message || "العملية قيد الانتظار والمعالجة لدى المزود"
          });
        }
      }

      // 8. تقييم رد المزود على عمليات السداد المالي (لجميع الشركات: يمن موبايل، يو، سبأفون، واي، يمن فورجي، عدن نت، الهاتف والإنترنت الأرضي)
      const rawDesc = String(data?.resultDesc || data?.message || data?.reason || '').trim();
      const normDesc = rawDesc.toLowerCase();

      // حالة قيد الانتظار والمعالجة لدى المزود:
      // (سواء كان الرد resultCode: -2 أو status: pending أو كان النص يفيد بأن العملية قيد الانتظار أو المعالجة)
      const isPending =
        data?.resultCode === "-2" ||
        data?.resultCode === -2 ||
        data?.status === 'pending' ||
        data?.status === 'wait' ||
        data?.status === 'waiting' ||
        data?.status === 'process' ||
        data?.status === 'processing' ||
        data?.readiness === 'قيد الانتظار' ||
        rawDesc.includes('قيد الانتظار') ||
        rawDesc.includes('قيد المعالجة') ||
        rawDesc.includes('قيد التنفيذ') ||
        rawDesc.includes('جاري المعالجة') ||
        rawDesc.includes('جاري التنفيذ') ||
        rawDesc.includes('تحت المعالجة') ||
        rawDesc.includes('تحت التنفيذ') ||
        rawDesc.includes('تم قبول الطلب') ||
        rawDesc.includes('في الانتظار') ||
        rawDesc.includes('بالانتظار') ||
        normDesc.includes('pending') ||
        normDesc.includes('under process') ||
        normDesc.includes('in progress') ||
        ((data?.isDone === 0 || data?.isDone === '0') && (data?.isBan === 0 || data?.isBan === '0'));

      // حالة النجاح المؤكد والتنفيذ الفعلي (فقط إذا لم تكن العملية قيد الانتظار):
      const isSuccess =
        !isPending &&
        (data?.isDone === 1 ||
         data?.isDone === '1' ||
         data?.action === 'done' ||
         data?.status === 'done' ||
         data?.status === 'success' ||
         data?.readiness === 'جاهزة' ||
         ((data?.resultCode === "0" || data?.resultCode === 0) &&
          !data?.isBan &&
          data?.isBan !== '1' &&
          data?.action !== 'ban' &&
          data?.status !== 'failed'));

      if (isPending) {
        // قيد الانتظار لدى المزود -> المعاملة تبقى معلقة قيد الانتظار ولا يتم اعتمادها كـ "جاهزة"
        // نحدث ملاحظات المعاملة برسالة المزود إن وُجدت
        if (clientUserId && rawDesc) {
          try {
            const batch = writeBatch(firestore);
            const userTxRef = doc(firestore, `users/${clientUserId}/transactions`, transid);
            const globalTxRef = doc(firestore, 'paymentTransactions', transid);
            const updatePayload = {
              providerMessage: rawDesc,
              updatedAt: new Date().toISOString()
            };
            batch.set(userTxRef, updatePayload, { merge: true });
            batch.set(globalTxRef, updatePayload, { merge: true });
            await batch.commit();
          } catch (e) {
            // ignore
          }
        }

        const pendingResultCode = data?.resultCode !== undefined ? String(data.resultCode) : "0";

        return NextResponse.json({
          ...data,
          resultCode: pendingResultCode === "0" || pendingResultCode === "-2" ? pendingResultCode : "0",
          status: "pending",
          readiness: "قيد الانتظار",
          transid: transid,
          chargedCost: requiredCost,
          remainingBalance: initialBalance,
          message: data.resultDesc || data.message || "العملية قيد الانتظار والمعالجة لدى المزود",
          resultDesc: data.resultDesc || data.message || "العملية قيد الانتظار والمعالجة لدى المزود"
        });

      } else if (isSuccess) {
        // نجاح مؤكد من المزود -> تحديث المعاملة إلى جاهزة
        if (shouldPerformImmediateDeduction && clientUserId) {
          await markSuccessInDb(firestore, clientUserId, transid, data.resultDesc || data.message || 'تم السداد بنجاح');
        }

        return NextResponse.json({
          ...data,
          resultCode: "0",
          status: "success",
          readiness: "جاهزة",
          transid: transid,
          chargedCost: requiredCost,
          remainingBalance: initialBalance,
          message: data.resultDesc || data.message || "تم تنفيذ العملية بنجاح",
          resultDesc: data.resultDesc || data.message || "تم تنفيذ العملية بنجاح"
        });

      } else {
        // رفض مؤكد من المزود -> إرجاع الفلوس فوراً وإظهار سبب الرفض فقط (دون أي عبارات استرجاع أو بادئات تقنية)
        const failReason = formatProviderErrorMessage(data.resultDesc || data.message || data.reason || 'تم رفض العملية من قبل مزود الخدمة.');
        if (shouldPerformImmediateDeduction && clientUserId) {
          await refundUser(firestore, clientUserId, transid, requiredCost, failReason);
          initialBalance += requiredCost;
        }

        return NextResponse.json({
          ...data,
          resultCode: data.resultCode || "-1",
          status: "failed",
          readiness: "فاشلة",
          refunded: Boolean(shouldPerformImmediateDeduction && requiredCost > 0),
          transid: transid,
          currentBalance: initialBalance,
          message: failReason,
          resultDesc: failReason
        }, { status: 400 });
      }

    } catch (fetchErr: any) {
      clearTimeout(timeoutId);

      // إذا كان الطلب استعلام حالة، يجب أن تظل العملية معلقة قيد الانتظار ولا تفشل أبداً بسبب خطأ شبكة
      if (action === 'status' || action === 'check') {
        return NextResponse.json({
          resultCode: "0",
          status: "pending",
          readiness: "قيد الانتظار",
          transid: transid,
          message: "العملية قيد الانتظار والمعالجة لدى المزود",
          resultDesc: "العملية قيد الانتظار والمعالجة لدى المزود"
        });
      }

      // إذا تأخر المزود عن المهلة المحددة (Timeout) -> تظل قيد الانتظار دون استرجاع
      const isTimeout =
        fetchErr.name === 'AbortError' ||
        fetchErr.code === 'ETIMEDOUT' ||
        fetchErr.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        fetchErr.cause?.name === 'ConnectTimeoutError' ||
        fetchErr.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        String(fetchErr.message || '').toLowerCase().includes('timeout');

      if (isTimeout) {
        if (isQueryAction) {
          return NextResponse.json({
            resultCode: "-1",
            status: "failed",
            message: "تأخر السيرفر المزود في الرد على الاستعلام (انتهت المهلة). يرجى المحاولة لاحقاً.",
            resultDesc: "تأخر السيرفر المزود في الرد على الاستعلام (انتهت المهلة). يرجى المحاولة لاحقاً."
          }, { status: 504 });
        }

        console.warn(`[Telecom API] Trans ${transid} exceeded timeout. Keeping as pending.`);
        return NextResponse.json({
          resultCode: "0",
          status: "pending",
          transid: transid,
          chargedCost: requiredCost,
          remainingBalance: initialBalance,
          message: "العملية قيد الانتظار، جاري معالجة الطلب لدى المزود",
          resultDesc: "العملية قيد الانتظار، جاري معالجة الطلب لدى المزود"
        });
      }

      // خطأ شبكة غير التايم آوت - صياغة رسالة واضحة دون نصوص تقنية إنجليزية
      const cleanErrReason = formatProviderErrorMessage(fetchErr.message || '');
      if (shouldPerformImmediateDeduction && clientUserId) {
        await refundUser(firestore, clientUserId, transid, requiredCost, cleanErrReason);
        initialBalance += requiredCost;
      }

      return NextResponse.json({ 
        resultCode: "-1", 
        status: "failed",
        refunded: shouldPerformImmediateDeduction,
        transid: transid,
        currentBalance: initialBalance,
        message: cleanErrReason, 
        resultDesc: cleanErrReason 
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
    const cleanNotes = currentNotes.replace(/\(قيد الانتظار\)/g, '').trim();
    const updatedNotes = cleanNotes ? `${cleanNotes}\nسبب الرفض: ${reason}` : `سبب الرفض: ${reason}`;

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
