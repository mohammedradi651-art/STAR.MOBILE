import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit, doc, getDoc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية مراقبة وشحن الإيداعات البنكية v1.7 (Master Scope)
 * تتيح للمدير (Master Key) جلب قائمة الإشعارات، ومطابقتها آلياً مع حسابات العملاء.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// 1. جلب قائمة الإيداعات (موجود مسبقاً)
export async function GET(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const statusParam = searchParams.get('status'); 

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, code: 'SM_UNAUTHORIZED', message: 'Missing Authorization header', timestamp }, { status: 401, headers: corsHeaders });
    }

    const apiKey = authHeader.split(' ')[1];
    const { firestore } = initializeServerFirebase();
    
    const uq = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
    const uSnap = await getDocs(uq);

    if (uSnap.empty) {
      return NextResponse.json({ success: false, code: 'SM_FORBIDDEN', message: 'Invalid API Key', timestamp }, { status: 403, headers: corsHeaders });
    }

    const requesterData = uSnap.docs[0].data();
    const isAdmin = requesterData.email === '770326828@shabakat.com' || uSnap.docs[0].id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    if (!isAdmin) {
        return NextResponse.json({ success: false, code: 'SM_FORBIDDEN', message: 'Master Key required', timestamp }, { status: 403, headers: corsHeaders });
    }

    let notifsQuery = query(collection(firestore, 'bankNotifications'), orderBy('timestamp', 'desc'), firestoreLimit(limitParam));
    const querySnapshot = await getDocs(notifsQuery);
    
    let deposits = querySnapshot.docs.map(doc => ({
        id: doc.id,
        bank: doc.data().bank,
        senderName: doc.data().senderName || 'Unknown',
        amount: doc.data().amount,
        identifier: doc.data().account || doc.data().reference || 'N/A',
        status: doc.data().status,
        timestamp: doc.data().timestamp
    }));

    if (statusParam) {
        deposits = deposits.filter(d => d.status === statusParam);
    }

    return NextResponse.json({ success: true, code: 'SM_SUCCESS', data: deposits, timestamp }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, code: 'SM_INTERNAL_ERROR', message: error.message, timestamp }, { status: 500, headers: corsHeaders });
  }
}

// 2. مطابقة وشحن الإيداع لحساب عميل (الجديد)
export async function POST(req: Request) {
    const timestamp = new Date().toISOString();
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, code: 'SM_UNAUTHORIZED', message: 'Unauthorized', timestamp }, { status: 401, headers: corsHeaders });
        }

        const apiKey = authHeader.split(' ')[1];
        const { firestore } = initializeServerFirebase();

        // التحقق من مفتاح المدير
        const uq = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
        const uSnap = await getDocs(uq);
        if (uSnap.empty) return NextResponse.json({ success: false, code: 'SM_FORBIDDEN', message: 'Invalid API Key', timestamp }, { status: 403, headers: corsHeaders });
        
        const requesterData = uSnap.docs[0].data();
        const isAdmin = requesterData.email === '770326828@shabakat.com' || uSnap.docs[0].id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';
        if (!isAdmin) return NextResponse.json({ success: false, code: 'SM_FORBIDDEN', message: 'Master Key required', timestamp }, { status: 403, headers: corsHeaders });

        const body = await req.json();
        const { depositId, mobile } = body;

        if (!depositId || !mobile) {
            return NextResponse.json({ success: false, code: 'SM_VALIDATION_ERROR', message: 'depositId and mobile are required', timestamp }, { status: 400, headers: corsHeaders });
        }

        // 1. جلب بيانات الإيداع
        const depositRef = doc(firestore, 'bankNotifications', depositId);
        const depositSnap = await getDoc(depositRef);

        if (!depositSnap.exists()) {
            return NextResponse.json({ success: false, code: 'SM_NOT_FOUND', message: 'Deposit not found', timestamp }, { status: 404, headers: corsHeaders });
        }

        const depositData = depositSnap.data();
        if (depositData.status === 'paid') {
            return NextResponse.json({ success: false, code: 'SM_ALREADY_PAID', message: 'Deposit already processed and credited', timestamp }, { status: 400, headers: corsHeaders });
        }

        // 2. جلب بيانات العميل المستهدف
        const cleanMobile = mobile.replace(/\D/g, '').slice(-9);
        const targetQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanMobile));
        const targetSnap = await getDocs(targetQ);

        if (targetSnap.empty) {
            return NextResponse.json({ success: false, code: 'SM_USER_NOT_FOUND', message: 'Target user not found', timestamp }, { status: 404, headers: corsHeaders });
        }

        const targetDoc = targetSnap.docs[0];
        const targetId = targetDoc.id;
        const targetData = targetDoc.data();

        // 3. تنفيذ العملية التبادلية (Batch)
        const batch = writeBatch(firestore);
        
        // أ. شحن رصيد العميل
        batch.update(targetDoc.ref, { balance: increment(depositData.amount) });

        // ب. تحديث حالة الإيداع في لوحة تحكم المدير
        batch.update(depositRef, { 
            status: 'paid', 
            paidTo: targetId, 
            paidAt: timestamp,
            matchedVia: 'Master-API'
        });

        // ج. تسجيل العملية في حساب العميل
        const txRef = doc(collection(firestore, `users/${targetId}/transactions`));
        batch.set(txRef, {
            userId: targetId,
            transactionDate: timestamp,
            amount: depositData.amount,
            transactionType: `تغذية حساب (API)`,
            notes: `مطابقة آلية عبر البوت - ${depositData.bank}`,
            status: 'success'
        });

        // د. إرسال إشعار للعميل
        const notifRef = doc(collection(firestore, `users/${targetId}/notifications`));
        batch.set(notifRef, {
            title: 'تم شحن رصيدك ✅',
            body: `تم إضافة ${depositData.amount.toLocaleString()} ريال لحسابك عبر مطابقة إيداع بنكي.`,
            timestamp: timestamp
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            code: 'SM_SUCCESS',
            message: 'Deposit credited to user successfully',
            data: {
                creditedTo: targetData.displayName,
                amount: depositData.amount,
                newBalance: (targetData.balance || 0) + depositData.amount
            },
            timestamp
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('API Deposit Credit Error:', error);
        return NextResponse.json({ success: false, code: 'SM_INTERNAL_ERROR', message: error.message, timestamp }, { status: 500, headers: corsHeaders });
    }
}
