import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية سداد العمليات الاحترافية v1.5 مع دعم CORS واستقرار Firebase
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

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

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

    const payAmount = parseFloat(amount || "0");
    if ((userData.balance || 0) < payAmount) {
      return NextResponse.json({
        success: false,
        code: 'SM_INSUFFICIENT_BALANCE',
        message: 'Insufficient balance',
        transactionId: null,
        data: null,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // استدعاء خدمة السداد الداخلية
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
      const userRef = doc(firestore, 'users', userId);
      const transactionId = result.transid || `TX-${Date.now()}`;

      batch.update(userRef, { balance: increment(-payAmount) });

      const txRef = doc(collection(firestore, `users/${userId}/transactions`));
      batch.set(txRef, {
        userId,
        transactionDate: timestamp,
        amount: payAmount,
        transactionType: `API: ${service}`,
        notes: `طلب ربط خارجي للرقم: ${mobile}`,
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
            newBalance: (userData.balance || 0) - payAmount
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
