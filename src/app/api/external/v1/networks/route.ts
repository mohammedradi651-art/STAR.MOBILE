import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, limit as firestoreLimit, getDoc } from 'firebase/firestore';

/**
 * @fileOverview بوابة الربط البرمجي للشبكات v1.5 المحدثة
 * تدعم: جلب الشبكات، جلب الفئات، وشراء الكروت (محلي + بيتي)
 * تم الإصلاح لضمان إرسال networkId ومعالجة الشراء بشكل سليم
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

    const userDoc = uSnap.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    const body = await req.json();
    const { action, networkId, classId } = body;
    const origin = new URL(req.url).origin;

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

        const localDocRef = doc(firestore, 'networks', networkId);
        const localSnap = await getDoc(localDocRef);

        if (localSnap.exists()) {
            // --- شراء محلي ---
            const catRef = doc(firestore, `networks/${networkId}/cardCategories`, classId);
            const catSnap = await getDoc(catRef);
            if (!catSnap.exists()) return NextResponse.json({ success: false, code: 'SM_NOT_FOUND', message: 'Category not found' }, { status: 404, headers: corsHeaders });
            
            const price = catSnap.data().price;
            if ((userData.balance || 0) < price) return NextResponse.json({ success: false, code: 'SM_INSUFFICIENT_BALANCE', message: 'Insufficient balance' }, { status: 400, headers: corsHeaders });

            const cardsQ = query(
                collection(firestore, `networks/${networkId}/cards`),
                where('categoryId', '==', classId),
                where('status', '==', 'available'),
                firestoreLimit(1)
            );
            const cardsSnap = await getDocs(cardsQ);

            if (cardsSnap.empty) return NextResponse.json({ success: false, code: 'SM_PROVIDER_ERROR', message: 'Out of stock in local storage' }, { status: 400, headers: corsHeaders });

            const cardDoc = cardsSnap.docs[0];
            const cardData = cardDoc.data();
            
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, 'users', userId), { balance: increment(-price) });
            batch.update(cardDoc.ref, { status: 'sold', soldTo: userId, soldTimestamp: timestamp });
            batch.set(doc(collection(firestore, `users/${userId}/transactions`)), {
                userId,
                transactionDate: timestamp,
                amount: price,
                transactionType: 'API: شراء كرت محلي',
                notes: `شبكة: ${localSnap.data().name}`,
                cardNumber: cardData.cardNumber
            });
            await batch.commit();

            return NextResponse.json({
                success: true,
                code: 'SM_SUCCESS',
                transactionId: cardDoc.id,
                data: {
                    cardNumber: cardData.cardNumber,
                    cardPassword: cardData.cardNumber,
                    price: price
                },
                timestamp
            }, { headers: corsHeaders });

        } else {
            // --- شراء خارجي (بيتي) ---
            const orderRes = await fetch(`${origin}/services/networks-api/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId })
            });
            const result = await orderRes.json();

            if (orderRes.ok && result.status === 200) {
                const card = result.data.order.card;
                // جلب السعر من قائمة الفئات للتأكد من الخصم الصحيح
                const classesRes = await fetch(`${origin}/services/networks-api/${networkId}/classes`);
                const classesData = await classesRes.json();
                const targetClass = classesData.find((c: any) => String(c.id) === String(classId));
                const price = targetClass ? targetClass.price : 0;

                if (price > 0 && (userData.balance || 0) < price) {
                    return NextResponse.json({ success: false, code: 'SM_INSUFFICIENT_BALANCE', message: 'Insufficient balance' }, { status: 400, headers: corsHeaders });
                }

                const batch = writeBatch(firestore);
                if (price > 0) batch.update(doc(firestore, 'users', userId), { balance: increment(-price) });
                batch.set(doc(collection(firestore, `users/${userId}/transactions`)), {
                    userId,
                    transactionDate: timestamp,
                    amount: price,
                    transactionType: 'API: شراء كرت خارجي',
                    notes: `شبكة بيتي: ${networkId}`,
                    cardNumber: card.cardID
                });
                await batch.commit();

                return NextResponse.json({
                    success: true,
                    code: 'SM_SUCCESS',
                    transactionId: result.data.order.uuidOrder,
                    data: {
                        cardNumber: card.cardID,
                        cardPassword: card.cardPass || card.cardID,
                        price: price
                    },
                    timestamp
                }, { headers: corsHeaders });
            }

            return NextResponse.json({ 
                success: false, 
                code: 'SM_PROVIDER_ERROR', 
                message: result.message || 'Order failed at provider' 
            }, { status: 400, headers: corsHeaders });
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
