import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية منظومة الوادي v1.7.2 (نسخة الحماية المالية النهائية)
 * - تمنع التجديد بدون Subscriber ID نهائياً.
 * - تطبق خصم 2.5% للربط البرمجي (Master & Client API).
 * - تعمل تماماً كغلاف للمسارات الداخلية الشغالة في التطبيق.
 * - تدعم وضع التجديد التجريبي (test_renew).
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
        message: 'Unauthorized: Missing token', 
        timestamp 
      }, { status: 401, headers: corsHeaders });
    }

    const apiKey = authHeader.split(' ')[1];
    const { firestore } = initializeServerFirebase();
    
    // 1. التحقق من صحة مفتاح الـ API
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

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    const body = await req.json();
    const { action, number, packageId, subscriberId } = body;
    const origin = new URL(req.url).origin;

    // --- العمليات المتاحة ---

    // أ. الاستعلام (Lookup)
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
                data: {
                    subscriberName: result.data.name,
                    expiryDate: result.data.expiry,
                    daysLeft: result.data.days_left,
                    cardNumber: result.data.cardNumber,
                    subscriberId: result.data.id // هذا هو الرقم المطلوب للخطوة التالية
                },
                timestamp
            }, { headers: corsHeaders });
        }
        return NextResponse.json({ success: false, code: 'SM_NOT_FOUND', message: result.message || 'Not found', timestamp }, { status: 404, headers: corsHeaders });
    }

    // أسعار الباقات مع خصم 2.5% (مثال: 3000 تصبح 2925)
    const originalPrices: Record<string, number> = { "1": 3000, "3": 6000, "7": 9000, "9": 15000 };
    const discountedPrices: Record<string, number> = { "1": 2925, "3": 5850, "7": 8775, "9": 14625 };
    
    const price = discountedPrices[packageId];
    if (!price && (action === 'renew' || action === 'test_renew')) {
        return NextResponse.json({ success: false, code: 'SM_VALIDATION_ERROR', message: 'Invalid packageId. Use (1, 3, 7, 9)', timestamp }, { status: 400, headers: corsHeaders });
    }

    // ب. التجديد التجريبي (Test Renew) - خصم وهمي واسترجاع فوري
    if (action === 'test_renew') {
        if ((userData.balance || 0) < price) {
            return NextResponse.json({ success: false, code: 'SM_INSUFFICIENT_BALANCE', message: 'Insufficient balance for test', timestamp }, { status: 400, headers: corsHeaders });
        }

        const batch = writeBatch(firestore);
        const txRef = doc(collection(firestore, `users/${userId}/transactions`));
        
        // تسجيل عملية تجريبية
        batch.set(txRef, {
            userId, transactionDate: timestamp, amount: price,
            transactionType: 'تجديد تجريبي (API)', notes: `تجربة كرت: ${number} - تم الاسترجاع فوراً`,
            status: 'success'
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            code: 'SM_SUCCESS',
            message: 'Test renewal successful (Balance simulated)',
            transactionId: `TEST-${Date.now()}`,
            data: { cardNumber: number, amount: price, mode: 'demo', client: userData.displayName },
            timestamp
        }, { headers: corsHeaders });
    }

    // ج. التجديد الفعلي (Renew)
    if (action === 'renew') {
        // حماية حاسمة: منع الإرسال بدون معرف المشترك نهائياً
        if (!subscriberId) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_VALIDATION_ERROR', 
                message: 'CRITICAL ERROR: subscriberId is missing. You must perform lookup first.', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }

        if ((userData.balance || 0) < price) {
            return NextResponse.json({ success: false, code: 'SM_INSUFFICIENT_BALANCE', message: 'Insufficient balance', timestamp }, { status: 400, headers: corsHeaders });
        }

        // استدعاء المسار الداخلي الشغال في التطبيق (نفس منطق تطبيقك)
        const response = await fetch(`${origin}/api/alwadi/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, cardNumber: number, packageId, subscriberId })
        });
        const result = await response.json();

        if (result.success) {
            // تنفيذ الخصم الحقيقي مع نسبة الـ 2.5%
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', userId);
            
            // خصم المبلغ الصافي بعد خصم الـ 2.5%
            batch.update(userRef, { balance: increment(-price) });

            // تسجيل العملية في سجل العميل
            const txRef = doc(collection(firestore, `users/${userId}/transactions`));
            batch.set(txRef, {
                userId,
                transactionDate: timestamp,
                amount: price,
                transactionType: `تجديد منظومة الوادي (API)`,
                notes: `رقم الكرت: ${number} - باقة: ${originalPrices[packageId]} ر.ي (تم خصم 2.5%)`,
                status: 'success'
            });

            await batch.commit();
            
            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                message: 'Renewal successful with 2.5% discount applied',
                transactionId: `ALW-API-${Date.now()}`,
                data: { cardNumber: number, amount: price, client: userData.displayName },
                timestamp
            }, { headers: corsHeaders });
        }

        return NextResponse.json({ 
            success: false, 
            code: 'SM_PROVIDER_ERROR', 
            message: result.message || 'The provider refused the request', 
            timestamp 
        }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ 
        success: false, 
        code: 'SM_VALIDATION_ERROR', 
        message: 'Action not found. Valid: lookup, renew, test_renew', 
        timestamp 
    }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'Internal server error: ' + error.message, 
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
