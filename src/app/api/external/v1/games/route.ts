import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import { 
  DEFAULT_SERVICES_CONFIG, 
  SystemServicesConfig, 
  calculateGamePrice, 
  GamePackage,
  PUBG_BASE_PACKAGES,
  FREEFIRE_BASE_PACKAGES
} from '@/lib/services-config';
import { generateTransId, generateBackpass, formatProviderErrorMessage } from '@/lib/telecom-order';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * استخراج مفتاح الـ API
 */
function extractApiKey(req: Request, body?: any): string | null {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim();
  }
  const xApiKey = req.headers.get('x-api-key');
  if (xApiKey) return xApiKey.trim();

  if (body?.apiKey && typeof body.apiKey === 'string') return body.apiKey.trim();
  if (body?.key && typeof body.key === 'string') return body.key.trim();
  if (body?.token && typeof body.token === 'string') return body.token.trim();

  try {
    const url = new URL(req.url);
    const paramKey = url.searchParams.get('apiKey') || url.searchParams.get('key');
    if (paramKey) return paramKey.trim();
  } catch (e) {}

  return null;
}

// كاش في الذاكرة لتوفير القراءات
let cachedGamesConfig: {
  enabled: boolean;
  pubg: { enabled: boolean; rate: number };
  freefire: { enabled: boolean; rate: number };
} | null = null;
let gamesConfigCacheExpiry = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // دقيقتين

/**
 * جلب معاملات النسب فقط من قاعدة البيانات مع كاش لتوفير القراءات
 */
async function getGamesRatesConfig(firestore: any) {
  const now = Date.now();
  if (cachedGamesConfig && now < gamesConfigCacheExpiry) {
    return cachedGamesConfig;
  }

  let config: SystemServicesConfig = DEFAULT_SERVICES_CONFIG;
  try {
    const configSnap = await getDoc(doc(firestore, 'system_settings', 'telecom_config'));
    if (configSnap.exists()) {
      config = { ...DEFAULT_SERVICES_CONFIG, ...(configSnap.data() as any) };
    }
  } catch (e) {
    console.warn("Could not read telecom_config in games API:", e);
  }

  const defaultGames = DEFAULT_SERVICES_CONFIG.games!;
  const remoteGames = config.games;

  cachedGamesConfig = {
    enabled: remoteGames?.enabled ?? defaultGames.enabled,
    pubg: {
      enabled: remoteGames?.pubg?.enabled ?? defaultGames.pubg.enabled,
      rate: Number(remoteGames?.pubg?.rate ?? defaultGames.pubg.rate),
    },
    freefire: {
      enabled: remoteGames?.freefire?.enabled ?? defaultGames.freefire.enabled,
      rate: Number(remoteGames?.freefire?.rate ?? defaultGames.freefire.rate),
    }
  };

  gamesConfigCacheExpiry = now + CACHE_TTL_MS;
  return cachedGamesConfig;
}

/**
 * التحقق من صاحب المفتاح
 */
async function verifyUserByApiKey(apiKey: string, firestore: any): Promise<{ userId: string; userData: any } | null> {
  if (!apiKey) return null;

  try {
    const q = query(collection(firestore, 'users'), where('apiKey', '==', apiKey));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { userId: snap.docs[0].id, userData: snap.docs[0].data() };
    }
  } catch (e) {
    console.error('Error verifying apiKey in games:', e);
  }

  // دعم المفاتيح الرئيسية في النظام (Master Keys)
  const masterKeys = [
    'star_live_key_9f8e7d6c5b4a3210',
    'star_27cwiz9sw1ehc7t38svv9am'
  ];
  if (masterKeys.includes(apiKey)) {
    try {
      const adminDoc = await getDoc(doc(firestore, 'users', 'wsy8bUcULSYX2J9Q9WyisiFX5ki2'));
      return {
        userId: 'wsy8bUcULSYX2J9Q9WyisiFX5ki2',
        userData: adminDoc.exists() ? adminDoc.data() : { balance: 999999, displayName: 'Master Admin' }
      };
    } catch (e) {}
  }

  return null;
}

/**
 * POST: تنفيذ شحن فئات الألعاب فقط
 * POST /api/external/v1/games
 */
