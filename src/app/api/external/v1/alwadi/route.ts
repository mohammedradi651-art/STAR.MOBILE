import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية منظومة الوادي v1.7.5 (نسخة الربط السريع)
 * - جعلت الـ subscriberId اختيارياً بناءً على طلب المدير.
 * - تمنع التجديد بدون رقم الكرت (number) ورقم الباقة (packageId) نهائياً.
 * - تطبق خصم 2.5% للربط البرمجي.
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
                    subscriberId: result.data.id // اختياري للخطوة التالية
                },
                timestamp
            }, { headers: corsHeaders });
        }
        return NextResponse.json({ success: false, code: 'SM_NOT_FOUND', message: result.message || 'Not found', timestamp }, { status: 404, headers: corsHeaders });
    }

    // أسعار الباقات مع خصم 2.5%
    const originalPrices: Record<string, number> = { "1": 3000, "3": 6000, "7": 9000, "9": 15000 };
    const discountedPrices: Record<string, number> = { "1": 2925, "3": 5850, "7": 8775, "9": 14625 };
    
    const price = discountedPrices[packageId];

    // حماية: منع أي عملية سداد بدون رقم الكرت ورقم الباقة
    if (!number || !packageId) {
        if (action === 'renew' || action === 'test_renew') {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_VALIDATION_ERROR', 
                message: 'Card number and packageId are required', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }
    }

    if (!price && (action === 'renew' || action === 'test_renew')) {
        return NextResponse.json({ success: false, code: 'SM_VALIDATION_ERROR', message: 'Invalid packageId. Use (1, 3, 7, 9)', timestamp }, { status: 400, headers: corsHeaders });
    }

    // ب. التجديد التجريبي (Test Renew)
    if (action === 'test_renew') {
        if ((userData.balance || 0) < price) {
            return NextResponse.json({ success: false, code: 'SM_INSUFFICIENT_BALANCE', message: 'Insufficient balance for test', timestamp }, { status: 400, headers: corsHeaders });
        }

        const batch = writeBatch(firestore);
        const txRef = doc(collection(firestore, `users/${userId}/transactions`));
        
        batch.set(txRef, {
            userId, transactionDate: timestamp, amount: price,
            transactionType: 'تجديد تجريبي (API)', notes: `تجربة كرت: ${number} - تم الاسترجاع فوراً`,
            status: 'success'
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            code: 'SM_SUCCESS',
            message: 'Test renewal successful (Simulated)',
            transactionId: `TEST-${Date.now()}`,
            data: { cardNumber: number, amount: price, mode: 'demo' },
            timestamp
        }, { headers: corsHeaders });
    }

    // ج. التجديد الفعلي (Renew)
    if (action === 'renew') {
        if ((userData.balance || 0) < price) {
            return NextResponse.json({ success: false, code: 'SM_INSUFFICIENT_BALANCE', message: 'Insufficient balance', timestamp }, { status: 400, headers: corsHeaders });
        }

        // استدعاء المسار الداخلي
        const response = await fetch(`${origin}/api/alwadi/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, cardNumber: number, packageId, subscriberId })
        });
        const result = await response.json();

        if (result.success) {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', userId);
            
            batch.update(userRef, { balance: increment(-price) });

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
                message: 'Renewal successful',
                transactionId: `ALW-API-${Date.now()}`,
                data: { cardNumber: number, amount: price, client: userData.displayName },
                timestamp
            }, { headers: corsHeaders });
        }

        return NextResponse.json({ 
            success: false, 
            code: 'SM_PROVIDER_ERROR', 
            message: result.message || 'Provider error', 
            timestamp 
        }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ 
        success: false, 
        code: 'SM_VALIDATION_ERROR', 
        message: 'Action not found', 
        timestamp 
    }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'Server error: ' + error.message, 
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
