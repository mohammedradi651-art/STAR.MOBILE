import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// قائمة مناطق مياه وادي حضرموت المعتمدة
const WATER_CITIES: Record<string, string> = {
  '1': 'سيئون',
  '2': 'تريم',
  '3': 'شبام',
  '4': 'القطن',
  '5': 'ساه'
};

/**
 * استخراج مفتاح الـ API من الهيدر أو البودي أو البارامترات
 */
function extractApiKey(req: Request, body?: any): string | null {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim();
  }
  const xApiKey = req.headers.get('x-api-key');
  if (xApiKey) return xApiKey.trim();

  if (body?.apiKey && typeof body.apiKey === 'string') return body.apiKey.trim();
  if (body?.key && typeof body.key === 'string') return body.key.trim();
  if (body?.token && typeof body.token === 'string') return body.token.trim();

  try {
    const url = new URL(req.url);
    const paramKey = url.searchParams.get('apiKey') || url.searchParams.get('key');
    if (paramKey) return paramKey.trim();
  } catch (e) {}

  return null;
}

/**
 * التحقق من صلاحية مفتاح الـ API وقراءة بيانات المستخدم ورصيده
 */
async function verifyUserByApiKey(apiKey: string, firestore: any): Promise<{ userId: string; userData: any } | null> {
  if (!apiKey) return null;

  try {
    const q = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { userId: snap.docs[0].id, userData: snap.docs[0].data() };
    }
  } catch (e) {
    console.error('Error verifying apiKey in water:', e);
  }

  // دعم المفاتيح الرئيسية في النظام (Master Keys)
  const masterKeys = [
    'star_live_key_9f8e7d6c5b4a3210',
    'star_27cwiz9sw1ehc7t38svv9am'
  ];
  if (masterKeys.includes(apiKey)) {
    try {
      const adminDoc = await getDoc(doc(firestore, 'users', 'wsy8bUcULSYX2J9Q9WyisiFX5ki2'));
      return {
        userId: 'wsy8bUcULSYX2J9Q9WyisiFX5ki2',
        userData: adminDoc.exists() ? adminDoc.data() : { balance: 999999, displayName: 'Master Admin' }
      };
    } catch (e) {}
  }

  return null;
}

/**
 * دالة جلب الفاتورة من موقع المؤسسة المحلية للمياه والصرف الصحي (مناطق وادي حضرموت)
 */
async function fetchWaterInvoice(city: string, number: string) {
  const targetUrl = `https://lwscwhd.com/f?c=${encodeURIComponent(city)}&query=${encodeURIComponent(number)}`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('فشل الاتصال بسيرفر مؤسسة المياه.');
  }

  const html = await response.text();

  // 1. استخراج الصفوف من الجدول
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows || rows.length < 2) {
    return {
      found: false,
      message: 'لم يتم العثور على بيانات لهذا الرقم في المنطقة المختارة.'
    };
  }

  // 2. قراءة بيانات الصف الثاني
  const dataRow = rows[1];
  const cells = dataRow.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
  if (!cells || cells.length < 4) {
    return {
      found: false,
      message: 'تنسيق البيانات في موقع المؤسسة غير متوقع حالياً.'
    };
  }

  const clean = (str: string) => str.replace(/<[^>]*>?/gm, '').trim();

  const extractedNumber = clean(cells[0]);
  const name = clean(cells[1]);
  const period = clean(cells[2]);
  const amountStr = clean(cells[3]).replace(/,/g, '');

  if (name && amountStr) {
    const cityName = WATER_CITIES[String(city).trim()] || `المنطقة ${city}`;
    return {
      found: true,
      name,
      amount: amountStr,
      period,
      subscriberNumber: extractedNumber || number,
      cityCode: city,
      cityName
    };
  }

  return {
    found: false,
    message: 'تعذر استخراج بيانات الفاتورة. تأكد من صحة الرقم والمنطقة.'
  };
}

/**
 * معالجة طلبات الاستعلام والتسديد للمياه
 */
