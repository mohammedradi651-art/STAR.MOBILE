import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية فحص الرصيد المحدثة v1.5 مع دعم CORS واستقرار Firebase
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        code: 'SM_UNAUTHORIZED', 
        message: 'Missing or invalid Authorization header', 
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

    const userData = querySnapshot.docs[0].data();

    return NextResponse.json({
      success: true,
      code: 'SM_SUCCESS',
      message: 'Balance retrieved successfully',
      transactionId: null,
      data: {
          balance: userData.balance || 0,
          currency: 'YER'
      },
      timestamp
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('External API Balance Error:', error);
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'Internal server error: ' + error.message, 
        transactionId: null,
        data: null,
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
