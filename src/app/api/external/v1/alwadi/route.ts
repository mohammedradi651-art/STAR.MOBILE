import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية منظومة الوادي v1.5 مع دعم CORS واستقرار Firebase
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

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    const body = await req.json();
    const { action, number, packageId, subscriberId } = body;
    const origin = new URL(req.url).origin;

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

        if ((userData.balance || 0) < price) {
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
            body: JSON.stringify({ userId, cardNumber: number, packageId, subscriberId })
        });
        const result = await response.json();

        if (result.success) {
            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                message: 'Renewal successful',
                transactionId: `ALW-${Date.now()}`,
                data: { cardNumber: number, packageId, amount: price },
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
