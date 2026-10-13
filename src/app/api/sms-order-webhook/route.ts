import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  writeBatch, 
  increment, 
  limit as firestoreLimit,
  addDoc
} from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

const DEFAULT_WEBHOOK_KEY = 'STAR-SMS-770326828';
const BAITY_API_URL = 'https://apis.baitynet.net/api/partner/orders';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

/**
 * دالة مساعدة لتنظيف وتوحيد رقم الهاتف اليمني
 * تحول أي صيغة (+967, 00967, 077..., 77...) إلى 9 أرقام قياسية (مثل 770326828)
 */
function normalizeYemeniPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('00967')) cleaned = cleaned.substring(5);
  else if (cleaned.startsWith('967')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  return cleaned.trim();
}

/**
 * التحقق من مفتاح الحماية API Key
 */
function isAuthorized(req: Request, body?: any): boolean {
  const headerKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  const queryKey = new URL(req.url).searchParams.get('key') || new URL(req.url).searchParams.get('apiKey');
  const bodyKey = body?.apiKey || body?.key;

  const validKeys = [
    DEFAULT_WEBHOOK_KEY,
    process.env.SMS_WEBHOOK_KEY || '',
    '770326828'
  ].filter(Boolean);

  const providedKey = (headerKey || queryKey || bodyKey || '').trim();
  if (!providedKey) return false;
  return validKeys.includes(providedKey);
}

/**
 * البحث عن المستخدم في فايربيس برقم هاتفه
 */
async function findUserByPhone(firestore: any, rawPhone: string) {
  const cleanPhone = normalizeYemeniPhone(rawPhone);
  if (!cleanPhone) return null;

  const possiblePhones = [
    cleanPhone,
    `967${cleanPhone}`,
    `+967${cleanPhone}`,
    `0${cleanPhone}`
  ];

  // 1. البحث بحقل phoneNumber
  for (const phoneVariant of possiblePhones) {
    const q = query(collection(firestore, 'users'), where('phoneNumber', '==', phoneVariant), firestoreLimit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { doc: snap.docs[0], data: snap.docs[0].data(), cleanPhone };
    }
  }

  // 2. البحث بالإيميل الافتراضي (phone@shabakat.com)
  const emailQuery = query(collection(firestore, 'users'), where('email', '==', `${cleanPhone}@shabakat.com`), firestoreLimit(1));
  const emailSnap = await getDocs(emailQuery);
  if (!emailSnap.empty) {
    return { doc: emailSnap.docs[0], data: emailSnap.docs[0].data(), cleanPhone };
  }

  return null;
}

