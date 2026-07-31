
import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

// المعلمات المعتمدة من متغيرات البيئة
const USERID = process.env.TELECOM_USERID;
const USERNAME = process.env.TELECOM_USERNAME;
const PASSWORD = process.env.TELECOM_PASSWORD;
const API_BASE_URL = 'http://echehanly.yrbso.net/api/yr/'; 

const generateToken = (transid: string, identifier: string) => {
  if (!PASSWORD || !USERNAME) return '';
  const hashPassword = CryptoJS.MD5(PASSWORD).toString();
  // التوكن المعتمد: MD5(MD5(password) + transid + username + identifier)
  const tokenString = hashPassword + transid + USERNAME + identifier;
  return CryptoJS.MD5(tokenString).toString();
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, service, ...payload } = body;
    
    if (!USERID || !USERNAME || !PASSWORD) {
        return new NextResponse(JSON.stringify({ message: 'Telecom settings are missing in environment variables' }), { status: 500 });
    }

    // المعرف المستخدم في التوكن (الرقم أو رقم اللاعب أو اسم المستخدم)
    const identifier = payload.mobile || payload.playerid || USERNAME;
    const transid = payload.transid || `${Date.now()}`.slice(-10);
    const token = generateToken(transid, identifier);

    let endpoint = '';
    let apiRequestParams: any = {
      userid: USERID,
      transid: transid,
      token: token,
      ...payload
    };
    
    // الأولوية لطلبات الاستعلام والحالة لتوجيهها لمسار info لضمان جلب رصيد الوكيل بدقة
    if (action === 'balance' || action === 'status') {
        endpoint = 'info';
        apiRequestParams.action = action;
    } else if (service === 'yem4g') {
        endpoint = 'yem4g';
        apiRequestParams.action = action;
    } else if (service === 'post') {
        endpoint = 'post';
        apiRequestParams.action = action;
    } else if (service === 'adenet') {
        endpoint = 'adenet';
        apiRequestParams.action = action;
    } else if (service === 'you') {
        if (action === 'billoffer' || action === 'queryoffer') {
            endpoint = 'mtnoffer';
            delete apiRequestParams.action;
        } else {
            endpoint = 'mtn';
            apiRequestParams.action = action;
        }
    } else if (service === 'games') {
        endpoint = 'gameswcards';
    } else if (service === 'yemen' || service === 'yem' || !service) {
        // Yemen Mobile Specific Handling
        if (action === 'billoffer') {
            endpoint = 'offeryem'; // السداد والتفعيل الموحد بناءً على التوثيق
            apiRequestParams.action = 'billoffer';
            // استخدام مسمى offerkey بدلاً من offerid لطلبات التفعيل المباشر
            if (apiRequestParams.offerid) {
                apiRequestParams.offerkey = apiRequestParams.offerid;
                delete apiRequestParams.offerid;
            }
        } else {
            endpoint = 'yem';
            apiRequestParams.action = action;
        }
    } else { 
        switch(action) {
            case 'query':
            case 'bill':
            case 'solfa':
            case 'queryoffer':
                endpoint = 'yem';
                apiRequestParams.action = action;
                break;
            default:
                endpoint = 'yem';
                apiRequestParams.action = action;
        }
    }

    delete apiRequestParams.service;
    const params = new URLSearchParams(apiRequestParams);
    const fullUrl = `${API_BASE_URL}${endpoint}?${params.toString()}`;

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
        
        if (!responseText) throw new Error('رد فارغ من السيرفر.');

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // محاولة جلب الرصيد من الرد النصي في حال فشل الـ JSON
            const balanceMatch = responseText.match(/Your balance:?\s*([\d.]+)/i);
            if (balanceMatch) {
                return NextResponse.json({ 
                    balance: balanceMatch[1], 
                    resultCode: "0",
                    resultDesc: responseText
                });
            }
            return new NextResponse(JSON.stringify({ message: responseText, resultCode: "-1" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return NextResponse.json(data);

    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        return new NextResponse(JSON.stringify({ message: 'فشل الاتصال: ' + fetchError.message }), { status: 504 });
    }
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ message: `خطأ داخلي: ${error.message}` }), { status: 500 });
  }
}
