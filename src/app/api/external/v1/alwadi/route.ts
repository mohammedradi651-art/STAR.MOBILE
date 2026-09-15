import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';

/**
 * @fileOverview نقطة نهاية منظومة الوادي v1.7.5 (نسخة الحماية القصوى)
 * - جعل الـ subscriberId إلزامياً تماماً لمنع الخسائر المالية.
 * - تعريب كافة رسائل الخطأ لسهولة التتبع.
 * - تطبيق خصم 2.5% للربط البرمجي.
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
        message: 'عذراً، التوكن مفقود أو غير صحيح', 
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
        message: 'مفتاح الربط API غير صحيح أو غير مفعل', 
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
                message: 'تم جلب بيانات المشترك بنجاح',
                data: {
                    subscriberName: result.data.name,
                    expiryDate: result.data.expiry,
                    daysLeft: result.data.days_left,
                    cardNumber: result.data.cardNumber,
                    subscriberId: result.data.id // هذا هو المعرف المطلوب للخطوة التالية
                },
                timestamp
            }, { headers: corsHeaders });
        }
        return NextResponse.json({ 
            success: false, 
            code: 'SM_NOT_FOUND', 
            message: result.message || 'رقم الكرت غير موجود في المنظومة', 
            timestamp 
        }, { status: 404, headers: corsHeaders });
    }

    // حماية حاسمة: منع السداد بدون رقم الكرت، رقم الباقة، ومعرف المشترك
    if (action === 'renew' || action === 'test_renew') {
        if (!number || !packageId) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_VALIDATION_ERROR', 
                message: 'بيانات الطلب ناقصة (رقم الكرت ورقم الباقة مطلوبان)', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }
        
        if (!subscriberId) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_VALIDATION_ERROR', 
                message: 'رقم معرف المشترك مطلوب لتنفيذ التجديد', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }
    }

    // أسعار الباقات مع خصم 2.5% المعتمد للربط
    const originalPrices: Record<string, number> = { "1": 3000, "3": 6000, "7": 9000, "9": 15000 };
    const discountedPrices: Record<string, number> = { "1": 2925, "3": 5850, "7": 8775, "9": 14625 };
    
    const price = discountedPrices[packageId];

    if (!price && (action === 'renew' || action === 'test_renew')) {
        return NextResponse.json({ 
            success: false, 
            code: 'SM_VALIDATION_ERROR', 
            message: 'رقم الباقة غير صحيح (استخدم 1، 3، 7، أو 9)', 
            timestamp 
        }, { status: 400, headers: corsHeaders });
    }

    // ب. التجديد التجريبي (Test Renew)
    if (action === 'test_renew') {
        if ((userData.balance || 0) < price) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_INSUFFICIENT_BALANCE', 
                message: 'رصيدك الحالي لا يكفي لإتمام عملية التجربة', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }

        const batch = writeBatch(firestore);
        const txRef = doc(collection(firestore, `users/${userId}/transactions`));
        
        batch.set(txRef, {
            userId, transactionDate: timestamp, amount: price,
            transactionType: 'تجديد تجريبي (API)', notes: `تجربة ربط للكرت: ${number} - تم الاسترجاع فوراً`,
            status: 'success'
        });

        await batch.commit();

        return NextResponse.json({
            success: true,
            code: 'SM_SUCCESS',
            message: 'نجحت محاكاة التجديد (وضع التجربة)',
            transactionId: `TEST-${Date.now()}`,
            data: { cardNumber: number, subscriberId: subscriberId, amount: price, mode: 'demo' },
            timestamp
        }, { headers: corsHeaders });
    }

    // ج. التجديد الفعلي (Renew)
    if (action === 'renew') {
        if ((userData.balance || 0) < price) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_INSUFFICIENT_BALANCE', 
                message: 'رصيدك الحالي في ستار موبايل غير كافٍ', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }

        // استدعاء المسار الداخلي الموثوق
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
                notes: `كرت: ${number} - باقة: ${originalPrices[packageId]} ر.ي (خصم الربط 2.5%)`,
                status: 'success'
            });

            await batch.commit();
            
            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                message: 'تم التجديد بنجاح وخصم المبلغ المخفض',
                transactionId: `ALW-API-${Date.now()}`,
                data: { cardNumber: number, subscriberId: subscriberId, amount: price, client: userData.displayName },
                timestamp
            }, { headers: corsHeaders });
        }

        return NextResponse.json({ 
            success: false, 
            code: 'SM_PROVIDER_ERROR', 
            message: result.message || 'حدث خطأ من مزود الخدمة أثناء التجديد', 
            timestamp 
        }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ 
        success: false, 
        code: 'SM_VALIDATION_ERROR', 
        message: 'العملية المطلوبة غير مدعومة', 
        timestamp 
    }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'خطأ داخلي في الخادم: ' + error.message, 
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
