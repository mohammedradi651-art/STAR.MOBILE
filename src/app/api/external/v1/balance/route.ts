import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية فحص الرصيد المحدثة v1.6 (Master Scope)
 * تدعم الاستعلام عن رصيد أي عميل إذا كان المفتاح المستخدم هو مفتاح مدير.
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
    const targetMobile = searchParams.get('mobile'); // رقم الجوال المراد فحصه (اختياري للمدير)

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
    
    // 1. التحقق من صحة مفتاح الـ API وتحديد هوية صاحب المفتاح
    const q = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ 
        success: false, 
        code: 'SM_FORBIDDEN', 
        message: 'Invalid API Key', 
        timestamp 
      }, { status: 403, headers: corsHeaders });
    }

    const requesterDoc = querySnapshot.docs[0];
    const requesterData = requesterDoc.data();
    const isAdmin = requesterData.email === '770326828@shabakat.com' || requesterDoc.id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    // 2. منطق الاستعلام (Master Scope)
    // إذا كان الطالب مديراً وطلب رقم جوال معين
    if (isAdmin && targetMobile) {
        const cleanMobile = targetMobile.replace(/\D/g, '').slice(-9);
        const targetQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanMobile));
        const targetSnap = await getDocs(targetQ);

        if (targetSnap.empty) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_USER_NOT_FOUND', 
                message: 'No registered user found with this mobile number', 
                timestamp 
            }, { status: 404, headers: corsHeaders });
        }

        const targetData = targetSnap.docs[0].data();
        return NextResponse.json({
            success: true,
            code: 'SM_SUCCESS',
            message: 'User balance retrieved (Admin View)',
            data: {
                user: targetData.displayName,
                mobile: targetData.phoneNumber,
                balance: targetData.balance || 0,
                currency: 'YER',
                isRegistered: true
            },
            timestamp
        }, { headers: corsHeaders });
    }

    // الوضع العادي: إرجاع رصيد صاحب المفتاح نفسه
    return NextResponse.json({
      success: true,
      code: 'SM_SUCCESS',
      message: 'Your balance retrieved successfully',
      data: {
          user: requesterData.displayName,
          balance: requesterData.balance || 0,
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
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
