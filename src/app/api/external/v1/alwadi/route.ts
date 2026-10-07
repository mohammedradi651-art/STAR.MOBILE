import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import { DEFAULT_SERVICES_CONFIG, SystemServicesConfig, calculateFinalServicePrice } from '@/lib/services-config';

/**
 * @fileOverview نقطة نهاية منظومة الوادي v1.7.5 (نسخة الذكاء والحماية القصوى)
 * - تعتمد على أسعار ونسب الربط البرمجي (System Config) وخصومات العميل (alwadiDiscount).
 * - مطابقة ذكية: التأكد من أن المعرف يخص رقم الكرت فعلياً.
 * - حماية الفئات: قبول الباقات الرسمية فقط.
 * - تعريب كامل لرسائل الخطأ.
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

    // جلب إعدادات أسعار المنظومة والربط البرمجي
    let systemConfig: SystemServicesConfig = DEFAULT_SERVICES_CONFIG;
    try {
      const configSnap = await getDoc(doc(firestore, 'system_settings', 'telecom_config'));
      if (configSnap.exists()) {
        systemConfig = { ...DEFAULT_SERVICES_CONFIG, ...(configSnap.data() as any) };
      }
    } catch (e) {
      console.warn("Could not read telecom_config in v1/alwadi:", e);
    }

    if (systemConfig.alwadi && systemConfig.alwadi.enabled === false) {
      return NextResponse.json({
        success: false,
        code: 'SM_SERVICE_DISABLED',
        message: 'خدمة منظومة الوادي معطلة حالياً في النظام',
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, number, packageId, subscriberId } = body;
    const origin = new URL(req.url).origin;

    const originalPrices: Record<string, number> = {
      "1": systemConfig.alwadi?.packages?.twoMonths || 3000,
      "3": systemConfig.alwadi?.packages?.fourMonths || 6000,
      "7": systemConfig.alwadi?.packages?.sixMonths || 9000,
      "9": systemConfig.alwadi?.packages?.oneYear || 15000
    };

    // --- جلب قائمة الباقات والأسعار المعتمدة للعميل بناءً على نسب الـ API المعتمدة ---
    if (action === 'packages' || action === 'pricing') {
      const pkgs = [
        { id: "1", name: "باقة شهرين", originalPrice: originalPrices["1"], price: calculateFinalServicePrice(originalPrices["1"], systemConfig.alwadi) },
        { id: "3", name: "باقة 4 أشهر", originalPrice: originalPrices["3"], price: calculateFinalServicePrice(originalPrices["3"], systemConfig.alwadi) },
        { id: "7", name: "باقة 6 أشهر", originalPrice: originalPrices["7"], price: calculateFinalServicePrice(originalPrices["7"], systemConfig.alwadi) },
        { id: "9", name: "باقة سنة كاملة", originalPrice: originalPrices["9"], price: calculateFinalServicePrice(originalPrices["9"], systemConfig.alwadi) }
      ];
      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        data: pkgs,
        timestamp
      }, { headers: corsHeaders });
    }

    // --- 1. عملية الاستعلام (Lookup) ---
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
                    subscriberId: result.data.id
                },
                timestamp
            }, { headers: corsHeaders });
        }
        return NextResponse.json({ 
            success: false, 
            code: 'SM_NOT_FOUND', 
            message: 'رقم الكرت غير موجود في المنظومة', 
            timestamp 
        }, { status: 404, headers: corsHeaders });
    }

    // --- 2. عمليات التجديد (Renew / Test_Renew) ---
    if (action === 'renew' || action === 'test_renew') {
        
        // أ. التحقق من وجود البيانات الأساسية
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

        // ب. التحقق من صحة رقم الباقة واحتساب السعر الدقيق بناءً على إعدادات الـ API والنسب
        const pkgIdStr = String(packageId).trim();
        const basePrice = originalPrices[pkgIdStr];
        if (!basePrice) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_VALIDATION_ERROR', 
                message: 'الباقة غير موجودة. الفئات المتاحة: 1 (شهرين), 3 (4 أشهر), 7 (6 أشهر), 9 (سنة)', 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }

        const price = calculateFinalServicePrice(
            basePrice,
            systemConfig.alwadi
        );

        // ج. المطابقة الذكية: التحقق من أن subscriberId المرسل يطابق رقم الكرت فعلياً
        try {
            const checkRes = await fetch(`${origin}/api/alwadi/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number })
            });
            const checkData = await checkRes.json();
            
            if (!checkData.success || String(checkData.data.id) !== String(subscriberId)) {
                return NextResponse.json({ 
                    success: false, 
                    code: 'SM_ID_MISMATCH', 
                    message: 'رقم المعرف لا يطابق رقم الكرت', 
                    timestamp 
                }, { status: 400, headers: corsHeaders });
            }
        } catch (e) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_LOOKUP_ERROR', 
                message: 'فشلت عملية التحقق من بيانات الكرت، حاول مرة أخرى', 
                timestamp 
            }, { status: 500, headers: corsHeaders });
        }

        // د. التحقق من الرصيد الكافي
        if ((userData.balance || 0) < price) {
            return NextResponse.json({ 
                success: false, 
                code: 'SM_INSUFFICIENT_BALANCE', 
                message: `رصيدك الحالي في ستار موبايل لا يكفي. المطلوب: ${price} ر.ي، المتاح: ${userData.balance || 0} ر.ي`, 
                timestamp 
            }, { status: 400, headers: corsHeaders });
        }

        // هـ. تنفيذ وضع التجربة (Test Renew)
        if (action === 'test_renew') {
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
                data: { cardNumber: number, subscriberId: subscriberId, amount: price, originalPrice: basePrice, mode: 'demo' },
                timestamp
            }, { headers: corsHeaders });
        }

        // و. تنفيذ التجديد الفعلي (Renew)
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
                notes: `كرت: ${number} - باقة: ${basePrice} ر.ي (سعر الربط البرمجي: ${price} ر.ي)`,
                status: 'success'
            });

            await batch.commit();
            
            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                message: 'تم التجديد بنجاح وخصم المبلغ من رصيدك',
                transactionId: `ALW-API-${Date.now()}`,
                data: { cardNumber: number, subscriberId: subscriberId, amount: price, originalPrice: basePrice, client: userData.displayName },
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
