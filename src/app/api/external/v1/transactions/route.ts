import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getReadinessDetails, isTelecomService } from '@/lib/telecom-order';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * دالة استخراج والتحقق من مفتاح الـ API الخاص بالعميل
 */
async function authenticateApiKey(req: Request, body?: any) {
  const { firestore } = initializeServerFirebase();

  let apiKey: string | null = null;

  // 1. من Header: Authorization: Bearer <API_KEY>
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.split(' ')[1].trim();
  }

  // 2. من Header: x-api-key
  if (!apiKey) {
    const xApiKey = req.headers.get('x-api-key');
    if (xApiKey) apiKey = xApiKey.trim();
  }

  // 3. من Query Params: ?apiKey=...
  if (!apiKey) {
    const { searchParams } = new URL(req.url);
    const paramKey = searchParams.get('apiKey') || searchParams.get('api_key');
    if (paramKey) apiKey = paramKey.trim();
  }

  // 4. من الـ Body في حال كان طلب POST
  if (!apiKey && body && (body.apiKey || body.api_key)) {
    apiKey = (body.apiKey || body.api_key).trim();
  }

  if (!apiKey) {
    return { error: 'مفتاح الـ API مطلوب. يرجى إرساله عبر Authorization Header أو x-api-key أو كـ Parameter.', status: 401 };
  }

  // البحث عن العميل صاحب هذا المفتاح في قاعدة البيانات
  const q = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
  const snap = await getDocs(q);

  if (snap.empty) {
    return { error: 'مفتاح الـ API غير صالح أو غير موجود.', status: 403 };
  }

  const userDoc = snap.docs[0];
  const userData = userDoc.data();
  const isAdmin = userData.email === '770326828@shabakat.com' || userDoc.id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

  return { user: { id: userDoc.id, data: userData, isAdmin }, firestore };
}

/**
 * دالة تنسيق بيانات العملية المرجعة للعميل
 */
function formatTransactionOutput(tx: any) {
  const readinessInfo = isTelecomService(tx.transactionType)
    ? getReadinessDetails(tx)
    : { text: tx.status === 'success' ? 'جاهزة' : tx.status === 'failed' ? 'فاشلة' : 'قيد الانتظار', status: tx.status };

  return {
    transid: tx.transid || tx.id,
    amount: tx.amount,
    currency: 'YER',
    status: tx.status || (readinessInfo.status === 'success' ? 'success' : readinessInfo.status === 'failed' ? 'failed' : 'pending'),
    readiness: tx.readiness || readinessInfo.text,
    transactionType: tx.transactionType,
    recipientPhoneNumber: tx.recipientPhoneNumber || null,
    providerMessage: tx.providerMessage || null,
    notes: tx.notes || null,
    refunded: tx.refunded || false,
    createdAt: tx.createdAt || tx.transactionDate || null,
    completedAt: tx.completedAt || null,
    failedAt: tx.failedAt || null
  };
}

/**
 * معالج طلبات GET:
 * - استعلام عن عملية واحدة: /api/external/v1/transactions?transid=TX123
 * - استعلام عن سجل العمليات: /api/external/v1/transactions?limit=10
 */
export async function GET(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const auth = await authenticateApiKey(req);
    if ('error' in auth) {
      return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: auth.error, timestamp }, { status: auth.status, headers: corsHeaders });
    }

    const { user, firestore } = auth;
    const { searchParams } = new URL(req.url);
    const transid = searchParams.get('transid') || searchParams.get('id');
    const limitCount = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // 1. استعلام عن عملية محددة برقمها
    if (transid) {
      // البحث في سجل عمليات المستخدم
      const userTxRef = doc(firestore, `users/${user.id}/transactions`, transid);
      let txSnap = await getDoc(userTxRef);

      // في حال كان مدير، أو لم توجد في المسار المباشر، نبحث في paymentTransactions
      if (!txSnap.exists()) {
        const globalTxRef = doc(firestore, 'paymentTransactions', transid);
        const globalSnap = await getDoc(globalTxRef);
        if (globalSnap.exists()) {
          const globalData = globalSnap.data();
          // حماية الخصوصية: لا يمكن للعميل العادي رؤية عمليات غيره
          if (!user.isAdmin && globalData.userId !== user.id) {
            return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية للاطلاع على هذه العملية.', timestamp }, { status: 403, headers: corsHeaders });
          }
          txSnap = globalSnap;
        }
      }

      if (!txSnap.exists()) {
        return NextResponse.json({ success: false, code: 'NOT_FOUND', message: `العملية برقم ${transid} غير موجودة.`, timestamp }, { status: 404, headers: corsHeaders });
      }

      const txData = txSnap.data();
      return NextResponse.json({
        success: true,
        code: 'OK',
        timestamp,
        data: formatTransactionOutput(txData)
      }, { status: 200, headers: corsHeaders });
    }

    // 2. جلب قائمة بآخر عمليات العميل
    const userTxQuery = query(
      collection(firestore, `users/${user.id}/transactions`),
      orderBy('transactionDate', 'desc'),
      firestoreLimit(limitCount)
    );

    const listSnap = await getDocs(userTxQuery);
    const transactions = listSnap.docs.map(d => formatTransactionOutput({ id: d.id, ...d.data() }));

    return NextResponse.json({
      success: true,
      code: 'OK',
      total: transactions.length,
      timestamp,
      data: transactions
    }, { status: 200, headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: error.message, timestamp }, { status: 500, headers: corsHeaders });
  }
}

/**
 * معالج طلبات POST:
 * استقبال استعلام JSON: { "transid": "TX12345" }
 */
export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const auth = await authenticateApiKey(req, body);
    if ('error' in auth) {
      return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: auth.error, timestamp }, { status: auth.status, headers: corsHeaders });
    }

    const { user, firestore } = auth;
    const transid = body.transid || body.id;

    if (!transid) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'حقل transid مطلوب للاستعلام عن العملية.', timestamp }, { status: 400, headers: corsHeaders });
    }

    // البحث في سجل عمليات المستخدم
    const userTxRef = doc(firestore, `users/${user.id}/transactions`, transid);
    let txSnap = await getDoc(userTxRef);

    if (!txSnap.exists()) {
      const globalTxRef = doc(firestore, 'paymentTransactions', transid);
      const globalSnap = await getDoc(globalTxRef);
      if (globalSnap.exists()) {
        const globalData = globalSnap.data();
        if (!user.isAdmin && globalData.userId !== user.id) {
          return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'ليس لديك صلاحية للاطلاع على هذه العملية.', timestamp }, { status: 403, headers: corsHeaders });
        }
        txSnap = globalSnap;
      }
    }

    if (!txSnap.exists()) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: `العملية برقم ${transid} غير موجودة.`, timestamp }, { status: 404, headers: corsHeaders });
    }

    const txData = txSnap.data();
    return NextResponse.json({
      success: true,
      code: 'OK',
      timestamp,
      data: formatTransactionOutput(txData)
    }, { status: 200, headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: error.message, timestamp }, { status: 500, headers: corsHeaders });
  }
}
