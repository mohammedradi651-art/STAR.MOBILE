import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية الاستعلام الموحدة v1.5 مع دعم CORS واستقرار Firebase
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
    const { searchParams } = new URL(req.url);
    const mobile = searchParams.get('mobile');
    const action = searchParams.get('action') || 'query';
    const service = searchParams.get('service') || 'yem';
    const type = searchParams.get('type');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        code: 'SM_UNAUTHORIZED', 
        message: 'Unauthorized: Missing or invalid token', 
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

    if (!mobile) {
      return NextResponse.json({ 
        success: false, 
        code: 'SM_VALIDATION_ERROR', 
        message: 'Mobile number is required', 
        transactionId: null,
        data: null,
        timestamp 
      }, { status: 400, headers: corsHeaders });
    }

    const origin = new URL(req.url).origin;
    const telecomResponse = await fetch(`${origin}/api/telecom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, action, service, type: type || undefined })
    });

    const result = await telecomResponse.json();

    return NextResponse.json({
      success: true,
      code: 'SM_SUCCESS',
      message: 'Query executed successfully',
      transactionId: null,
      data: result,
      timestamp
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('External API Query Error:', error);
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
