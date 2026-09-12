import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية مراقبة الإيداعات البنكية v1.6
 * تتيح للمدير فقط جلب قائمة الإشعارات الواردة من البنوك (المشقاص، الكريمي، أمجاد)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const statusParam = searchParams.get('status'); // 'unpaid' or 'paid'

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        code: 'SM_UNAUTHORIZED', 
        message: 'Missing or invalid Authorization header', 
        timestamp 
      }, { status: 401, headers: corsHeaders });
    }

    const apiKey = authHeader.split(' ')[1];
    const { firestore } = initializeServerFirebase();
    
    // 1. التحقق من أن المفتاح يخص المدير (Master Key)
    const uq = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
    const uSnap = await getDocs(uq);

    if (uSnap.empty) {
      return NextResponse.json({ 
        success: false, 
        code: 'SM_FORBIDDEN', 
        message: 'Invalid API Key', 
        timestamp 
      }, { status: 403, headers: corsHeaders });
    }

    const requesterData = uSnap.docs[0].data();
    const isAdmin = requesterData.email === '770326828@shabakat.com' || uSnap.docs[0].id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    if (!isAdmin) {
        return NextResponse.json({ 
            success: false, 
            code: 'SM_FORBIDDEN', 
            message: 'Access denied: Master Key required for this resource', 
            timestamp 
        }, { status: 403, headers: corsHeaders });
    }

    // 2. جلب الإشعارات البنكية
    let notifsQuery = query(
        collection(firestore, 'bankNotifications'), 
        orderBy('timestamp', 'desc'), 
        firestoreLimit(limitParam)
    );

    const querySnapshot = await getDocs(notifsQuery);
    
    let deposits = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            bank: data.bank === 'alomqy' ? 'Al-Mashqas' : data.bank === 'kuraimi' ? 'Al-Kuraimi' : 'Amjad Bank',
            senderName: data.senderName || 'Unknown',
            amount: data.amount,
            identifier: data.account || data.reference || 'N/A',
            status: data.status, // 'unpaid' means available for matching, 'paid' means processed
            timestamp: data.timestamp,
            rawMessage: data.rawMessage || ''
        };
    });

    // فلترة الحالة إذا طلبت
    if (statusParam) {
        deposits = deposits.filter(d => d.status === statusParam);
    }

    return NextResponse.json({
      success: true,
      code: 'SM_SUCCESS',
      message: 'Bank deposits retrieved successfully',
      count: deposits.length,
      data: deposits,
      timestamp
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('External API Deposits Error:', error);
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'Internal server error: ' + error.message, 
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