/**
 * GET: استعلام فوري عن رصيد وبيانات العميل برقم هاتفه
 * مثال: /api/sms-order-webhook?phone=770326828&key=STAR-SMS-770326828
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone') || searchParams.get('phoneNumber') || searchParams.get('sender');

  if (!isAuthorized(req)) {
    return NextResponse.json({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'مفتاح الحماية غير صحيح أو مفقود. استخدم x-api-key أو ?key='
    }, { status: 401, headers: CORS_HEADERS });
  }

  if (!phone) {
    return NextResponse.json({
      success: false,
      code: 'MISSING_PHONE',
      error: 'يرجى تزويد رقم هاتف العميل عبر ?phone='
    }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const { firestore } = initializeServerFirebase();
    const userResult = await findUserByPhone(firestore, phone);

    if (!userResult) {
      return NextResponse.json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: `العميل غير مسجل في تطبيق ستار موبايل برقم الهاتف (${phone}).`
      }, { status: 404, headers: CORS_HEADERS });
    }

    const { doc, data, cleanPhone } = userResult;
    const balance = Number(data.balance ?? 0);

    return NextResponse.json({
      success: true,
      code: 'BALANCE_FETCHED',
      client: {
        uid: doc.id,
        displayName: data.displayName || 'عميل ستار موبايل',
        phoneNumber: cleanPhone,
        balance: balance,
        accountType: data.accountType || 'user'
      },
      summary: `رصيد العميل (${data.displayName || cleanPhone}): ${balance} ريال`
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[SMS Webhook] GET Error:', error);
    return NextResponse.json({
      success: false,
      code: 'SERVER_ERROR',
      error: error.message || 'حدث خطأ في الخادم'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST: تنفيذ طلب الشراء وخصم الرصيد وإرجاع الكرت، أو الاستعلام عن الرصيد
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!isAuthorized(req, body)) {
    return NextResponse.json({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'مفتاح الحماية غير صحيح أو مفقود (x-api-key: STAR-SMS-770326828)'
    }, { status: 401, headers: CORS_HEADERS });
  }

  const { firestore } = initializeServerFirebase();

  // 1. إجراء فحص الرصيد إذا طُلب صراحة
  if (body.action === 'check_balance' || body.action === 'balance') {
    const phone = body.senderPhone || body.phone || body.phoneNumber;
    if (!phone) {
      return NextResponse.json({ success: false, error: 'رقم الهاتف مطلوب' }, { status: 400, headers: CORS_HEADERS });
    }
    const userResult = await findUserByPhone(firestore, phone);
    if (!userResult) {
      return NextResponse.json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: `العميل غير مسجل برقم: ${phone}`
      }, { status: 404, headers: CORS_HEADERS });
    }
    return NextResponse.json({
      success: true,
      client: {
        uid: userResult.doc.id,
        displayName: userResult.data.displayName || 'عميل ستار موبايل',
        phoneNumber: userResult.cleanPhone,
        balance: Number(userResult.data.balance ?? 0)
      }
    }, { headers: CORS_HEADERS });
  }

  // 2. معالجة طلب الشراء (Order Processing)
  let senderPhone = body.senderPhone || body.phone || body.phoneNumber || '';
  let networkName = (body.networkName || '').trim();
  let categoryName = (body.categoryName || '').trim();
  let amount = Number(body.amount ?? 0);
  let networkId = (body.networkId || '').trim();
  let categoryId = body.categoryId ? String(body.categoryId).trim() : '';
  const rawMessage = (body.rawMessage || body.message || '').trim();

  // فحص الكود المشفر الذكي في الرسالة إن وُجد: #STAR:networkId:categoryId:amount#
  if (rawMessage) {
    const starMatch = rawMessage.match(/#?STAR:([^:#\s]+):([^:#\s]+):([^:#\s]+)#?/i);
    if (starMatch) {
      if (!networkId) networkId = starMatch[1].trim();
      if (!categoryId) categoryId = starMatch[2].trim();
      if (!amount || amount <= 0) amount = Number(starMatch[3].trim());
    }

    // استخراج اسم الشبكة والفئة والمبلغ إن أرسلت نصياً
    if (!networkName) {
      const netMatch = rawMessage.match(/الشبكة\s*:\s*([^\n\r#]+)/i);
      if (netMatch) networkName = netMatch[1].trim();
    }
    if (!categoryName) {
      const catMatch = rawMessage.match(/الفئة\s*:\s*([^\n\r#]+)/i);
      if (catMatch) categoryName = catMatch[1].trim();
    }
    if (!amount || amount <= 0) {
      const amtMatch = rawMessage.match(/المبلغ\s*:\s*([0-9.]+)/i);
      if (amtMatch) amount = Number(amtMatch[1]);
    }
  }

  if (!senderPhone) {
    return NextResponse.json({
      success: false,
      code: 'MISSING_SENDER_PHONE',
      error: 'رقم الهاتف المرسل مفقود (senderPhone).'
    }, { status: 400, headers: CORS_HEADERS });
  }

  // أ. جلب العميل من قاعدة البيانات
  const userResult = await findUserByPhone(firestore, senderPhone);
  if (!userResult) {
    return NextResponse.json({
      success: false,
      code: 'USER_NOT_FOUND',
      error: `العميل صاحب الرقم (${senderPhone}) غير مسجل في تطبيق ستار موبايل.`,
      smsReply: `عزيزي العميل، رقم هاتفك (${senderPhone}) غير مسجل في تطبيق ستار موبايل. يرجى فتح التطبيق والتسجيل أولاً.`
    }, { status: 404, headers: CORS_HEADERS });
  }

  const { doc: userDoc, data: userData, cleanPhone } = userResult;
  const currentBalance = Number(userData.balance ?? 0);

  // ب. التحقق الصارم من رصيد العميل
  if (amount > 0 && currentBalance < amount) {
    return NextResponse.json({
      success: false,
      code: 'INSUFFICIENT_BALANCE',
      error: `رصيد العميل غير كافٍ. المطلوب: ${amount} ريال، الرصيد المتوفر: ${currentBalance} ريال.`,
      currentBalance,
      requiredAmount: amount,
      smsReply: `عزيزي العميل، رصيدك الحالي (${currentBalance} ريال) لا يكفي لشراء الكرت المطلوب بقيمة (${amount} ريال). يرجى تغذية حسابك وإعادة المحاولة.`
    }, { status: 400, headers: CORS_HEADERS });
  }

  const now = new Date().toISOString();
  let purchasedCardNumber = '';
  let purchasedCardPassword = '';
  let finalCategoryPrice = amount;

  try {
    // ج. فحص ما إذا كانت شبكة محلية (Local Network) أو شبكة خارجية (Baity API)
    let isLocalNetwork = false;
    let localNetworkDoc: any = null;

    if (networkId) {
      const netSnap = await getDocs(query(collection(firestore, 'networks'), where('__name__', '==', networkId), firestoreLimit(1)));
      if (!netSnap.empty) {
        isLocalNetwork = true;
        localNetworkDoc = netSnap.docs[0];
        if (!networkName) networkName = localNetworkDoc.data()?.name || 'شبكة محلية';

        // استخراج اسم الفئة تلقائياً من الشبكة المحلية إن لم يكن مرسلاً
        if (!categoryName && categoryId) {
          try {
            const catSnap = await getDocs(query(collection(firestore, `networks/${networkId}/cardCategories`), where('__name__', '==', categoryId), firestoreLimit(1)));
            if (!catSnap.empty) {
              categoryName = catSnap.docs[0].data()?.name || '';
            }
          } catch {}
        }
      }
    }

    if (!isLocalNetwork && networkName) {
      const netSnapByName = await getDocs(query(collection(firestore, 'networks'), where('name', '==', networkName), firestoreLimit(1)));
      if (!netSnapByName.empty) {
        isLocalNetwork = true;
        localNetworkDoc = netSnapByName.docs[0];
        networkId = localNetworkDoc.id;
      }
    }

    // إذا لم تكن شبكة محلية، جلب الأسماء الحقيقية من بيتي API تلقائياً
    if (!isLocalNetwork) {
      try {
        const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY;
        if (API_KEY && networkId) {
          if (!categoryName && categoryId) {
            const clsRes = await fetch(`https://apis.baitynet.net/api/partner/networks/${networkId}/classes`, {
              headers: { 'x-api-key': API_KEY.trim(), 'Accept': 'application/json' },
              cache: 'no-store'
            });
            if (clsRes.ok) {
              const clsJson = await clsRes.json();
              const matchCls = clsJson?.data?.find((c: any) => String(c.id) === String(categoryId));
              if (matchCls) categoryName = matchCls.name;
            }
          }
          if (!networkName) {
            const netRes = await fetch('https://apis.baitynet.net/api/partner/networks', {
              headers: { 'x-api-key': API_KEY.trim(), 'Accept': 'application/json' },
              cache: 'no-store'
            });
            if (netRes.ok) {
              const netJson = await netRes.json();
              const matchNet = netJson?.data?.find((n: any) => String(n.id) === String(networkId));
              if (matchNet) networkName = matchNet.name;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to resolve names from Baitynet API', e);
      }
    }

    if (!networkName) networkName = 'شبكة إنترنت';
    if (!categoryName) categoryName = amount > 0 ? `${amount} ريال` : 'كرت إنترنت';

    if (isLocalNetwork && localNetworkDoc) {
      // 1. الشبكة المحلية: سحب كرت متاح من مخزون كروت الشبكة
      const cardsColRef = collection(firestore, `networks/${networkId}/cards`);
      let cardsQuery;

      if (categoryId) {
        cardsQuery = query(cardsColRef, where('categoryId', '==', categoryId), where('status', '==', 'available'), firestoreLimit(1));
      } else {
        cardsQuery = query(cardsColRef, where('status', '==', 'available'), firestoreLimit(1));
      }

      const cardsSnap = await getDocs(cardsQuery);

      if (cardsSnap.empty) {
        return NextResponse.json({
          success: false,
          code: 'OUT_OF_STOCK',
          error: `عذراً، لا توجد كروت متاحة حالياً في مخزون شبكة (${networkName}) للفئة المطلوبة.`,
          smsReply: `عزيزي العميل، نعتذر لعدم توفر كروت حالياً في شبكة ${networkName} (${categoryName || ''}). لم يتم خصم أي مبلغ من رصيدك.`
        }, { status: 400, headers: CORS_HEADERS });
      }

      const cardDoc = cardsSnap.docs[0];
      const cardData = cardDoc.data();
      purchasedCardNumber = cardData.cardNumber;
      purchasedCardPassword = cardData.cardPassword || '';

      const netData = localNetworkDoc.data();
      const ownerId = netData.ownerId || 'admin';
      const commission = Math.ceil(finalCategoryPrice * 0.10);
      const payoutAmount = finalCategoryPrice - commission;

      // الخصم وتسجيل العملية المطابقة تماماً لعمليات الشراء بالإنترنت
      const batch = writeBatch(firestore);

      // خصم رصيد المشتري
      batch.update(userDoc.ref, { balance: increment(-finalCategoryPrice) });

      // تحديث حالة الكرت إلى مباع
      batch.update(cardDoc.ref, { status: 'sold', soldTo: userDoc.id, soldTimestamp: now });

      // تسجيل العملية في سجل العمليات الخاص بالعميل بنفس التنسيق المعتاد 100%
      const txRef = doc(collection(firestore, `users/${userDoc.id}/transactions`));
      batch.set(txRef, {
        userId: userDoc.id,
        transactionDate: now,
        amount: finalCategoryPrice,
        transactionType: `شراء كرت ${categoryName || 'إنترنت'}`,
        notes: `شبكة: ${networkName}`,
        cardNumber: purchasedCardNumber,
        ...(purchasedCardPassword ? { cardPassword: purchasedCardPassword } : {}),
        status: 'completed',
      });

      // تسجيل في soldCards
      const soldCardRef = doc(collection(firestore, 'soldCards'));
      batch.set(soldCardRef, {
        networkId: networkId,
        ownerId: ownerId,
        networkName: networkName,
        categoryId: categoryId || cardData.categoryId || '',
        categoryName: categoryName || 'كرت شبكة',
        cardId: cardDoc.id,
        cardNumber: purchasedCardNumber,
        price: finalCategoryPrice,
        commissionAmount: commission,
        payoutAmount: payoutAmount,
        buyerId: userDoc.id,
        buyerName: userData.displayName || cleanPhone,
        buyerPhoneNumber: cleanPhone,
        soldTimestamp: now,
        payoutStatus: 'completed'
      });

      // إضافة أرباح مالك الشبكة إن وجد
      if (ownerId && ownerId !== 'admin') {
        const ownerRef = doc(firestore, 'users', ownerId);
        batch.update(ownerRef, { balance: increment(payoutAmount) });

        const ownerTxRef = doc(collection(firestore, `users/${ownerId}/transactions`));
        batch.set(ownerTxRef, {
          userId: ownerId,
          transactionDate: now,
          amount: payoutAmount,
          transactionType: 'أرباح مبيعات الكروت',
          notes: `أرباح كرت ${categoryName || ''} - شبكة: ${networkName} (صافي بعد خصم 10% عمولة)`
        });
      }

      await batch.commit();

    } else {
      // 2. شبكة خارجية (بيتي API - Baitynet API)
      const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY;
      const USER_IDENTIFIER = process.env.BAITYNET_NETWORKS_USER_PHONE;
      const USER_PASSWORD = process.env.BAITYNET_NETWORKS_USER_PASS;

      if (!API_KEY || !USER_IDENTIFIER || !USER_PASSWORD) {
        throw new Error('إعدادات مزود شبكات API الخارجية غير مهيأة.');
      }

      if (!categoryId) {
        return NextResponse.json({
          success: false,
          code: 'MISSING_CLASS_ID',
          error: 'معرف الفئة (categoryId) مطلوب لشبكات API الخارجية.',
          smsReply: `عزيزي العميل، لم نتمكن من تحديد فئة الكرت بدقة. يرجى إعادة الطلب من داخل التطبيق.`
        }, { status: 400, headers: CORS_HEADERS });
      }

      const externalRef = `SM-SMS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const externalApiBody: any = {
        data: {
          class: categoryId,
          externalRef: externalRef,
          user: {
            identifier: USER_IDENTIFIER.trim(),
            password: USER_PASSWORD.trim()
          }
        }
      };

      const apiRes = await fetch(BAITY_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'StarMobileApp/1.0'
        },
        body: JSON.stringify(externalApiBody),
        cache: 'no-store'
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.error('[SMS Webhook] Baity API Error:', errText.substring(0, 300));
        return NextResponse.json({
          success: false,
          code: 'PROVIDER_ERROR',
          error: 'فشل تزويد الكرت من المصدر الخارجي. لم يتم خصم أي مبلغ من رصيدك.',
          smsReply: `عزيزي العميل، تعذر شراء كرت ${categoryName || ''} لشبكة ${networkName || ''} من المزود حالياً. لم يتم خصم أي مبلغ من رصيدك.`
        }, { status: 502, headers: CORS_HEADERS });
      }

      const apiJson = await apiRes.json();
      const cardResult = apiJson?.data?.order?.card;

      if (!cardResult || !cardResult.cardID) {
        return NextResponse.json({
          success: false,
          code: 'NO_CARD_RETURNED',
          error: 'لم يرجع المزود رقم الكرت.',
          smsReply: `عزيزي العميل، لم يتوفر الكرت المطلوب حالياً لدى المزود. لم يتم خصم رصيدك.`
        }, { status: 502, headers: CORS_HEADERS });
      }

      purchasedCardNumber = cardResult.cardID;
      purchasedCardPassword = cardResult.cardPass || '';

      // خصم رصيد العميل وتسجيل العملية
      const batch = writeBatch(firestore);
      batch.update(userDoc.ref, { balance: increment(-finalCategoryPrice) });

      const txRef = doc(collection(firestore, `users/${userDoc.id}/transactions`));
      batch.set(txRef, {
        id: txRef.id,
        userId: userDoc.id,
        transactionDate: now,
        amount: finalCategoryPrice,
        transactionType: `شراء كرت ${categoryName || 'إنترنت'}`,
        notes: `شبكة: ${networkName}`,
        cardNumber: purchasedCardNumber,
        ...(purchasedCardPassword ? { cardPassword: purchasedCardPassword } : {}),
        status: 'completed',
        externalRef: externalRef
      });

      const baityOrderRef = doc(firestore, 'baityOrders', externalRef);
      batch.set(baityOrderRef, {
        externalRef: externalRef,
        userId: userDoc.id,
        transactionId: txRef.id,
        classId: categoryId,
        className: categoryName,
        networkName: networkName,
        price: finalCategoryPrice,
        status: 'completed',
        cardNumber: purchasedCardNumber,
        cardPass: purchasedCardPassword,
        phoneNumber: cleanPhone,
        createdAt: now,
        completedAt: now
      });

      await batch.commit();
    }

    // د. إضافة إشعار في حساب العميل
    try {
      const notifsCol = collection(firestore, `users/${userDoc.id}/notifications`);
      await addDoc(notifsCol, {
        title: 'تم شراء كرت شبكة بنجاح 💙',
        message: `تم شراء كرت ${categoryName || ''} لشبكة ${networkName}. رقم الكرت: ${purchasedCardNumber}`,
        timestamp: now,
        type: 'network_card',
        cardNumber: purchasedCardNumber
      });
    } catch (e) {
      console.warn('Failed to add client notification', e);
    }

    const newBalance = currentBalance - finalCategoryPrice;

    // نص الرسالة النصية للرد الجاهز لإرساله من تطبيق فلاتر للعميل
    const smsReplyText = 
`ستار موبايل 💙
تم شراء كرتك بنجاح:
الشبكة: ${networkName}
الفئة: ${categoryName || 'كرت إنترنت'}
رقم الكرت: ${purchasedCardNumber}${purchasedCardPassword && purchasedCardPassword !== purchasedCardNumber ? `\nالرمز: ${purchasedCardPassword}` : ''}
المبلغ: ${finalCategoryPrice} ريال
رصيدك المتبقي: ${newBalance} ريال`;

    return NextResponse.json({
      success: true,
      code: 'PURCHASE_SUCCESS',
      message: 'تم تنفيذ العملية وخصم الرصيد وشراء الكرت بنجاح.',
      client: {
        uid: userDoc.id,
        displayName: userData.displayName || cleanPhone,
        phoneNumber: cleanPhone,
        previousBalance: currentBalance,
        remainingBalance: newBalance
      },
      card: {
        networkName: networkName,
        categoryName: categoryName || 'كرت إنترنت',
        cardNumber: purchasedCardNumber,
        cardPassword: purchasedCardPassword || null,
        price: finalCategoryPrice
      },
      smsReply: smsReplyText
    }, { headers: CORS_HEADERS });

  } catch (err: any) {
    console.error('[SMS Webhook] Execution Error:', err);
    return NextResponse.json({
      success: false,
      code: 'EXECUTION_FAILED',
      error: err.message || 'حدث خطأ أثناء معالجة شراء الكرت.',
      smsReply: `عزيزي العميل، تعذر إتمام عملية الشراء لخلل تقني مؤقت. يرجى التواصل مع الإدارة 770326828.`
    }, { status: 500, headers: CORS_HEADERS });
  }
}