export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = extractApiKey(req, body);
    const { firestore } = initializeServerFirebase();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        code: 'SM_UNAUTHORIZED',
        message: 'مفتاح الـ API مطلوب لتنفيذ عمليات الألعاب',
        timestamp
      }, { status: 401, headers: corsHeaders });
    }

    const authResult = await verifyUserByApiKey(apiKey, firestore);
    if (!authResult) {
      return NextResponse.json({
        success: false,
        code: 'SM_FORBIDDEN',
        message: 'مفتاح الربط API غير صحيح أو غير مفعل',
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    const gamesConfig = await getGamesRatesConfig(firestore);
    if (!gamesConfig.enabled) {
      return NextResponse.json({
        success: false,
        code: 'SM_SERVICE_DISABLED',
        message: 'خدمة الألعاب معطلة حالياً في النظام',
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    // تحديد اللعبة
    const rawGame = String(body.game || body.type || body.service || '').toLowerCase().trim();
    const isPubg = rawGame === 'pubg' || rawGame.includes('ببجي');
    const isFreeFire = rawGame === 'freefire' || rawGame === 'free_fire' || rawGame.includes('فاير');

    if (!isPubg && !isFreeFire) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'نوع اللعبة غير مدعوم. الألعاب المتاحة: pubg (ببجي موبايل) أو freefire (فري فاير).',
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    const gameKey = isPubg ? 'pubg' : 'freefire';
    const gameSetting = gamesConfig[gameKey];

    if (!gameSetting.enabled) {
      return NextResponse.json({
        success: false,
        code: 'SM_SERVICE_DISABLED',
        message: `لعبة ${isPubg ? 'ببجي موبايل' : 'فري فاير'} معطلة حالياً في النظام`,
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    const playerId = String(body.playerId || body.playerid || body.player_id || body.id || '').trim();
    if (!playerId) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'رقم أو آيدي اللاعب (playerId) مطلوب لتنفيذ الشحن',
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    const packageCode = String(body.packageCode || body.packagecode || body.code || body.uniqcode || body.packageId || body.package || '').trim();
    if (!packageCode) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'كود فئة الشحن (packageCode) مطلوب',
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // جلب الباقات والأسعار الأساسية من الكود البرمجي حصراً بدون أي قراءة من قاعدة البيانات
    const packagesList = isPubg ? PUBG_BASE_PACKAGES : FREEFIRE_BASE_PACKAGES;

    const targetPackage = packagesList.find((p: GamePackage) => 
      p.code === packageCode || p.id === packageCode || p.name.includes(packageCode)
    );

    if (!targetPackage) {
      const availableCodes = packagesList.map((p: GamePackage) => `${p.code} (${p.name})`).join(', ');
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: `كود الباقة غير موجود. الأكواد المتاحة: ${availableCodes}`,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // احتساب السعر المخصوم وفق معامل النسبة المحدد في لوحة الإدارة
    const finalPrice = calculateGamePrice(targetPackage.basePrice, gameSetting.rate);
    const userBalance = Number(authResult.userData.balance || 0);

    // فحص كفاية الرصيد
    if (userBalance < finalPrice) {
      return NextResponse.json({
        success: false,
        code: 'SM_INSUFFICIENT_BALANCE',
        message: `رصيدك الحالي لا يكفي لإتمام عملية الشحن. المطلوب: ${finalPrice} ر.ي، المتاح: ${userBalance} ر.ي`,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // توليد أرقام المعاملة
    const transid = generateTransId();
    const backpass = generateBackpass();
    const now = new Date().toISOString();
    const gameTitle = isPubg ? 'ببجي موبايل' : 'فري فاير';
    const txType = `شحن ${isPubg ? 'شدات' : 'جواهر'}: ${targetPackage.name}`;
    const txNotes = `رقم اللاعب: ${playerId} - اللعبة: ${gameTitle} - الفئة: ${targetPackage.name}`;

    const batch = writeBatch(firestore);

    // أ. خصم المبلغ من رصيد العميل مبدئياً
    const userRef = doc(firestore, 'users', authResult.userId);
    batch.update(userRef, { balance: increment(-finalPrice) });

    // ب. تسجيل المعاملة في كشف حساب العميل بحالة معلقة (قيد الانتظار) كالمستخدم العادي
    const userTxRef = doc(firestore, `users/${authResult.userId}/transactions`, transid);
    batch.set(userTxRef, {
      id: transid,
      userId: authResult.userId,
      transactionDate: now,
      createdAt: now,
      amount: finalPrice,
      transactionType: txType,
      notes: txNotes,
      recipientPhoneNumber: playerId,
      accountNumber: playerId,
      status: 'pending',
      readiness: 'قيد الانتظار',
      transid: transid,
      serviceCategory: 'الالعاب'
    });

    // ج. تسجيل المعاملة في paymentTransactions بحالة معلقة
    const globalTxRef = doc(firestore, 'paymentTransactions', transid);
    batch.set(globalTxRef, {
      id: transid,
      transid: transid,
      userId: authResult.userId,
      amount: finalPrice,
      basePrice: targetPackage.basePrice,
      rate: gameSetting.rate,
      transactionType: txType,
      recipientPhoneNumber: playerId,
      playerid: playerId,
      uniqcode: targetPackage.code,
      game: gameKey,
      status: 'pending',
      readiness: 'قيد الانتظار',
      source: 'api',
      backpass: backpass,
      balanceProcessed: true,
      createdAt: now
    });

    await batch.commit();

    // د. إرسال الطلب للمزود (اشحن لي) عبر السيرفر الداخلي وانتظار النتيجة
    const origin = new URL(req.url).origin;
    let telecomResult: any = null;
    let isTimeout = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // مهلة 20 ثانية

      const telecomRes = await fetch(`${origin}/api/telecom`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-app-source': 'internal'
        },
        body: JSON.stringify({
          service: 'games',
          type: gameKey,
          uniqcode: targetPackage.code,
          playerid: playerId,
          mobile: body.mobile || authResult.userData.phoneNumber || '000',
          transid: transid,
          backpass: backpass
        })
      });
      clearTimeout(timeoutId);
      telecomResult = await telecomRes.json().catch(() => ({}));
    } catch (fetchErr: any) {
      isTimeout = true;
      console.warn("Games Charge API: telecom request timed out or error:", fetchErr);
    }

    // إذا تأخر الاتصال عن المهلة -> تظل العملية معلقة قيد الانتظار
    if (isTimeout) {
      return NextResponse.json({
        success: true,
        code: 'SM_PENDING',
        message: 'تم إرسال الطلب وهو قيد المعالجة لدى المزود (قيد الانتظار)',
        transactionId: transid,
        data: {
          transid: transid,
          game: gameKey,
          gameName: gameTitle,
          packageName: targetPackage.name,
          packageCode: targetPackage.code,
          playerId: playerId,
          amount: finalPrice,
          status: 'pending',
          readiness: 'قيد الانتظار',
          previousBalance: userBalance,
          remainingBalance: Number((userBalance - finalPrice).toFixed(2))
        },
        timestamp: now
      }, { headers: corsHeaders });
    }

    const rawResultMsg = String(telecomResult?.resultDesc || telecomResult?.message || telecomResult?.reason || '').trim();
    const normResultMsg = rawResultMsg.toLowerCase();

    const isExplicitDone =
      telecomResult?.status === 'success' ||
      telecomResult?.status === 'done' ||
      telecomResult?.action === 'done' ||
      telecomResult?.isDone === 1 ||
      telecomResult?.isDone === '1' ||
      telecomResult?.readiness === 'جاهزة' ||
      rawResultMsg.includes('تم تنفيذ') ||
      rawResultMsg.includes('تم التنفيذ') ||
      rawResultMsg.includes('تم الشحن') ||
      rawResultMsg.includes('بنجاح');

    const isPending =
      !isExplicitDone &&
      (telecomResult?.status === 'pending' ||
       telecomResult?.status === 'wait' ||
       telecomResult?.status === 'waiting' ||
       telecomResult?.status === 'process' ||
       telecomResult?.status === 'proccess' ||
       telecomResult?.status === 'processing' ||
       telecomResult?.status === 'proccessing' ||
       telecomResult?.readiness === 'قيد الانتظار' ||
       telecomResult?.resultCode === "-2" ||
       telecomResult?.resultCode === -2 ||
       rawResultMsg.includes('انتظار') ||
       rawResultMsg.includes('قيد التنفيذ') ||
       rawResultMsg.includes('جاري التنفيذ') ||
       rawResultMsg.includes('قيد المعالجة') ||
       rawResultMsg.includes('جاري المعالجة') ||
       rawResultMsg.includes('معلق') ||
       normResultMsg.includes('proc') ||
       normResultMsg.includes('pend') ||
       normResultMsg.includes('wait') ||
       normResultMsg.includes('queu') ||
       normResultMsg.includes('prog'));

    const isSuccess =
      !isPending &&
      (isExplicitDone ||
       telecomResult?.resultCode === "0" ||
       telecomResult?.resultCode === 0);

    if (isSuccess) {
      // 1. نجاح مؤكد من المزود -> تحديث المعاملة إلى جاهزة
      const successPayload = {
        status: 'success',
        readiness: 'جاهزة',
        providerMessage: telecomResult?.resultDesc || telecomResult?.message || 'تم شحن الحساب بنجاح',
        completedAt: new Date().toISOString()
      };
      const successBatch = writeBatch(firestore);
      successBatch.update(userTxRef, successPayload);
      successBatch.set(globalTxRef, successPayload, { merge: true });
      await successBatch.commit();

      const remainingBalance = Number((userBalance - finalPrice).toFixed(2));

      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        message: 'تم شحن الطلب بنجاح',
        transactionId: transid,
        data: {
          transid: transid,
          game: gameKey,
          gameName: gameTitle,
          packageName: targetPackage.name,
          packageCode: targetPackage.code,
          playerId: playerId,
          basePrice: targetPackage.basePrice,
          rate: gameSetting.rate,
          amount: finalPrice,
          status: 'ready',
          readiness: 'جاهزة',
          previousBalance: userBalance,
          remainingBalance: remainingBalance
        },
        timestamp: now
      }, { headers: corsHeaders });

    } else if (isPending) {
      // 2. قيد الانتظار لدى المزود -> المعاملة تبقى معلقة
      return NextResponse.json({
        success: true,
        code: 'SM_PENDING',
        message: telecomResult?.resultDesc || telecomResult?.message || 'تم إرسال الطلب وهو قيد المعالجة لدى المزود (قيد الانتظار)',
        transactionId: transid,
        data: {
          transid: transid,
          game: gameKey,
          gameName: gameTitle,
          packageName: targetPackage.name,
          packageCode: targetPackage.code,
          playerId: playerId,
          amount: finalPrice,
          status: 'pending',
          readiness: 'قيد الانتظار',
          previousBalance: userBalance,
          remainingBalance: Number((userBalance - finalPrice).toFixed(2))
        },
        timestamp: now
      }, { headers: corsHeaders });

    } else {
      // 3. فشل أو رفض من المزود -> إرجاع المبلغ لحساب العميل فوراً وتحديث المعاملة إلى فاشلة
      const cleanFailReason = formatProviderErrorMessage(
        telecomResult?.resultDesc || telecomResult?.message || telecomResult?.reason || 'تم رفض العملية من قبل المزود.'
      );

      const failBatch = writeBatch(firestore);
      failBatch.update(userRef, { balance: increment(finalPrice) });
      const failPayload = {
        status: 'failed',
        readiness: 'فاشلة',
        refunded: true,
        providerMessage: cleanFailReason,
        notes: `${txNotes}\nالسبب من المزود: ${cleanFailReason}`,
        failedAt: new Date().toISOString()
      };
      failBatch.update(userTxRef, failPayload);
      failBatch.set(globalTxRef, failPayload, { merge: true });
      await failBatch.commit();

      return NextResponse.json({
        success: false,
        code: 'SM_PROVIDER_REJECTED',
        message: cleanFailReason,
        transactionId: transid,
        data: {
          transid: transid,
          game: gameKey,
          gameName: gameTitle,
          packageName: targetPackage.name,
          packageCode: targetPackage.code,
          playerId: playerId,
          amount: finalPrice,
          status: 'failed',
          readiness: 'فاشلة',
          refunded: true,
          previousBalance: userBalance,
          remainingBalance: userBalance
        },
        timestamp: now
      }, { status: 400, headers: corsHeaders });
    }

  } catch (error: any) {
    console.error('Games Charge API Error:', error);
    return NextResponse.json({
      success: false,
      code: 'SM_SERVER_ERROR',
      message: error?.message || 'فشل الاتصال بسيرفر الألعاب',
      timestamp
    }, { status: 500, headers: corsHeaders });
  }
}
