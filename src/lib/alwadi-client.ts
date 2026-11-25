import https from 'https';
import xmlrpc from 'xmlrpc';

export const ALWADI_HOST = 'api.alwaadi.net';
export const ALWADI_DB = 'alwaadi_DB';
export const ALWADI_USERNAME = process.env.ALWADI_USERNAME || '770326M';
export const ALWADI_PASSWORD = process.env.ALWADI_PASSWORD || '770326828moh';
export const ALWADI_STATIC_UID = Number(process.env.ALWADI_UID || 51);

const UID_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (used only if fallback authenticate runs)

const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 15,
  keepAliveMsecs: 30_000,
});

let commonClient: any = null;
let modelsClient: any = null;

function getCommonClient() {
  if (!commonClient) {
    commonClient = xmlrpc.createSecureClient({
      host: ALWADI_HOST,
      port: 443,
      path: '/xmlrpc/2/common',
      agent: keepAliveAgent,
      headers: { Connection: 'keep-alive' },
    });
  }
  return commonClient;
}

function getModelsClient() {
  if (!modelsClient) {
    modelsClient = xmlrpc.createSecureClient({
      host: ALWADI_HOST,
      port: 443,
      path: '/xmlrpc/2/object',
      agent: keepAliveAgent,
      headers: { Connection: 'keep-alive' },
    });
  }
  return modelsClient;
}

export function xmlrpcCall(client: any, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: any, value: any) => {
      if (err) return reject(err);
      if (value && value.faultCode) return reject(new Error(value.faultString));
      resolve(value);
    });
  });
}

let cachedUid: { value: number; expiresAt: number } | null = {
  value: ALWADI_STATIC_UID,
  expiresAt: Number.POSITIVE_INFINITY,
};
let inFlightUidPromise: Promise<number> | null = null;

/**
 * Returns the static Odoo uid immediately (no authenticate call).
 * Only falls back to `authenticate` if `forceRefresh` is requested after an auth error.
 */
export async function getAlwadiUid(forceRefresh = false): Promise<number> {
  const now = Date.now();
  if (!forceRefresh && cachedUid && cachedUid.expiresAt > now) {
    return cachedUid.value;
  }

  if (!forceRefresh && inFlightUidPromise) {
    return inFlightUidPromise;
  }

  inFlightUidPromise = (async () => {
    try {
      const uid = await xmlrpcCall(getCommonClient(), 'authenticate', [
        ALWADI_DB,
        ALWADI_USERNAME,
        ALWADI_PASSWORD,
        {},
      ]);
      if (!uid || typeof uid !== 'number') {
        throw new Error('فشل الاتصال بالمنظومة (خطأ في بيانات الاعتماد).');
      }
      cachedUid = { value: uid, expiresAt: Date.now() + UID_TTL_MS };
      return uid;
    } finally {
      inFlightUidPromise = null;
    }
  })();

  return inFlightUidPromise;
}

/**
 * Executes an Odoo `execute_kw` call using the static/cached uid,
 * falling back to `authenticate` once if the uid is ever rejected.
 */
export async function executeAlwadiKw(
  model: string,
  method: string,
  args: any[],
  kwargs?: Record<string, any>
): Promise<any> {
  const runWithUid = async (uid: number) => {
    const params: any[] = [ALWADI_DB, uid, ALWADI_PASSWORD, model, method, args];
    if (kwargs !== undefined) params.push(kwargs);
    return xmlrpcCall(getModelsClient(), 'execute_kw', params);
  };

  const uid = await getAlwadiUid();
  try {
    return await runWithUid(uid);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('access') || msg.includes('session') || msg.includes('uid') || msg.includes('denied')) {
      const freshUid = await getAlwadiUid(true);
      return await runWithUid(freshUid);
    }
    throw err;
  }
}

export type AlwadiLookupData = {
  id: number | null;
  name: string;
  expiry: string;
  days_left: number | string;
  cardNumber: string;
  saleCenter: string;
};

export type AlwadiLookupResult =
  | { success: true; isNewCard: boolean; data: AlwadiLookupData }
  | { success: false; message: string; status?: number };

