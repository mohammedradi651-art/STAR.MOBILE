import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية منظومة الوادي v1.6
 * تدعم الخصم من رصيد العميل بناءً على رقم جوال مرسل إذا كان الطالب مديراً (Master Key)
 */

const corsHeaders = {
  'Access-Control-Origin': '*',
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
        message: 'Unauthorized: Missing or invalid Bearer token', 
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

    const requesterDoc = querySnapshot.docs[0];
    const requesterData = requesterDoc.data();
    const isAdmin = requesterData.email === '770326828@shabakat.com' || requesterDoc.id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    const body = await req.json();
    const { action, number, packageId, subscriberId, mobile } = body;
    const origin = new URL(req.url).origin;

    // تحديد العميل الفعلي الذي سيخصم منه الرصيد
    let effectiveUserId = requesterDoc.id;
    let effectiveUserData = requesterData;

    if (isAdmin && mobile) {
        const cleanMobile = mobile.replace(/\D/g, '').slice(-9);
        const targetQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanMobile));
        const targetSnap = await getDocs(targetQ);
        if (!targetSnap.empty) {
            effectiveUserId = targetSnap.docs[0].id;
            effectiveUserData = targetSnap.docs[0].data();
        }
    }

    if (action === 'lookup') {
        const response = await fetch(`${origin}/api/alwadi/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number })
        });
        const result = await response.json();
        
        if (result.success) {
            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                message: 'Subscriber data retrieved',
                transactionId: null,
                data: {
                    subscriberName: result.data.name,
                    expiryDate: result.data.expiry,
                    daysLeft: result.data.days_left,
                    cardNumber: result.data.cardNumber
                },
                timestamp
            }, { headers: corsHeaders });
        }
        return NextResponse.json({ 
            success: false, 
            code: 'SM_NOT_FOUND', 
            message: result.message || 'Subscriber not found', 
            transactionId: null,
            data: null,
            timestamp 
        }, { status: 404, headers: corsHeaders });
    }

    if (action === 'renew') {
        const prices: Record<string, number> = { "1": 3000, "3": 6000, "7": 9000, "9": 15000 };
        const price = prices[packageId] || 0;

        if ((effectiveUserData.balance || 0) < price) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_INSUFFICIENT_BALANCE', 
                message: 'Insufficient balance', 
                transactionId: null,
                data: null,
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }

        const response = await fetch(`${origin}/api/alwadi/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: effectiveUserId, cardNumber: number, packageId, subscriberId })
        });
        const result = await response.json();

        if (result.success) {
            // الخصم من حساب العميل الفعلي في Firebase (تم في استدعاء api/alwadi/renew داخلياً، لكننا نؤكده هنا)
            // ملاحظة: استدعاء /api/alwadi/renew يقوم بالخصم وتحديث المعاملات للـ userId الممرر له.
            
            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                message: 'Renewal successful',
                transactionId: `ALW-${Date.now()}`,
                data: { 
                    cardNumber: number, 
                    packageId, 
                    amount: price,
                    clientName: effectiveUserData.displayName 
                },
                timestamp
            }, { headers: corsHeaders });
        }
        return NextResponse.json({ 
            success: false, 
            code: 'SM_PROVIDER_ERROR', 
            message: result.message || 'Renewal failed at provider', 
            transactionId: null,
            data: null,
            timestamp 
        }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ 
        success: false, 
        code: 'SM_VALIDATION_ERROR', 
        message: 'Invalid action provided', 
        transactionId: null,
        data: null,
        timestamp 
    }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error('External API Alwadi Error:', error);
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'Server error: ' + error.message, 
        transactionId: null,
        data: null,
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
