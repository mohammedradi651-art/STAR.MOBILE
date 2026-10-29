import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { collection, query, where, getDocs, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import { DEFAULT_SERVICES_CONFIG, SystemServicesConfig, calculateGamePrice, GamePackage } from '@/lib/services-config';
import { generateTransId, generateBackpass } from '@/lib/telecom-order';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
 * جلب إعدادات الألعاب والنسب المحدثة من Firestore
 */
async function getGamesConfig(firestore: any) {
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

  return {
    enabled: remoteGames?.enabled ?? defaultGames.enabled,
    pubg: {
      enabled: remoteGames?.pubg?.enabled ?? defaultGames.pubg.enabled,
      rate: Number(remoteGames?.pubg?.rate ?? defaultGames.pubg.rate),
      packages: remoteGames?.pubg?.packages ?? defaultGames.pubg.packages,
    },
    freefire: {
      enabled: remoteGames?.freefire?.enabled ?? defaultGames.freefire.enabled,
      rate: Number(remoteGames?.freefire?.rate ?? defaultGames.freefire.rate),
      packages: remoteGames?.freefire?.packages ?? defaultGames.freefire.packages,
    }
  };
}

/**
 * GET: استعراض الباقات والأسعار الحالية للألعاب
 */
export async function GET(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const apiKey = extractApiKey(req);
    const { firestore } = initializeServerFirebase();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        code: 'SM_UNAUTHORIZED',
        message: 'مفتاح الـ API مطلوب للاطلاع على أسعار الألعاب',
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

    const gamesConfig = await getGamesConfig(firestore);
    if (!gamesConfig.enabled) {
      return NextResponse.json({
        success: false,
        code: 'SM_SERVICE_DISABLED',
        message: 'خدمة الألعاب معطلة حالياً في النظام',
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    // تجهيز قائمة ببجي
    const pubgPackages = gamesConfig.pubg.packages.map((pkg: GamePackage) => ({
      id: pkg.id,
      code: pkg.code,
      name: pkg.name,
      basePrice: pkg.basePrice,
      rate: gamesConfig.pubg.rate,
      price: calculateGamePrice(pkg.basePrice, gamesConfig.pubg.rate)
    }));

    // تجهيز قائمة فري فاير
    const freefirePackages = gamesConfig.freefire.packages.map((pkg: GamePackage) => ({
      id: pkg.id,
      code: pkg.code,
      name: pkg.name,
      basePrice: pkg.basePrice,
      rate: gamesConfig.freefire.rate,
      price: calculateGamePrice(pkg.basePrice, gamesConfig.freefire.rate)
    }));

    return NextResponse.json({
      success: true,
      code: 'SM_SUCCESS',
      message: 'تم جلب باقات وأسعار الألعاب بنجاح',
      data: {
        pubg: {
          name: 'ببجي موبايل',
          enabled: gamesConfig.pubg.enabled,
          rate: gamesConfig.pubg.rate,
          packages: pubgPackages
        },
        freefire: {
          name: 'فري فاير',
          enabled: gamesConfig.freefire.enabled,
          rate: gamesConfig.freefire.rate,
          packages: freefirePackages
        }
      },
      userBalance: Number(authResult.userData.balance || 0),
      timestamp
    }, { headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      code: 'SM_SERVER_ERROR',
      message: error?.message || 'خطأ داخلي في السيرفر',
      timestamp
    }, { status: 500, headers: corsHeaders });
  }
}

/**
 * POST: تنفيذ الشحن الفوري أو جلب الباقات
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

    const gamesConfig = await getGamesConfig(firestore);
    if (!gamesConfig.enabled) {
      return NextResponse.json({
        success: false,
        code: 'SM_SERVICE_DISABLED',
        message: 'خدمة الألعاب معطلة حالياً في النظام',
        timestamp
      }, { status: 403, headers: corsHeaders });
    }

    const action = String(body.action || 'pay').toLowerCase().trim();

    // 1. إذا كان الطلب استعراض الباقات والأسعار عبر POST
    if (action === 'packages' || action === 'list' || action === 'pricing') {
      const pubgPackages = gamesConfig.pubg.packages.map((pkg: GamePackage) => ({
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        basePrice: pkg.basePrice,
        rate: gamesConfig.pubg.rate,
        price: calculateGamePrice(pkg.basePrice, gamesConfig.pubg.rate)
      }));

      const freefirePackages = gamesConfig.freefire.packages.map((pkg: GamePackage) => ({
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        basePrice: pkg.basePrice,
        rate: gamesConfig.freefire.rate,
        price: calculateGamePrice(pkg.basePrice, gamesConfig.freefire.rate)
      }));

      return NextResponse.json({
        success: true,
        code: 'SM_SUCCESS',
        message: 'تم جلب باقات وأسعار الألعاب بنجاح',
        data: {
          pubg: {
            name: 'ببجي موبايل',
            enabled: gamesConfig.pubg.enabled,
            rate: gamesConfig.pubg.rate,
            packages: pubgPackages
          },
          freefire: {
            name: 'فري فاير',
            enabled: gamesConfig.freefire.enabled,
            rate: gamesConfig.freefire.rate,
            packages: freefirePackages
          }
        },
        userBalance: Number(authResult.userData.balance || 0),
        timestamp
      }, { headers: corsHeaders });
    }

    // 2. إذا كان الطلب عملية شحن (Payment / Charge)
    const rawGame = String(body.game || body.type || body.service || '').toLowerCase().trim();
    const isPubg = rawGame === 'pubg' || rawGame.includes('ببجي');
    const isFreeFire = rawGame === 'freefire' || rawGame === 'free_fire' || rawGame.includes('فاير');

    if (!isPubg && !isFreeFire) {
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: 'نوع اللعبة غير مدعوم. الألعاب المتاحة حالياً: pubg (ببجي موبايل) أو freefire (فري فاير).',
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

    // البحث عن الباقة المطلوبة
    const targetPackage = gameSetting.packages.find((p: GamePackage) => 
      p.code === packageCode || p.id === packageCode || p.name.includes(packageCode)
    );

    if (!targetPackage) {
      const availableCodes = gameSetting.packages.map((p: GamePackage) => `${p.code} (${p.name})`).join(', ');
      return NextResponse.json({
        success: false,
        code: 'SM_VALIDATION_ERROR',
        message: `كود الباقة غير موجود. الأكواد المتاحة: ${availableCodes}`,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // احتساب السعر المخصوم وفق النسبة المحددة
    const finalPrice = calculateGamePrice(targetPackage.basePrice, gameSetting.rate);
    const userBalance = Number(authResult.userData.balance || 0);

    // فحص الرصيد الكافي
    if (userBalance < finalPrice) {
      return NextResponse.json({
        success: false,
        code: 'SM_INSUFFICIENT_BALANCE',
        message: `رصيدك الحالي لا يكفي لإتمام عملية الشحن. المطلوب: ${finalPrice} ر.ي، المتاح: ${userBalance} ر.ي`,
        timestamp
      }, { status: 400, headers: corsHeaders });
    }

    // تجهيز المعاملة المالية
    const transid = generateTransId();
    const backpass = generateBackpass();
    const now = new Date().toISOString();
    const gameTitle = isPubg ? 'ببجي موبايل' : 'فري فاير';
    const txType = `شحن ${isPubg ? 'شدات' : 'جواهر'}: ${targetPackage.name}`;
    const txNotes = `رقم اللاعب: ${playerId} - اللعبة: ${gameTitle} - الفئة: ${targetPackage.name}`;

    const batch = writeBatch(firestore);

    // أ. خصم المبلغ من رصيد العميل
    const userRef = doc(firestore, 'users', authResult.userId);
    batch.update(userRef, { balance: increment(-finalPrice) });

    // ب. تسجيل المعاملة في كشف حساب العميل لتظهر في سجل عملياته كعملية ناجحة
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
      status: 'success', // ناجحة نفس العميل العادي
      readiness: 'جاهزة',
      transid: transid,
      serviceCategory: 'الالعاب'
    });

    // ج. تسجيل المعاملة في paymentTransactions لتأمين التحقق والـ Webhook
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

    // د. إرسال الطلب للمزود (اشحن لي) عبر سيرفر الاتصالات
    const origin = new URL(req.url).origin;
    try {
      fetch(`${origin}/api/telecom`, {
        method: 'POST',
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
      }).catch(err => console.error("Async telecom call error:", err));
    } catch (e) {
      console.warn("Could not initiate background telecom request:", e);
    }

    const remainingBalance = Number((userBalance - finalPrice).toFixed(2));

    return NextResponse.json({
      success: true,
      code: 'SM_SUCCESS',
      message: 'تم شحن الطلب بنجاح وخصم المبلغ من رصيدك',
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

  } catch (error: any) {
    console.error('Games API Error:', error);
    return NextResponse.json({
      success: false,
      code: 'SM_SERVER_ERROR',
      message: error?.message || 'فشل الاتصال بسيرفر الألعاب',
      timestamp
    }, { status: 500, headers: corsHeaders });
  }
}

