import { NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';
import { initializeServerFirebase } from '@/firebase/server-init';
import { doc, getDoc, writeBatch, increment, collection, query, where, getDocs } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const url = "api.alwaadi.net";
const db = "alwaadi_DB";
const USERNAME = "770326M";
const PASSWORD = "770326828moh";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-internal-handled',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const ALWADI_PRICES: Record<string, number> = {
  '1': 3000,
  '3': 6000,
  '7': 9000,
  '9': 15000,
};

function xmlrpcCall(client: any, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: any, value: any) => {
      if (err) return reject(err);
      if (value && value.faultCode) return reject(new Error(value.faultString));
      resolve(value);
    });
  });
}

/**
 * التحقق الأمني المزدوج من هوية المتصل (Firebase ID Token أو API Key)
 */
async function verifyToken(token: string, firestore: any): Promise<{ userId: string; userData: any } | null> {
  if (!token) return null;

  // 1. إذا كان التوكن هو Firebase ID Token (JWT مشفر من جوجل)
  if (token.startsWith('eyJ') && token.includes('.')) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA7TYAHxiX0qhhJpdg-_WiCbTl1nTsbznQ";
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        const uid = data.users?.[0]?.localId;
        if (uid) {
          const userDoc = await getDoc(doc(firestore, 'users', uid));
          if (userDoc.exists()) {
            return { userId: uid, userData: userDoc.data() };
          }
        }
      }
    } catch (e) {
      console.warn("Could not verify ID token via Identity Toolkit:", e);
    }
  }

  // 2. التحقق من مفاتيح API الخاصة بالعملاء
  try {
    const q = query(collection(firestore, 'users'), where('apiKey', '==', token));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { userId: snap.docs[0].id, userData: snap.docs[0].data() };
    }
  } catch (e) {
    console.warn("Error querying apiKey:", e);
  }

  // 3. التحقق من المفاتيح الرئيسية (Master Keys)
  const masterKeys = [
    'star_live_key_9f8e7d6c5b4a3210',
    'star_27cwiz9sw1ehc7t38svv9am'
  ];
  if (masterKeys.includes(token)) {
    const adminDoc = await getDoc(doc(firestore, 'users', 'wsy8bUcULSYX2J9Q9WyisiFX5ki2'));
    return {
      userId: 'wsy8bUcULSYX2J9Q9WyisiFX5ki2',
      userData: adminDoc.exists() ? adminDoc.data() : { balance: 999999 }
    };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cardNumber, packageId, subscriberId } = body;

    if (!cardNumber || !packageId) {
      return NextResponse.json({ success: false, message: "بيانات الطلب غير مكتملة (رقم الكرت والباقة مطلوبان)." }, { status: 400, headers: corsHeaders });
    }

    const { firestore } = initializeServerFirebase();

    // 1. استخراج التوكن والمصادقة الصارمة
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const xApiKey = req.headers.get('x-api-key') || '';
    const isInternalHandled = req.headers.get('x-internal-handled') === 'true';

    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (authHeader) {
      token = authHeader.trim();
    } else if (xApiKey) {
      token = xApiKey.trim();
    }

    let authResult: { userId: string; userData: any } | null = null;
    if (token) {
      authResult = await verifyToken(token, firestore);
    }

    // إذا لم يكن الطلب موثقاً ومحمياً، نرفضه فوراً بـ 401
    if (!authResult && !isInternalHandled) {
      return NextResponse.json({
        success: false,
        message: "طلب غير مصرح به: يجب تسجيل الدخول أو إرسال مفتاح API صالح لتنفيذ هذه العملية."
      }, { status: 401, headers: corsHeaders });
    }

    const effectiveUserId = authResult ? authResult.userId : (body.userId || 'unknown');
    let effectiveUserData = authResult ? authResult.userData : null;

    if (!effectiveUserData && effectiveUserId) {
      const uDoc = await getDoc(doc(firestore, 'users', effectiveUserId));
      if (uDoc.exists()) {
        effectiveUserData = uDoc.data();
      }
    }

    // 2. فحص الرصيد والخصم المسبق على السيرفر
    let finalCost = 0;
    let didDeductOnServer = false;
    let serverTransId = `ALWADI-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!isInternalHandled && effectiveUserId && effectiveUserData) {
      const baseCost = ALWADI_PRICES[String(packageId)] || 3000;
      let rate = 1;
      const isApiCust = effectiveUserData.apiKey || effectiveUserData.role === 'agent' || effectiveUserData.accountType === 'api';
      if (isApiCust) {
        rate = 0.95;
        if (effectiveUserData.alwadiDiscount && Number(effectiveUserData.alwadiDiscount) > 0) {
          const disc = Number(effectiveUserData.alwadiDiscount);
          rate = disc < 1 ? disc : (100 - disc) / 100;
        }
      }
      finalCost = Math.round(baseCost * rate);

      const currentBalance = Number(effectiveUserData.balance || 0);
      if (currentBalance < finalCost) {
        return NextResponse.json({
          success: false,
          message: `عذراً، رصيدك الحالي (${currentBalance} ر.ي) غير كافٍ لإتمام عملية التجديد (المطلوب: ${finalCost} ر.ي). يرجى شحن حسابك والمحاولة مجدداً.`
        }, { status: 400, headers: corsHeaders });
      }

      // خصم الرصيد في السيرفر وتسجيل المعاملة كـ "قيد الانتظار"
      try {
        const batch = writeBatch(firestore);
        const userRef = doc(firestore, 'users', effectiveUserId);
        const userTxRef = doc(firestore, `users/${effectiveUserId}/transactions`, serverTransId);
        const globalTxRef = doc(firestore, 'paymentTransactions', serverTransId);
        const now = new Date().toISOString();

        batch.update(userRef, { balance: increment(-finalCost) });

        const txRecord = {
          id: serverTransId,
          userId: effectiveUserId,
          transactionDate: now,
          createdAt: now,
          amount: finalCost,
          transactionType: 'تجديد منظومة الوادي',
          notes: `تجديد كرت الوادي رقم: ${cardNumber} (قيد المعالجة)`,
          recipientPhoneNumber: cardNumber,
          cardNumber: cardNumber,
          status: 'pending',
          readiness: 'قيد الانتظار',
          refunded: false,
          serviceCategory: 'منظومة الوادي'
        };

        batch.set(userTxRef, txRecord);
        batch.set(globalTxRef, txRecord);
        await batch.commit();
        didDeductOnServer = true;
      } catch (deductErr: any) {
        return NextResponse.json({
          success: false,
          message: "حدث خطأ أثناء معالجة الرصيد: " + deductErr.message
        }, { status: 500, headers: corsHeaders });
      }
    }

    // 3. الاتصال بسيرفر منظومة الوادي عبر XML-RPC
    const common = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/common' });
    let uid: any;
    try {
      uid = await xmlrpcCall(common, "authenticate", [db, USERNAME, PASSWORD, {}]);
    } catch (authErr: any) {
      if (didDeductOnServer && effectiveUserId) {
        await refundAlwadi(firestore, effectiveUserId, serverTransId, finalCost, 'فشل التوثيق مع سيرفر منظومة الوادي');
      }
      return NextResponse.json({ success: false, message: "فشل التوثيق مع سيرفر منظومة الوادي." }, { status: 502, headers: corsHeaders });
    }

    if (!uid || typeof uid !== 'number') {
      if (didDeductOnServer && effectiveUserId) {
        await refundAlwadi(firestore, effectiveUserId, serverTransId, finalCost, 'خطأ في بيانات التوثيق مع المزود');
      }
      return NextResponse.json({ success: false, message: "فشل التوثيق مع السيرفر." }, { status: 401, headers: corsHeaders });
    }

    const models = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/object' });

    const createData: any = {
      "num_card": cardNumber,
      "renewal_categories": parseInt(packageId)
    };

    if (subscriberId) {
      createData["subscriber"] = parseInt(subscriberId);
    }

    let createResult: any;
    try {
      createResult = await xmlrpcCall(models, "execute_kw", [
        db, uid, PASSWORD, "renewal.proces", "create",
        [createData]
      ]);
    } catch (execErr: any) {
      if (didDeductOnServer && effectiveUserId) {
        await refundAlwadi(firestore, effectiveUserId, serverTransId, finalCost, execErr.message || 'فشل التجديد في المنظومة');
      }
      return NextResponse.json({ success: false, message: execErr.message || "حدث خطأ غير متوقع أثناء الاتصال بالمنظومة." }, { status: 500, headers: corsHeaders });
    }

    if (createResult) {
      // وضع علامة نجاح وجاهزة على المعاملة
      if (didDeductOnServer && effectiveUserId) {
        try {
          const successBatch = writeBatch(firestore);
          const userTxRef = doc(firestore, `users/${effectiveUserId}/transactions`, serverTransId);
          const globalTxRef = doc(firestore, 'paymentTransactions', serverTransId);
          const successData = {
            status: 'success',
            readiness: 'جاهزة',
            notes: `تم تجديد كرت الوادي رقم: ${cardNumber} بنجاح. رقم السجل: ${createResult}`,
            completedAt: new Date().toISOString()
          };
          successBatch.update(userTxRef, successData);
          successBatch.update(globalTxRef, successData);
          await successBatch.commit();
        } catch (e) {
          console.warn("Could not update tx to success:", e);
        }
      }

      return NextResponse.json({
        success: true,
        message: "تم تسجيل التجديد في المنظومة بنجاح.",
        serverDeducted: didDeductOnServer,
        transid: serverTransId,
        amount: finalCost
      }, { headers: corsHeaders });
    }

    // إذا فشل إنشاء السجل
    if (didDeductOnServer && effectiveUserId) {
      await refundAlwadi(firestore, effectiveUserId, serverTransId, finalCost, 'فشل إنشاء سجل التجديد في المنظومة');
    }
    return NextResponse.json({ success: false, message: "فشل إنشاء سجل التجديد في المنظومة." }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error("Renewal Error:", error);
    return NextResponse.json({ success: false, message: error.message || "حدث خطأ غير متوقع أثناء الاتصال بالمنظومة." }, { status: 500, headers: corsHeaders });
  }
}

async function refundAlwadi(firestore: any, userId: string, transid: string, amount: number, reason: string) {
  try {
    const userRef = doc(firestore, 'users', userId);
    const userTxRef = doc(firestore, `users/${userId}/transactions`, transid);
    const globalTxRef = doc(firestore, 'paymentTransactions', transid);

    const batch = writeBatch(firestore);
    batch.update(userRef, { balance: increment(amount) });
    const failedData = {
      status: 'failed',
      readiness: 'فاشلة',
      refunded: true,
      notes: `فشلت العملية وتمت إعادة المبلغ (${amount} ر.ي): ${reason}`,
      failedAt: new Date().toISOString()
    };
    batch.update(userTxRef, failedData);
    batch.update(globalTxRef, failedData);
    await batch.commit();
  } catch (e) {
    console.error("Failed to refund alwadi transaction:", e);
  }
}
