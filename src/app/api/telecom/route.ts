import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { initializeServerFirebase } from '@/firebase/server-init';
import { doc, getDoc } from 'firebase/firestore';

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

    // استخراج بيانات الاعتماد من البيئة أولاً كقيم افتراضية
    let userId = process.env.TELECOM_USERID || '';
    let username = process.env.TELECOM_USERNAME || '';
    let password = process.env.TELECOM_PASSWORD || '';
    let apiBaseUrl = DEFAULT_API_BASE_URL;
    let customBackUrl = 'https://star26.vercel.app/api/payment/webhook';
    let validApiKey = process.env.TELECOM_CLIENT_API_KEY || 'star_live_key_9f8e7d6c5b4a3210';

    // محاولة جلب الإعدادات المحدثة من Firestore إذا تم ضبطها من لوحة تحكم المدير
    try {
      const { firestore } = initializeServerFirebase();
      const settingsRef = doc(firestore, 'system_settings', 'telecom_config');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const configData = settingsSnap.data();
        const apiCreds = configData?.telecomApi;
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
      console.warn("Could not read dynamic telecom settings from Firestore, using environment defaults:", e);
    }

    // التحقق من مفتاح الـ API للطلبات الخارجية (عبر Headers أو Body أو Query)
    const authHeader = request.headers.get('authorization') || '';
    const xApiKey = request.headers.get('x-api-key') || '';
    const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    const { searchParams } = new URL(request.url);
    const queryApiKey = searchParams.get('apiKey') || searchParams.get('api_key') || '';
    const incomingApiKey = xApiKey || bearerKey || queryApiKey || payload.apiKey;

    const allowedKeys = [
      validApiKey,
      'star_live_key_9f8e7d6c5b4a3210',
      'star_27cwiz9sw1ehc7t38svv9am',
    ].filter(Boolean);

    // إذا تم تقديم مفتاح API وكان غير مطابق، نرفض الطلب فوراً
    if (incomingApiKey && !allowedKeys.includes(incomingApiKey)) {
      return NextResponse.json({
        resultCode: "-401",
        message: "مفتاح الوصول غير صحيح أو غير مصرح به (Invalid API Key). يرجى فحص مفتاح الـ API المرسل."
      }, { status: 401 });
    }
    
    if (!userId || !username || !password) {
        return NextResponse.json({ 
          resultCode: "-1", 
          message: 'بيانات اتصال الـ API غير مهيأة. يرجى إدخال USERID واسم المستخدم وكلمة المرور في لوحة تحكم المدير أو متغيرات البيئة.' 
        }, { status: 400 });
    }

    // المعرف المستخدم في التوكن (الرقم أو رقم اللاعب أو اسم المستخدم)
    const identifier = payload.mobile || payload.playerid || username;
    const transid = payload.transid || `${Date.now()}`.slice(-10);
    const token = generateToken(password, username, transid, identifier);

    let endpoint = '';
    let apiRequestParams: any = {
      userid: userId,
      transid: transid,
      token: token,
      backurl: customBackUrl,
      ...payload
    };

    if (payload.backpass) {
      apiRequestParams.backpass = payload.backpass;
    }

    // توجيه الطلبات حسب نوع الخدمة والأكشن
    if (action === 'balance' || action === 'status') {
        // فحص رصيد حساب الوكيل أو حالة العملية
        endpoint = 'info';
        apiRequestParams.action = action;
    } else if (service === 'yem4g') {
        // يمن فورجي (استعلام أو سداد رصيد وباقات)
        endpoint = 'yem4g';
        apiRequestParams.action = action || 'bill';
    } else if (service === 'post') {
        // الثابت والانترنت المنزلي ADSL
        endpoint = 'post';
        apiRequestParams.action = action || 'bill';
    } else if (service === 'adenet') {
        // عدن نت (استعلام أو سداد باقات)
        endpoint = 'adenet';
        apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaphone') {
        // سبافون (شمال)
        endpoint = 'sabaphone';
        apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaoffer') {
        // باقات سبافون
        endpoint = 'sabaoffer';
        delete apiRequestParams.action;
    } else if (service === 'sbay') {
        // سبافون (جنوب)
        endpoint = 'sbay';
        apiRequestParams.action = action || 'bill';
    } else if (service === 'sabaunits') {
        // وحدات سبافون
        endpoint = 'sabaunits';
        delete apiRequestParams.action;
    } else if (service === 'why') {
        // واي (رصيد وباقات كرم)
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
        // يو YOU (رصيد، فوري، باقات)
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
        // يمن موبايل
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
    const params = new URLSearchParams();
    Object.keys(apiRequestParams).forEach(key => {
        if (apiRequestParams[key] !== undefined && apiRequestParams[key] !== null) {
            params.append(key, String(apiRequestParams[key]));
        }
    });

    const fullUrl = `${apiBaseUrl}${endpoint}?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); 

    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { 
                'Accept': 'application/json, text/plain, */*',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (StarMobile)',
            },
            cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        const responseText = (await response.text()).trim();
        
        if (!responseText) throw new Error('رد فارغ من السيرفر المزود.');

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // معالجة ردود الرصيد النصية القديمة من السيرفر
            const balanceMatch = responseText.match(/Your balance:?\s*([\d.]+)/i);
            if (balanceMatch) {
                return NextResponse.json({ 
                    balance: balanceMatch[1], 
                    resultCode: "0",
                    resultDesc: responseText
                });
            }
            return NextResponse.json({ message: responseText, resultCode: "-1" });
        }
        return NextResponse.json(data);

    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        return NextResponse.json({ message: 'فشل الاتصال بسيرفر الـ API المزود: ' + fetchError.message, resultCode: "-1" }, { status: 504 });
    }
  } catch (error: any) {
    return NextResponse.json({ message: `خطأ داخلي في الخادم: ${error.message}`, resultCode: "-1" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    status: 'online',
    system: 'Star Mobile Telecom API Engine',
    version: '2.0.0',
    documentation: 'https://star26.vercel.app/api-docs',
    authMethod: 'API Key (Headers: x-api-key or Authorization: Bearer <API_KEY>)',
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

