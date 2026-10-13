import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, limit as firestoreLimit, getDoc, updateDoc, setDoc } from 'firebase/firestore';

/**
 * @fileOverview بوابة الربط البرمجي للشبكات v1.6
 * تدعم الخصم من رصيد العميل (بناءً على رقم الجوال) إذا كان الطالب مديراً (Master Key)
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
        timestamp 
      }, { status: 401, headers: corsHeaders });
    }

    const apiKey = authHeader.split(' ')[1];
    const { firestore } = initializeServerFirebase();
    
    // التحقق من هوية المستخدم
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

    const requesterDoc = uSnap.docs[0];
    const requesterData = requesterDoc.data();
    const isAdmin = requesterData.email === '770326828@shabakat.com' || requesterDoc.id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    const body = await req.json();
    const { action, networkId, classId, mobile } = body;
    const origin = new URL(req.url).origin;

    // تحديد العميل الفعلي الذي سيخصم منه الرصيد
    let effectiveUserId = requesterDoc.id;
    let effectiveUserData = requesterData;

    if (isAdmin && mobile) {
        const cleanMobile = mobile.replace(/\D/g, '').slice(-9);
        const targetQ = query(collection(firestore, 'users'), where('phoneNumber', '==', cleanMobile));
        const targetSnap = await getDocs(targetQ);
        if (!targetSnap.empty) {
            effectiveUserId = targetSnap.docs[0].id;
            effectiveUserData = targetSnap.docs[0].data();
        }
    }

    // 1. جلب كافة الشبكات (محلية + بيتي)
    if (action === 'list_networks') {
        const localSnap = await getDocs(collection(firestore, 'networks'));
        const localNets = localSnap.docs.map(d => ({
            id: d.id,
            name: d.data().name,
            location: d.data().location,
            type: 'local'
        }));

        let externalNets = [];
        try {
            const extRes = await fetch(`${origin}/services/networks-api`);
            if (extRes.ok) {
                const extData = await extRes.json();
                externalNets = extData.map((n: any) => ({
                    id: String(n.id),
                    name: n.name,
                    location: n.desc || 'شبكة API',
                    type: 'external'
                }));
            }
        } catch (e) {}

        return NextResponse.json({
            success: true,
            code: 'SM_SUCCESS',
            data: [...localNets, ...externalNets],
            timestamp
        }, { headers: corsHeaders });
    }

    // 2. جلب الفئات لشبكة معينة
    if (action === 'list_classes') {
        if (!networkId) {
            return NextResponse.json({ success: false, code: 'SM_VALIDATION_ERROR', message: 'networkId is required' }, { status: 400, headers: corsHeaders });
        }

        const localDocRef = doc(firestore, 'networks', networkId);
        const localSnap = await getDoc(localDocRef);
        
        if (localSnap.exists()) {
            const catsSnap = await getDocs(collection(firestore, `networks/${networkId}/cardCategories`));
            const cats = catsSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                price: d.data().price,
                dataLimit: d.data().capacity || '',
                validity: d.data().validity || ''
            }));
            return NextResponse.json({ success: true, code: 'SM_SUCCESS', data: cats, timestamp }, { headers: corsHeaders });
        } else {
            const extRes = await fetch(`${origin}/services/networks-api/${networkId}/classes`);
            if (!extRes.ok) return NextResponse.json({ success: false, code: 'SM_NOT_FOUND', message: 'Network not found' }, { status: 404, headers: corsHeaders });
            const data = await extRes.json();
            const mapped = data.map((c: any) => ({
                id: c.id,
                name: c.name,
                price: c.price,
                dataLimit: c.dataLimit,
                validity: c.expirationDate
            }));
            return NextResponse.json({ success: true, code: 'SM_SUCCESS', data: mapped, timestamp }, { headers: corsHeaders });
        }
    }

    // 3. تنفيذ الشراء (Order)
    if (action === 'order') {
        if (!networkId || !classId) {
            return NextResponse.json({ success: false, code: 'SM_VALIDATION_ERROR', message: 'networkId and classId are required' }, { status: 400, headers: corsHeaders });
        }

        // جلب نسبة الخصم المعتمدة للشبكات (افتراضياً 5% أي معامل 0.95 إذا لم يتم تعديله)
        let networksRate = 0.95;
        try {
            const configSnap = await getDoc(doc(firestore, 'system_settings', 'telecom_config'));
            if (configSnap.exists()) {
                const cfg = configSnap.data();
                if (cfg?.networks?.rate !== undefined && Number(cfg.networks.rate) > 0) {
                    networksRate = Number(cfg.networks.rate);
                }
            }
        } catch (e) {
            console.warn("Could not read telecom_config in v1/networks:", e);
        }

        const localDocRef = doc(firestore, 'networks', networkId);
        const localSnap = await getDoc(localDocRef);

        if (localSnap.exists()) {
            // --- شراء محلي: تطبيق سعر API المخفض (950 بدلاً من 1000) ---
            const catRef = doc(firestore, `networks/${networkId}/cardCategories`, classId);
            const catSnap = await getDoc(catRef);
            if (!catSnap.exists()) return NextResponse.json({ success: false, code: 'SM_NOT_FOUND', message: 'Category not found' }, { status: 404, headers: corsHeaders });
            
            const originalPrice = Number(catSnap.data().price) || 0;
            const discountedPrice = Math.round(originalPrice * networksRate); // 1000 * 0.95 = 950

            if ((effectiveUserData.balance || 0) < discountedPrice) {
                return NextResponse.json({ 
                    success: false, 
                    code: 'SM_INSUFFICIENT_BALANCE', 
                    message: `الرصيد غير كافٍ. المطلوب: ${discountedPrice} ر.ي، المتاح: ${effectiveUserData.balance || 0} ر.ي`, 
                    timestamp 
                }, { status: 400, headers: corsHeaders });
            }

            // 1. خصم الرصيد المخفض فوراً
            await updateDoc(doc(firestore, 'users', effectiveUserId), { balance: increment(-discountedPrice) });

            const cardsQ = query(
                collection(firestore, `networks/${networkId}/cards`),
                where('categoryId', '==', classId),
                where('status', '==', 'available'),
                firestoreLimit(1)
            );
            const cardsSnap = await getDocs(cardsQ);

            if (cardsSnap.empty) {
                // استرجاع الرصيد فوراً لعدم توفر كروت
                await updateDoc(doc(firestore, 'users', effectiveUserId), { balance: increment(discountedPrice) });
                return NextResponse.json({ success: false, code: 'SM_PROVIDER_ERROR', message: 'Out of stock in local storage (balance refunded)' }, { status: 400, headers: corsHeaders });
            }

            const cardDoc = cardsSnap.docs[0];
            const cardData = cardDoc.data();
            
            const batch = writeBatch(firestore);
            batch.update(cardDoc.ref, { status: 'sold', soldTo: effectiveUserId, soldTimestamp: timestamp });
            batch.set(doc(collection(firestore, `users/${effectiveUserId}/transactions`)), {
                userId: effectiveUserId,
                transactionDate: timestamp,
                amount: discountedPrice,
                transactionType: 'API: شراء كرت محلي',
                notes: `شبكة: ${localSnap.data().name} (السعر الأصلي: ${originalPrice} ر.ي - سعر API: ${discountedPrice} ر.ي)${isAdmin ? ' (عبر البوت)' : ''}`,
                cardNumber: cardData.cardNumber,
                status: 'completed'
            });

            // تحويل أرباح الكرت لمالك الشبكة بعد خصم 10%
            const ownerId = localSnap.data()?.ownerId;
            if (ownerId && ownerId !== 'admin') {
                const commission = Math.ceil(originalPrice * 0.10);
                const payoutAmount = originalPrice - commission;
                batch.update(doc(firestore, 'users', ownerId), { balance: increment(payoutAmount) });
                batch.set(doc(collection(firestore, `users/${ownerId}/transactions`)), {
                    userId: ownerId,
                    transactionDate: timestamp,
                    amount: payoutAmount,
                    transactionType: 'أرباح مبيعات الكروت',
                    notes: `أرباح كرت ${catSnap.data()?.name || ''} - شبكة: ${localSnap.data().name} (صافي بعد خصم 10% عمولة)`
                });
            }

            await batch.commit();

            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                transactionId: cardDoc.id,
                data: {
                    cardNumber: cardData.cardNumber,
                    cardPassword: cardData.cardNumber,
                    price: originalPrice, // 1000 السعر الرسمي ليظهر في واجهة زبائنه
                    deductedAmount: discountedPrice, // 950 المبلغ الفعلي المخصوم من رصيده
                    clientName: effectiveUserData.displayName
                },
                timestamp
            }, { headers: corsHeaders });

        } else {
            // --- شراء خارجي (بيتي): جلب السعر مباشرة من بيتي وتطبيق الخصم 5% ---
            let originalPrice = 0;
            let className = '';
            const baityApiKey = process.env.BAITYNET_NETWORKS_API_KEY;

            // أ. جلب سعر الفئة مباشرة من خادم بيتي
            if (baityApiKey && networkId) {
                try {
                    const baityClassesRes = await fetch(`https://apis.baitynet.net/api/partner/networks/${networkId}/classes`, {
                        method: 'GET',
                        headers: {
                            'x-api-key': baityApiKey.trim(),
                            'Accept': 'application/json',
                            'User-Agent': 'StarMobileApp/1.0',
                        },
                        cache: 'no-store'
                    });
                    if (baityClassesRes.ok) {
                        const json = await baityClassesRes.json();
                        const classesList = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
                        const targetClass = classesList.find((c: any) => String(c.id) === String(classId));
                        if (targetClass) {
                            originalPrice = Number(targetClass.price) || 0;
                            className = targetClass.name || '';
                        }
                    }
                } catch (e) {
                    console.error("Direct Baity classes fetch error:", e);
                }
            }

            // فحص إضافي عبر المسار الداخلي إذا لم يتم العثور على السعر
            if (originalPrice <= 0 && networkId) {
                try {
                    const extRes = await fetch(`${origin}/services/networks-api/${networkId}/classes`);
                    if (extRes.ok) {
                        const classesData = await extRes.json();
                        const targetClass = Array.isArray(classesData) ? classesData.find((c: any) => String(c.id) === String(classId)) : null;
                        if (targetClass) {
                            originalPrice = Number(targetClass.price) || 0;
                            className = targetClass.name || '';
                        }
                    }
                } catch (e) {}
            }

            // فحص إلزامي: منع إتمام الطلب إذا لم يتم التعرف على السعر لمنع شراء كروت مجانية!
            if (originalPrice <= 0) {
                return NextResponse.json({ 
                    success: false, 
                    code: 'SM_PRICE_NOT_FOUND', 
                    message: 'تعذر التحقق من سعر الباقة من مزود الخدمة، يرجى التأكد من networkId و classId', 
                    timestamp 
                }, { status: 400, headers: corsHeaders });
            }

            // احتساب السعر المخفض لصاحب الـ API (1000 * 0.95 = 950)
            const discountedPrice = Math.round(originalPrice * networksRate);

            if ((effectiveUserData.balance || 0) < discountedPrice) {
                return NextResponse.json({ 
                    success: false, 
                    code: 'SM_INSUFFICIENT_BALANCE', 
                    message: `الرصيد غير كافٍ. المطلوب: ${discountedPrice} ر.ي، المتاح: ${effectiveUserData.balance || 0} ر.ي`, 
                    timestamp 
                }, { status: 400, headers: corsHeaders });
            }

            const externalRef = `SM-API-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
            const txRef = doc(collection(firestore, `users/${effectiveUserId}/transactions`));
            const baityOrderRef = doc(firestore, 'baityOrders', externalRef);

            // 1. خصم المبلغ المخفض (950) فوراً وتسجيل الطلب معلقاً
            const initBatch = writeBatch(firestore);
            initBatch.update(doc(firestore, 'users', effectiveUserId), { balance: increment(-discountedPrice) });
            initBatch.set(txRef, {
                id: txRef.id,
                userId: effectiveUserId,
                transactionDate: timestamp,
                amount: discountedPrice,
                transactionType: 'API: شراء كرت خارجي',
                notes: `شبكة بيتي: ${networkId} (السعر الأصلي: ${originalPrice} ر.ي - سعر API: ${discountedPrice} ر.ي)${isAdmin ? ' (عبر البوت)' : ''}`,
                status: 'pending',
                externalRef: externalRef,
                networkId: String(networkId),
                classId: String(classId),
                className: className
            });
            initBatch.set(baityOrderRef, {
                externalRef: externalRef,
                userId: effectiveUserId,
                transactionId: txRef.id,
                classId: String(classId),
                className: className,
                networkId: String(networkId),
                price: discountedPrice,
                status: 'pending',
                phoneNumber: effectiveUserData.phoneNumber || '',
                displayName: effectiveUserData.displayName || '',
                createdAt: timestamp
            });
            await initBatch.commit();

            // 2. طلب الكرت مباشرة من بيتي
            try {
                const orderRes = await fetch('https://apis.baitynet.net/api/partner/orders', {
                    method: 'POST',
                    headers: {
                        'x-api-key': (baityApiKey || '').trim(),
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'StarMobileApp/1.0',
                    },
                    body: JSON.stringify({
                        externalRef,
                        data: {
                            class: classId,
                            externalRef,
                            user: {
                                identifier: process.env.BAITYNET_NETWORKS_USER_PHONE?.trim(),
                                password: process.env.BAITYNET_NETWORKS_USER_PASS?.trim()
                            }
                        }
                    }),
                    cache: 'no-store'
                });

                const result = await orderRes.json().catch(() => ({}));

                if (orderRes.ok && result.status === 200 && result.data?.order?.card) {
                    const card = result.data.order.card;

                    const finishBatch = writeBatch(firestore);
                    finishBatch.update(txRef, {
                        status: 'completed',
                        cardNumber: card.cardID,
                        cardPassword: card.cardPass || card.cardID,
                        completedAt: new Date().toISOString()
                    });
                    finishBatch.update(baityOrderRef, {
                        status: 'completed',
                        cardNumber: card.cardID,
                        cardPass: card.cardPass || '',
                        uuidOrder: result.data.order.uuidOrder || '',
                        completedAt: new Date().toISOString()
                    });
                    await finishBatch.commit().catch(() => {});

                    return NextResponse.json({
                        success: true,
                        code: 'SM_SUCCESS',
                        transactionId: result.data.order.uuidOrder || externalRef,
                        data: {
                            cardNumber: card.cardID,
                            cardPassword: card.cardPass || card.cardID,
                            price: originalPrice, // 1000 السعر الرسمي ليظهر لزبائنه في واجهتهم
                            deductedAmount: discountedPrice, // 950 المبلغ الفعلي المخصوم من رصيده
                            clientName: effectiveUserData.displayName
                        },
                        timestamp
                    }, { headers: corsHeaders });
                }

                // إذا رفض المزود الطلب بشكل صريح: استرجاع المبلغ فوراً
                if (result.status && result.status !== 200) {
                    await updateDoc(doc(firestore, 'users', effectiveUserId), { balance: increment(discountedPrice) });
                    await updateDoc(txRef, { status: 'failed', notes: `فشل من المزود وتم استرجاع الرصيد: ${result.message || ''}` });
                    await updateDoc(baityOrderRef, { status: 'failed' });

                    return NextResponse.json({
                        success: false,
                        code: 'SM_PROVIDER_ERROR',
                        message: result.message || 'فشل تنفيذ الطلب لدى المزود وتم استرجاع الرصيد تلقائياً',
                        timestamp
                    }, { status: 400, headers: corsHeaders });
                }
            } catch (fetchErr) {
                console.warn("Direct Baity order timeout/network error, keeping as pending for webhook:", fetchErr);
            }

            // في حال تأخر الرد أو انقطاع الاتصال: العملية معلقة والمبلغ مخصوم والويب هوك سيكملها
            return NextResponse.json({ 
                success: true, 
                code: 'SM_PENDING', 
                message: 'تم استلام الطلب وخصم المبلغ، والعملية قيد المزامنة مع المزود عبر الويب هوك',
                externalRef: externalRef,
                price: originalPrice,
                deductedAmount: discountedPrice,
                timestamp
            }, { status: 202, headers: corsHeaders });
        }
    }

    return NextResponse.json({ success: false, code: 'SM_VALIDATION_ERROR', message: 'Invalid action provided' }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error('External API Networks Error:', error);
    return NextResponse.json({ 
        success: false, 
        code: 'SM_INTERNAL_ERROR', 
        message: 'Server error: ' + error.message, 
        timestamp 
    }, { status: 500, headers: corsHeaders });
  }
}