export function calculateDaysLeft(expiryDateString: string | null): number | string {
  if (!expiryDateString) return 'غير محدد';
  try {
    const expiryDate = new Date(expiryDateString);
    const today = new Date();
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const differenceInTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(differenceInTime / (1000 * 3600 * 24));
  } catch {
    return 'غير محدد';
  }
}

function cleanSubscriberName(rawName: any, fallback = 'مشترك معروف'): string {
  if (typeof rawName !== 'string' || !rawName.trim()) return fallback;
  if (rawName.includes('|')) {
    return rawName.split('|')[1].trim() || fallback;
  }
  return rawName.trim();
}

/**
 * Live card lookup: uses static uid + keep-alive + direct exact `subscribers.search_read`
 * (no authenticate call, no temporary result caching).
 */
export async function lookupAlwadiCard(rawCardNumber: string): Promise<AlwadiLookupResult> {
  const cardNumber = String(rawCardNumber || '').trim();
  if (!cardNumber) {
    return { success: false, message: 'الرجاء إدخال رقم الكرت.', status: 400 };
  }

  const uid = await getAlwadiUid();
  const pageContext = {
    action: 371,
    menu_id: 269,
    allowed_company_ids: [1],
    uid,
  };

  // 1. البحث المباشر بالمطابقة الدقيقة في جدول المشتركين العام (طلب واحد فقط، مع أولوية غير المستبدل)
  try {
    const subResult = await executeAlwadiKw(
      'subscribers',
      'search_read',
      [[['num_card', '=', cardNumber]]],
      {
        fields: ['id', 'name', 'expiry_date', 'remaining_days', 'num_card'],
        limit: 1,
        order: 'is_replaced asc, id desc',
        context: pageContext,
      }
    );

    if (Array.isArray(subResult) && subResult.length > 0) {
      const sub = subResult[0];
      const subId = sub.id;
      const rawName = cleanSubscriberName(sub.name);
      let actualExpiry: string | null = sub.expiry_date || null;

      if (!actualExpiry) {
        try {
          const onchangeResult = await executeAlwadiKw(
            'renewal.proces',
            'onchange',
            [
              [],
              {
                number: 'جديد',
                subscriber: subId,
                num_card: false,
                expiry_date: false,
                payment_type: false,
              },
              ['subscriber', 'num_card', 'number'],
              {
                number: {},
                subscriber: {},
                num_card: {},
                expiry_date: {},
              },
            ],
            { context: pageContext }
          );

          if (onchangeResult && onchangeResult.value) {
            actualExpiry = onchangeResult.value.expiry_date || null;
          }
        } catch (onchangeError) {
          console.error('فشلت محاكاة onchange:', onchangeError);
        }
      }

      return {
        success: true,
        isNewCard: true,
        data: {
          id: subId,
          name: rawName,
          expiry: actualExpiry || 'غير محدد',
          days_left: calculateDaysLeft(actualExpiry),
          cardNumber,
          saleCenter: 'مركز الوادي',
        },
      };
    }
  } catch (subError) {
    console.error('فشل الاستعلام في subscribers:', subError);
  }

  // 2. مسار احتياطي فقط إذا لم يُعثر على الكرت في subscribers
  try {
    const processResult = await executeAlwadiKw(
      'renewal.proces',
      'search_read',
      [['|', ['num_card', '=', cardNumber], ['number', '=', cardNumber]]],
      {
        fields: ['subscriber', 'expiry_date', 'num_card'],
        limit: 1,
        order: 'id desc',
        context: pageContext,
      }
    );

    if (Array.isArray(processResult) && processResult.length > 0) {
      const item = processResult[0];
      const subId = Array.isArray(item.subscriber) ? item.subscriber[0] : null;
      const rawName = cleanSubscriberName(
        Array.isArray(item.subscriber) ? item.subscriber[1] : item.subscriber
      );
      const expiryDate = item.expiry_date || null;

      return {
        success: true,
        isNewCard: false,
        data: {
          id: subId,
          name: rawName,
          expiry: expiryDate || 'غير محدد',
          days_left: calculateDaysLeft(expiryDate),
          cardNumber,
          saleCenter: 'مركز الوادي',
        },
      };
    }
  } catch (e) {
    console.warn('لم يظهر في العمليات السابقة:', e);
  }

  return { success: false, message: 'عذراً، رقم الكرت غير موجود.' };
}
