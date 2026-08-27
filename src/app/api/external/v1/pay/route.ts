import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية سداد العمليات الاحترافية v1.6
 * تدعم الخصم من رصيد العميل المستهدف إذا كان الطالب مديراً (Master Key Mode)
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
    const { mobile, action, service, amount } = body;

    if (!mobile || !action || !service) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'Missing required fields (mobile, action, service)',
        transactionId: null,
        data: null,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // 2. منطق توجيه الخصم (Redirection Logic)
    // إذا كان الطالب مديراً، نبحث عن العميل صاحب الرقم "mobile" لنخصم منه
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

    const payAmount = parseFloat(amount || "0");
    if ((effectiveUserData.balance || 0) < payAmount) {
      return NextResponse.json({
        success: false,
        code: 'SM_INSUFFICIENT_BALANCE',
        message: isAdmin ? `Insufficient balance for client ${mobile}` : 'Insufficient balance',
        transactionId: null,
        data: null,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // 3. استدعاء خدمة السداد الداخلية
    const origin = new URL(req.url).origin;
    const telecomResponse = await fetch(`${origin}/api/telecom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await telecomResponse.json();
    const isSuccess = result.resultCode === "0" || result.resultCode === 0 || result.resultCode === "-2" || result.resultCode === -2;

    if (isSuccess) {
      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', effectiveUserId);
      const transactionId = result.transid || `TX-${Date.now()}`;

      // الخصم من المستخدم الفعلي (العميل)
      batch.update(userRef, { balance: increment(-payAmount) });

      // تسجيل العملية في حساب العميل
      const txRef = doc(collection(firestore, `users/${effectiveUserId}/transactions`));
      batch.set(txRef, {
        userId: effectiveUserId,
        transactionDate: timestamp,
        amount: payAmount,
        transactionType: `API: ${service}`,
        notes: isAdmin ? `طلب عبر البوت للرقم: ${mobile}` : `طلب ربط خارجي للرقم: ${mobile}`,
        recipientPhoneNumber: mobile,
        transid: transactionId
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        message: 'Transaction processed successfully',
        transactionId: transactionId,
        data: {
            mobile: mobile,
            amount: payAmount,
            clientName: effectiveUserData.displayName,
            newBalance: (effectiveUserData.balance || 0) - payAmount
        },
        timestamp
      }, { headers: corsHeaders });
    } else {
      return NextResponse.json({
        success: false,
        code: 'SM_PROVIDER_ERROR',
        message: result.resultDesc || 'Provider failed',
        transactionId: null,
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