export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const body = await req.json().catch(() => ({}));
    const { city, number, action } = body;
    const isPayment = action === 'pay';

    if (!city || !number) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'رقم المشترك والمدينة مطلوبان',
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    const apiKey = extractApiKey(req, body);
    const { firestore } = initializeServerFirebase();

    // 1. التحقق من مفتاح الـ API ورصيد العميل
    let authenticatedUser: { userId: string; userData: any } | null = null;
    if (apiKey) {
      authenticatedUser = await verifyUserByApiKey(apiKey, firestore);
      if (!authenticatedUser) {
        return NextResponse.json({
          success: false,
          code: 'SM_FORBIDDEN',
          message: 'مفتاح الربط API غير صحيح أو غير مفعل',
          timestamp
        }, { status: 403, headers: corsHeaders });
      }

      // شرط الرصيد: يجب أن يتوفر رصيد بحساب صاحب الـ API
      const userBalance = Number(authenticatedUser.userData.balance || 0);
      if (userBalance <= 0) {
        return NextResponse.json({
          success: false,
          code: 'SM_INSUFFICIENT_BALANCE',
          message: `عذراً، يجب أن يكون لديك رصيد في حسابك لتنفيذ هذه العملية. رصيدك الحالي: ${userBalance} ر.ي`,
          timestamp
        }, { status: 400, headers: corsHeaders });
      }
    } else if (isPayment) {
      // التسديد عبر الـ API يشترط وجود المفتاح
      return NextResponse.json({
        success: false,
        code: 'SM_UNAUTHORIZED',
        message: 'مفتاح الـ API مطلوب لتنفيذ عملية التسديد',
        timestamp
      }, { status: 401, headers: corsHeaders });
    }

    // 2. جلب بيانات الفاتورة الحقيقية من مؤسسة المياه
    const invoice = await fetchWaterInvoice(String(city).trim(), String(number).trim());
    if (!invoice.found) {
      return NextResponse.json({
        success: false,
        code: 'SM_NOT_FOUND',
        message: invoice.message,
        timestamp
      }, { status: 404, headers: corsHeaders });
    }

    const billAmount = parseFloat(invoice.amount || '0');

    // 3. مسار التسديد (Payment) لأصحاب الـ API
    if (isPayment) {
      if (isNaN(billAmount) || billAmount <= 0) {
        return NextResponse.json({
          success: false,
          code: 'SM_ZERO_AMOUNT',
          message: 'لا توجد مبالغ مستحقة للسداد على هذا المشترك (المبلغ: 0 ر.ي)',
          timestamp
        }, { status: 400, headers: corsHeaders });
      }

      const userBalance = Number(authenticatedUser!.userData.balance || 0);

      // فحص كفاية الرصيد بدون عمولة (العمولة = 0 لأصحاب الـ API)
      if (userBalance < billAmount) {
        return NextResponse.json({
          success: false,
          code: 'SM_INSUFFICIENT_BALANCE',
          message: `رصيدك الحالي لا يكفي لسداد الفاتورة. المطلوب: ${billAmount} ر.ي، المتاح: ${userBalance} ر.ي`,
          timestamp
        }, { status: 400, headers: corsHeaders });
      }

      // تجهيز العملية وحفظها في قاعدة البيانات
      const batch = writeBatch(firestore);
      const requestId = Date.now().toString().slice(-8);
      const now = new Date().toISOString();

      // أ. خصم المبلغ بدون عمولة من رصيد المستخدم
      const userRef = doc(firestore, 'users', authenticatedUser!.userId);
      batch.update(userRef, { balance: increment(-billAmount) });

      // ب. تسجيل العملية في سجل عمليات العميل بحالة ناجحة نفس العميل العادي
      const txRef = doc(collection(firestore, `users/${authenticatedUser!.userId}/transactions`));
      batch.set(txRef, {
        userId: authenticatedUser!.userId,
        transactionDate: now,
        amount: billAmount,
        transactionType: 'سداد فاتورة مياه',
        notes: `المنطقة: ${invoice.cityName} - رقم المشترك: ${invoice.subscriberNumber} - الاسم: ${invoice.name}`,
        recipientPhoneNumber: invoice.subscriberNumber,
        subscriberName: invoice.name,
        accountNumber: invoice.subscriberNumber,
        status: 'success', // ناجحة نفس العميل العادي
        readiness: 'جاهزة'
      });

      // ج. تسجيل الطلب في waterRequests ليظهر للإدارة في صفحة الطلبات كباقي العملاء
      const requestRef = doc(collection(firestore, 'waterRequests'));
      batch.set(requestRef, {
        id: requestId,
        userId: authenticatedUser!.userId,
        userName: authenticatedUser!.userData.displayName || authenticatedUser!.userData.name || 'مشترك API',
        userPhone: authenticatedUser!.userData.phoneNumber || authenticatedUser!.userData.phone || '',
        city: invoice.cityName,
        subscriberNumber: invoice.subscriberNumber,
        subscriberName: invoice.name,
        billAmount: billAmount,
        commission: 0, // بدون عمولة 200 لأصحاب الـ API
        totalAmount: billAmount,
        status: 'pending',
        timestamp: now,
        source: 'api'
      });

      await batch.commit();

      const newBalance = userBalance - billAmount;

      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        message: 'تم سداد فاتورة المياه بنجاح وإدراج الطلب في المنظومة',
        transactionId: requestId,
        data: {
          requestId,
          subscriberNumber: invoice.subscriberNumber,
          subscriberName: invoice.name,
          city: invoice.cityName,
          period: invoice.period,
          billAmount: billAmount,
          commission: 0,
          totalDeducted: billAmount,
          previousBalance: userBalance,
          remainingBalance: newBalance,
          status: 'success'
        },
        timestamp
      }, { headers: corsHeaders });
    }

    // 4. مسار الاستعلام (Lookup)
    // إذا كان صاحب API، نعرض له السعر بدون عمولة مع الرصيد
    if (authenticatedUser) {
      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        message: 'تم الاستعلام عن فاتورة المياه بنجاح',
        data: {
          name: invoice.name,
          amount: invoice.amount,
          period: invoice.period,
          subscriberNumber: invoice.subscriberNumber,
          cityCode: invoice.cityCode,
          cityName: invoice.cityName,
          commission: 0, // بدون عمولة لأصحاب المفاتيح
          totalToPay: billAmount,
          userBalance: Number(authenticatedUser.userData.balance || 0)
        },
        timestamp
      }, { headers: corsHeaders });
    }

    // استعلام الواجهة العادية (الموقع للعملاء العاديين)
    return NextResponse.json({
      success: true,
      data: {
        name: invoice.name,
        amount: invoice.amount,
        period: invoice.period,
        subscriberNumber: invoice.subscriberNumber,
        cityCode: invoice.cityCode
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Water API Error:', error);
    return NextResponse.json({
      success: false,
      code: 'SM_SERVER_ERROR',
      message: error?.message || 'فشل الاتصال بسيرفر المنظومة',
      timestamp
    }, { status: 500, headers: corsHeaders });
  }
}
