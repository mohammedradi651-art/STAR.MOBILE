export interface ServicePricingSetting {
  enabled: boolean;
  rate?: number; // النسبة أو معامل الباقات (افتراضي 1 = الألف بألف أو حسب السعر الموحد)
  balanceRate?: number; // معامل الرصيد والشحن الفوري للعملة المرتفعة (مثلاً 3.0 ليصبح الـ 1,000 = 3,000 ر.ي)
  percentage?: number; // نسبة الزيادة المئوية % (اختياري)
  fixedFee?: number; // رسوم أو مبلغ إضافي ثابت بالريال
  notice?: string;
  customRate?: number;
}

export interface TelecomApiCredentials {
  apiBaseUrl: string;
  userId: string;
  username: string;
  password: string;
  backUrl?: string;
  clientApiKey?: string; // مفتاح الـ API للربط البرمجي للمطورين
  alwadiHost?: string;
  alwadiDb?: string;
  alwadiUsername?: string;
  alwadiPassword?: string;
}

export interface SabafonPricingSetting extends ServicePricingSetting {
  packagesRate?: number; // نسبة / معامل باقات سبأفون (افتراضي 1 = السعر الأساسي)
  unitsRate?: number; // نسبة أو سعر الوحدة بالريال (افتراضي 45 ر.ي أو 1 حسب التحديد)
  instantNorthRate?: number; // نسبة الشحن الفوري شمال (صنعاء - عملة قديمة)
  instantSouthRate?: number; // نسبة الشحن الفوري جنوب (عدن - عملة مرتفعة)
}

export interface GamePackage {
  id: string;
  name: string;
  basePrice: number;
  code: string;
}

export interface GameServiceSetting {
  enabled: boolean;
  rate: number;
}

export interface GamesConfig {
  enabled: boolean;
  pubg: GameServiceSetting;
  freefire: GameServiceSetting;
}

// قائمة باقات ببجي وأسعارها الأساسية الثابتة في الكود البرمجي حصراً
export const PUBG_BASE_PACKAGES: GamePackage[] = [
  { id: '10', name: '10 شدة', basePrice: 138, code: '10' },
  { id: '60', name: '60 شدة', basePrice: 495, code: '60' },
  { id: '325', name: '325 شدة', basePrice: 2454, code: '325' },
  { id: '385', name: '385 شدة', basePrice: 2944, code: '385' },
  { id: '660', name: '660 شدة', basePrice: 4909, code: '660' },
  { id: '720', name: '720 شدة', basePrice: 5404, code: '720' },
  { id: '1800', name: '1800 شدة', basePrice: 12283, code: '1800' },
  { id: '3850', name: '3850 شدة', basePrice: 24413, code: '3850' },
  { id: '8100', name: '8100 شدة', basePrice: 48832, code: '8100' },
];

// قائمة باقات فري فاير وأسعارها الأساسية الثابتة في الكود البرمجي حصراً
export const FREEFIRE_BASE_PACKAGES: GamePackage[] = [
  { id: '100', name: '100 جوهرة', basePrice: 534, code: '100' },
  { id: '210', name: '210 جوهرة', basePrice: 1068, code: '210' },
  { id: '530', name: '530 جوهرة', basePrice: 2669, code: '530' },
  { id: '1080', name: '1080 جوهرة', basePrice: 5339, code: '1080' },
  { id: '2200', name: '2200 جوهرة', basePrice: 10677, code: '2200' },
  { id: 'weekly', name: 'عضوية اسبوعية', basePrice: 1200, code: 'weekly' },
  { id: 'monthly', name: 'عضوية شهرية', basePrice: 5875, code: 'monthly' },
  { id: 'booyah', name: 'بويا باس', basePrice: 1797, code: 'booyah' },
];

export interface SystemServicesConfig {
  telecomApi: TelecomApiCredentials;
  yemen_mobile: ServicePricingSetting;
  you: ServicePricingSetting;
  sabafon: SabafonPricingSetting;
  why: ServicePricingSetting & { multiplier?: number };
  yemen_4g: ServicePricingSetting;
  aden_net: ServicePricingSetting;
  landline_adsl: ServicePricingSetting;
  alwadi: ServicePricingSetting & {
    packages?: {
      twoMonths: number;
      fourMonths: number;
      sixMonths: number;
      oneYear: number;
    };
  };
  networks: ServicePricingSetting;
  games?: GamesConfig;
  updatedAt?: string;
}

export const DEFAULT_SERVICES_CONFIG: SystemServicesConfig = {
  telecomApi: {
    apiBaseUrl: 'http://echehanly.yrbso.net/api/yr/',
    userId: '',
    username: '',
    password: '',
    backUrl: 'https://star26.vercel.app/api/payment/webhook',
    clientApiKey: 'star_live_key_9f8e7d6c5b4a3210',
    alwadiHost: 'api.alwaadi.net',
    alwadiDb: 'alwaadi_DB',
    alwadiUsername: '770326M',
    alwadiPassword: ''
  },
  yemen_mobile: {
    enabled: true,
    rate: 1,
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  you: {
    enabled: true,
    rate: 1,
    balanceRate: 3.0, // الرصيد والفوري للعملة المرتفعة (الـ 1000 = 3000)
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  sabafon: {
    enabled: true,
    rate: 0.98, // الباقات
    packagesRate: 0.98,
    unitsRate: 45, // قيمة الوحدة بالريال (افتراضي 45)
    instantNorthRate: 1, // فوري شمال (افتراضي 1)
    instantSouthRate: 0.98, // فوري جنوب بنسبة 0.98 (فئة 960 = 940 ريال)
    balanceRate: 0.98,
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  why: {
    enabled: true,
    rate: 3.8, // عملة مرتفعة شاملة للباقات والرصيد (الـ 1000 = 3800)
    balanceRate: 3.8,
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  yemen_4g: {
    enabled: true,
    rate: 1,
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  aden_net: {
    enabled: true,
    rate: 1,
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  landline_adsl: {
    enabled: true,
    rate: 1,
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  alwadi: {
    enabled: true,
    rate: 1,
    percentage: 0,
    fixedFee: 0,
    notice: '',
    packages: {
      twoMonths: 3000,
      fourMonths: 6000,
      sixMonths: 9000,
      oneYear: 15000
    }
  },
  networks: {
    enabled: true,
    rate: 0.95, // عمولة صاحب الـ API 5% له (الـ 1000 تكون له 950 ر.ي)
    percentage: 0,
    fixedFee: 0,
    notice: ''
  },
  games: {
    enabled: true,
    pubg: {
      enabled: true,
      rate: 3.02
    },
    freefire: {
      enabled: true,
      rate: 2.98
    }
  }
};

/**
 * دالة احتساب سعر باقة اللعبة للـ API بناءً على السعر الأساسي والنسبة
 */
export function calculateGamePrice(basePrice: number, rate: number): number {
  return Math.round((basePrice * rate) * 100) / 100;
}

/**
 * تقريب العملة إلى منزلتين عشريتين بدقة
 */
export function roundCurrency(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * التحقق مما إذا كان العميل يمتلك مفتاح API مفعل
 */
export function isUserApiCustomer(userProfile?: { apiKey?: string | null } | null): boolean {
  return Boolean(userProfile?.apiKey && userProfile.apiKey.trim().length > 0);
}

/**
 * أسعار باقات منظومة الوادي الرسمية بدون أي خصم
 */
export const ALWADI_OFFICIAL_PRICES: Record<string, number> = {
  '1': 3000,
  '3': 6000,
  '7': 9000,
  '9': 15000,
  'twoMonths': 3000,
  'fourMonths': 6000,
  'sixMonths': 9000,
  'oneYear': 15000,
};

/**
 * حساب السعر النهائي للباقات والخدمات مع تطبيق نسب ومعاملات الـ API بدقة
 */
export function calculateFinalServicePrice(
  basePrice: number, 
  setting?: ServicePricingSetting
): number {
  if (!basePrice || isNaN(basePrice) || basePrice <= 0) return 0;

  const effectiveRate = setting?.rate;

  // إذا كانت النسبة/المعامل مخصصة وتختلف عن 1
  if (effectiveRate !== undefined && effectiveRate > 0 && effectiveRate !== 1) {
    return roundCurrency(basePrice * effectiveRate);
  }

  // في حال وجود نسبة مئوية (percentage) أو رسوم إضافية (fixedFee)
  const percent = setting?.percentage || 0;
  const fixed = setting?.fixedFee || 0;
  if (percent !== 0 || fixed !== 0) {
    const total = basePrice + (basePrice * (percent / 100)) + fixed;
    return roundCurrency(total);
  }

  // إذا كانت النسبة 1 ولا يوجد أي تعديل
  if (effectiveRate !== undefined && effectiveRate > 0) {
    return roundCurrency(basePrice * effectiveRate);
  }

  return roundCurrency(basePrice);
}

/**
 * احتساب سعر الخدمة للمستخدم:
 * إذا كان عميلاً مفعلاً لمفتاح API تطبق عليه نسب الـ API المعتمدة فوراً،
 * وإذا كان عميلاً عادياً يدفع السعر الأساسي كاملاً.
 */
export function getUserServicePrice(
  basePrice: number,
  setting?: ServicePricingSetting,
  isApiUser: boolean = false
): number {
  if (!basePrice || isNaN(basePrice) || basePrice <= 0) return 0;
  if (!isApiUser) {
    return roundCurrency(basePrice);
  }
  return calculateFinalServicePrice(basePrice, setting);
}

/**
 * خريطة أسعار الباقات المعروفة لمعالجة الطلبات التي تأتي برمز الباقة فقط
 */
export const KNOWN_PACKAGE_PRICES: Record<string, number> = {
  // يمن موبايل - المعرفات والأكواد
  'super_4g': 2000,
  '4g_24h': 300,
  '4g_48h': 600,
  '4g_weekly': 1500,
  'sms_800_post': 1000,
  'm_tawfeer': 2400,
  '4g_monthly': 2500,
  'm_max_4g': 4000,
  'm_aamal_4g': 5000,
  'm_connect': 1500,
  'm_connect_max': 2000,
  'net_4g_4gb': 2000,
  'net_8g_4gb': 3900,
  'net_20g_4gb': 9700,
  'net_tawfeer_weekly': 1125,
  'net_tawfeer_monthly': 2250,
  'net_tawfeer_5gb': 2300,
  'net_tawfeer_7gb': 3000,
  'net_tawfeer_8gb_post': 3900,
  'net_tawfeer_11gb': 4125,
  'net_tawfeer_25gb': 8830,
  'net_tawfeer_20gb_post': 9700,
  'net_150mb': 500,
  'net_300mb': 900,
  'net_700mb': 1800,
  'net_1500mb': 3300,
  'volte_1d': 300,
  'volte_2d': 600,
  'volte_7d': 1500,
  'volte_30d': 2500,
  'volte_call': 1000,
  'volte_save': 1300,
  'volte_max': 1900,
  'net_10d_1gb': 1400,
  'net_10d_2gb': 2600,
  'net_10d_4gb': 4800,
  'net_10d_6gb': 6000,
  // أكواد offertype يمن موبايل
  'A5533821': 2000,
  'A4825': 300,
  'A4990003': 600,
  'A88339': 1500,
  'A41338': 1000,
  'A4823': 2400,
  'A88335': 2500,
  'A88440': 4000,
  'A49053': 5000,
  'A44881': 1500,
  'A44882': 2000,
  'A4820': 2000,
  'A4822': 3900,
  'A4829': 9700,
  'A44355': 1125,
  'A44356': 2250,
  'A4819': 2300,
  'A4818': 3000,
  'A44345': 4125,
  'A44347': 8830,
  'A69351': 500,
  'A69352': 900,
  'A69355': 1800,
  'A69356': 3300,
  'A4990008': 600,
  'A4990002': 1500,
  'A4990001': 2500,
  'A43000': 1000,
  'A42000': 1300,
  'A44883': 1900,
  'A74385': 1400,
  'A74340': 2600,
  'A74348': 4800,
  'A74354': 6000,

  // سبأفون - أرقام الباقات num
  'saba_68': 482,
  'saba_69': 482,
  'saba_70': 1205,
  'saba_71': 723,
  'saba_72': 3615,
  'saba_81': 482,
  'saba_82': 1205,
  'saba_83': 1808,
  'saba_84': 3013,
  'saba_85': 4820,
  'saba_88': 1205,
  'saba_91': 3615,
  'saba_98': 482,
  'saba_102': 4820,
  '68': 482,
  '69': 482,
  '70': 1205,
  '71': 723,
  '72': 3615,
  '81': 482,
  '82': 1205,
  '83': 1808,
  '84': 3013,
  '85': 4820,
  '88': 1205,
  '91': 3615,
  '98': 482,
  '102': 4820,

  // سبأفون - باقة أمان الأسبوعية
  'SABA114': 2880,
  'saba_SABA114': 2880,
  'saba_aman': 2880,
  'aman': 2880,
  'aman_weekly': 2880,
  'saba_aman_weekly': 2880,
  '20448': 2880,
  'saba_20448': 2880,

  // سبأفون - فئات شحن فوري شمال
  'sabaphone_22.5': 813,
  'sabaphone_40': 1446,
  'sabaphone_45': 1626,
  'sabaphone_60': 2169,
  'sabaphone_85': 3072,
  'sabaphone_100': 3615,
  'sabaphone_125': 4518,
  'sabaphone_150': 5424,
  'sabaphone_209': 7554,
  'sabaphone_300': 10845,
  'sabaphone_505': 18255,
  'sabaphone_1270': 45912,
  '22.5': 813,
  '813': 813,
  '40': 1446,
  '1446': 1446,
  '45': 1626,
  '1626': 1626,
  '60': 2169,
  '2169': 2169,
  '3072': 3072,
  '100': 3615,
  '3615': 3615,
  '125': 4518,
  '4518': 4518,
  '150': 5424,
  '5424': 5424,
  '209': 7554,
  '7554': 7554,
  '300': 10845,
  '10845': 10845,
  '505': 18255,
  '18255': 18255,
  '1270': 45912,
  '45912': 45912,

  // سبأفون - فئات شحن فوري جنوب
  'sbay_600': 960,
  'sbay_1000': 1600,
  'sbay_1650': 2640,
  'sbay_2500': 4000,
  'sbay_5000': 8000,
  'sbay_10000': 16000,
  'sbay_960': 960,
  'sbay_940': 940,
  'sbay_1600': 1600,
  'sbay_1568': 1568,
  'sbay_2640': 2640,
  'sbay_2587': 2587,
  'sbay_4000': 4000,
  'sbay_3920': 3920,
  'sbay_8000': 8000,
  'sbay_7840': 7840,
  'sbay_16000': 16000,
  'sbay_15680': 15680,
  '600': 960,
  '960': 960,
  '940': 940,
  '1000': 1600,
  '1600': 1600,
  '1568': 1568,
  '1650': 2640,
  '2640': 2640,
  '2587': 2587,
  '2500': 4000,
  '3920': 3920,
  '5000': 8000,
  '7840': 7840,
  '10000': 16000,
  '15680': 16000,

  // يو YOU - باقات السعر الموحد والفورجي
  'Sawa_300_PRE': 2904,
  'unified_300': 2904,
  'Mix_4GB_4G_PRE': 2904,
  'unified_4gb': 2904,
  'Mix_5Giga_4G_PRE': 5445,
  '4g_5gb': 5445,
  'Smart4Giga_4G_PRE': 2251,
  'smart_4g_weekly': 2251,
  'WafferPlus10_4G_PRE': 2500,
  'waffer_plus_10gb': 2500,
  'Mix_5000_PRE': 4901,
  'sawa_mix': 4901,
  'Mix_12Giga_4G_PRE': 9874,
  '4g_mix_12gb': 9874,
  'Smart15Giga_4G_PRE': 12705,
  'smart_4g_15gb': 12705,
  'Smart3Giga_3G_PRE': 1815,
  'smart_daily': 1815,

  // يو YOU - أرقام الشحن الفوري
  '4': 1700,
  '6': 3500,
  '11': 4000,
  '7': 5000,
  '8': 10000,
  '9': 19000,
  '10': 29000,
  'you_4': 1700,
  'you_6': 3500,
  'you_11': 4000,
  'you_7': 5000,
  'you_8': 10000,
  'you_9': 19000,
  'you_10': 29000,

  // واي - أرقام باقات كرم
  'why_91': 250,
  'why_92': 500,
  'why_93': 900,
  'why_94': 2000,
  'why_250': 250,
  'why_500': 500,
  'why_900': 900,
  'why_2000': 2000,

  // عدن نت
  'adenet_20gb': 3000,
  'adenet_3000': 3000,
  'adenet_40gb': 6000,
  'adenet_6000': 6000,
  'adenet_60gb': 9000,
  'adenet_9000': 9000,
  'adenet_80gb': 12000,
  'adenet_12000': 12000,
  'adenet_120gb': 30000,
  'adenet_30000': 30000,
  '20gb': 3000,
  '3000': 3000,
  '40gb': 6000,
  '6000': 6000,
  '60gb': 9000,
  '9000': 9000,
  '80gb': 12000,
  '12000': 12000,
  '120gb': 30000,
  '30000': 30000,

  // يمن فورجي 4G
  '4g_15gb': 2400,
  '4G_15GB': 2400,
  '2400': 2400,
  '4g_25gb': 4000,
  '4G_25GB': 4000,
  '4000': 4000,
  '4g_60gb': 8000,
  '4G_60GB': 8000,
  '8000': 8000,
  '4g_130gb': 16000,
  '4G_130GB': 16000,
  '16000': 16000,
  '4g_250gb': 26000,
  '4G_250GB': 26000,
  '26000': 26000,
  '4g_500gb': 46000,
  '4G_500GB': 46000,
  '46000': 46000
};

export const SABAFON_NORTH_INSTANT_PRICES: Record<string, number> = {
  '22.5': 813,
  '813': 813,
  '40': 1446,
  '1446': 1446,
  '45': 1626,
  '1626': 1626,
  '60': 2169,
  '2169': 2169,
  '85': 3072,
  '3072': 3072,
  '100': 3615,
  '3615': 3615,
  '125': 4518,
  '4518': 4518,
  '150': 5424,
  '5424': 5424,
  '209': 7554,
  '7554': 7554,
  '300': 10845,
  '10845': 10845,
  '505': 18255,
  '18255': 18255,
  '1270': 45912,
  '45912': 45912,
};

export const SABAFON_SOUTH_INSTANT_PRICES: Record<string, number> = {
  // فئات سبأفون جنوب الرسمية والمبالغ الاسمية
  '600': 960,
  '960': 960,
  '940': 960,
  '941': 960,
  '1000': 1600,
  '1600': 1600,
  '1568': 1600,
  '1650': 2640,
  '2640': 2640,
  '2587': 2640,
  '2500': 4000,
  '4000': 4000,
  '3920': 4000,
  '5000': 8000,
  '8000': 8000,
  '7840': 8000,
  '10000': 16000,
  '16000': 16000,
  '15680': 16000,
};

/**
 * احتساب تكلفة العملية عبر الـ API بالاعتماد حصراً على أسعار وإعدادات الربط البرمجي (النسب المعتمدة)
 */
export function calculateApiTransactionCost(
  payload: {
    service?: string;
    action?: string;
    amount?: string | number;
    num?: string | number;
    offerid?: string | number;
    packageid?: string | number;
    israsid?: string | number;
    count?: string | number;
    units?: string | number;
    unit?: string | number;
    quantity?: string | number;
    category?: string | number;
  },
  config: SystemServicesConfig = DEFAULT_SERVICES_CONFIG,
  _userDiscounts?: any // تم إلغاء الاعتماد على الخصومات الفردية بناء على طلب الإدارة
): number {
  const service = (payload.service || 'yemen').toLowerCase().trim();
  const action = (payload.action || 'bill').toLowerCase().trim();
  const rawAmount = parseFloat(String(payload.amount || '0')) || 0;
  const rawNum = String(payload.num || '').trim();
  const packageKey = String(
    payload.offerid || 
    (payload as any).offerId || 
    payload.packageid || 
    (payload as any).packageId || 
    (payload as any).offertype || 
    (payload as any).package_code ||
    payload.num || 
    payload.amount || 
    ''
  ).trim();

  // 1. يمن موبايل
  if (service === 'yemen' || service === 'yem') {
    if (action === 'billoffer') {
      const basePackagePrice = (KNOWN_PACKAGE_PRICES[packageKey] || 0) || rawAmount;
      return calculateFinalServicePrice(basePackagePrice, config.yemen_mobile);
    }
    return calculateFinalServicePrice(rawAmount, config.yemen_mobile);
  }

  // 2. يو YOU
  if (service === 'you' || service === 'mtn' || service === 'mtnoffer') {
    const isOffer = 
      service === 'mtnoffer' ||
      action === 'billoffer' || 
      action === 'queryoffer' ||
      action === 'offer' || 
      action === 'package' || 
      action === 'packages' ||
      Boolean(payload.offerid) ||
      Boolean((payload as any).offerId) ||
      Boolean(payload.packageid) ||
      Boolean((payload as any).packageId) ||
      Boolean((payload as any).offertype) ||
      Boolean((payload as any).package_code) ||
      Boolean(KNOWN_PACKAGE_PRICES[packageKey]) ||
      Boolean(KNOWN_PACKAGE_PRICES[`you_${rawNum}`]) ||
      Boolean(KNOWN_PACKAGE_PRICES[rawNum]) ||
      (payload.israsid === '0' || payload.israsid === 0);

    if (isOffer) {
      const youPrice = 
        KNOWN_PACKAGE_PRICES[packageKey] || 
        KNOWN_PACKAGE_PRICES[`you_${rawNum}`] || 
        KNOWN_PACKAGE_PRICES[rawNum] ||
        KNOWN_PACKAGE_PRICES[String(payload.packageid || (payload as any).packageId || payload.offerid || (payload as any).offerId || (payload as any).offertype || '')];
      
      const basePrice = youPrice || rawAmount;
      return calculateFinalServicePrice(basePrice, config.you);
    }
    // شحن فوري أو رصيد يو (معامل العملة المرتفعة للـ API)
    const multiplier = config.you?.balanceRate ?? 3.0;
    return roundCurrency(rawAmount * multiplier);
  }

  // 3. سبأفون شمال (صنعاء وما حولها)
  if (service === 'sabaphone' || service === 'sabafon' || service === 'saba') {
    if (action === 'billoffer') {
      const sabaPkgPrice = 
        KNOWN_PACKAGE_PRICES[packageKey] || 
        KNOWN_PACKAGE_PRICES[`saba_${packageKey}`] || 
        KNOWN_PACKAGE_PRICES[rawNum] || 
        KNOWN_PACKAGE_PRICES[`saba_${rawNum}`] || 
        rawAmount;
      const finalBasePrice = sabaPkgPrice > 0 ? sabaPkgPrice : (
        packageKey.toLowerCase().includes('aman') || rawNum.toLowerCase().includes('aman') || packageKey === 'SABA114' ? 2880 : rawAmount
      );
      const pkgRate = config.sabafon?.packagesRate ?? config.sabafon?.rate ?? 1;
      return roundCurrency(finalBasePrice * pkgRate);
    }

    const checkCat = String(rawNum || (payload as any).category || (payload as any).packageid || (payload as any).packageId || (rawAmount > 0 ? String(rawAmount) : '')).trim();
    const instantPrice = SABAFON_NORTH_INSTANT_PRICES[checkCat] || SABAFON_NORTH_INSTANT_PRICES[rawNum];
    if (instantPrice) {
      const rate = (typeof config.sabafon?.instantNorthRate === 'number' && config.sabafon.instantNorthRate > 0)
        ? config.sabafon.instantNorthRate
        : 1;
      return roundCurrency(instantPrice * rate);
    }
    const baseAmt = rawAmount > 0 ? rawAmount : (parseFloat(rawNum) || 0);
    const rate = (typeof config.sabafon?.instantNorthRate === 'number' && config.sabafon.instantNorthRate > 0)
      ? config.sabafon.instantNorthRate
      : (typeof config.sabafon?.rate === 'number' && config.sabafon.rate > 0 ? config.sabafon.rate : 1);
    return calculateFinalServicePrice(baseAmt * rate, config.sabafon);
  }

  // 4. سبأفون جنوب (عدن - فئة 960 بسعر 940 بمعامل نسبة الربط 0.98)
  if (service === 'sbay' || service === 'saba_south' || service === 'sabasouth') {
    const rawCat = String(rawNum || (payload as any).category || (payload as any).packageid || (payload as any).packageId || '').trim();
    const checkCat = rawCat || (rawAmount > 0 ? String(rawAmount) : '');
    const instantBasePrice = SABAFON_SOUTH_INSTANT_PRICES[checkCat] || 
                             (rawNum ? SABAFON_SOUTH_INSTANT_PRICES[rawNum] : 0) || 
                             0;

    // معامل نسبة الربط لجنوب سبأفون (افتراضي 0.98 ليصبح الـ 960 = 940 ريال بالظبط)
    let southRate = 0.98;
    if (typeof config.sabafon?.instantSouthRate === 'number' && config.sabafon.instantSouthRate > 0 && config.sabafon.instantSouthRate <= 2) {
      southRate = config.sabafon.instantSouthRate;
    } else if (typeof config.sabafon?.rate === 'number' && config.sabafon.rate > 0 && config.sabafon.rate <= 2) {
      southRate = config.sabafon.rate;
    }

    // إذا أرسل العميل مبلغاً محدداً بالضبط (مثل 940 أو أي مبلغ صافي معتمد)
    if (rawAmount > 0) {
      if (rawAmount === 940 || rawAmount === 1568 || rawAmount === 2587 || rawAmount === 3920 || rawAmount === 7840 || rawAmount === 15680) {
        return rawAmount;
      }
      if (instantBasePrice > 0) {
        return Math.floor(instantBasePrice * southRate);
      }
      return Math.floor(rawAmount * southRate);
    }

    if (instantBasePrice > 0) {
      return Math.floor(instantBasePrice * southRate);
    }

    const fallbackAmt = parseFloat(rawNum) || 0;
    if (fallbackAmt > 0) {
      const matched = SABAFON_SOUTH_INSTANT_PRICES[String(fallbackAmt)] || fallbackAmt;
      return Math.floor(matched * southRate);
    }

    return 940; // فئة 960 الافتراضية بسعر 940 بالظبط
  }

  // 5. سبأفون وحدات
  if (
    service === 'sabaunits' || 
    service === 'saba_units' || 
    ((service === 'sabaphone' || service === 'sabafon' || service === 'saba') && (
      action === 'units' || 
      action === 'sabaunits' || 
      (payload as any).type === 'units' || 
      Boolean(payload.units) || 
      Boolean(payload.count)
    ))
  ) {
    const rawUnitsStr = String(
      payload.units || 
      payload.unit || 
      payload.count || 
      payload.quantity || 
      rawNum || 
      (payload as any).unum || 
      (payload.amount && parseFloat(String(payload.amount)) < 500 ? payload.amount : '') || 
      '50'
    ).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    const unitCount = parseFloat(rawUnitsStr) || 50;
    const unitPrice = config.sabafon?.unitsRate ?? 42.35;
    return roundCurrency(unitCount * unitPrice);
  }

  // 6. سبأفون باقات
  if (service === 'sabaoffer') {
    const sabaPkgPrice = 
      KNOWN_PACKAGE_PRICES[packageKey] || 
      KNOWN_PACKAGE_PRICES[`saba_${packageKey}`] || 
      KNOWN_PACKAGE_PRICES[rawNum] || 
      KNOWN_PACKAGE_PRICES[`saba_${rawNum}`] || 
      rawAmount;
    const finalBasePrice = sabaPkgPrice > 0 ? sabaPkgPrice : (
      packageKey.toLowerCase().includes('aman') || rawNum.toLowerCase().includes('aman') || packageKey === 'SABA114' ? 2880 : rawAmount
    );
    const pkgRate = config.sabafon?.packagesRate ?? config.sabafon?.rate ?? 1;
    return roundCurrency(finalBasePrice * pkgRate);
  }

  // 7. شركة واي (Why)
  if (service === 'why') {
    const whyRate = config.why?.balanceRate ?? config.why?.rate ?? 3.8;
    const baseVal = (KNOWN_PACKAGE_PRICES[`why_${packageKey}`] || parseFloat(rawNum) || 0) || rawAmount;
    return roundCurrency(baseVal * whyRate);
  }

  // 8. يمن فورجي 4G
  if (service === 'yem4g' || service === 'yemen_4g' || service === 'yemen4g' || service === '4g') {
    const base4gPrice = KNOWN_PACKAGE_PRICES[packageKey] || rawAmount;
    return calculateFinalServicePrice(base4gPrice, config.yemen_4g);
  }

  // 9. عدن نت (باقات فقط)
  if (service === 'adenet' || service === 'aden_net' || service === 'aden') {
    const adenBasePrice = KNOWN_PACKAGE_PRICES[`adenet_${packageKey}`] || KNOWN_PACKAGE_PRICES[packageKey] || rawAmount;
    return calculateFinalServicePrice(adenBasePrice, config.aden_net);
  }

  // 10. الهاتف الثابت والإنترنت المنزلي ADSL
  if (
    service === 'post' || 
    service === 'landline_adsl' || 
    service === 'adsl' || 
    service === 'internet' || 
    service === 'net' || 
    service === 'landline' || 
    service === 'phone' || 
    service === 'telephone' || 
    service === 'hatif'
  ) {
    return calculateFinalServicePrice(rawAmount, config.landline_adsl);
  }

  // 11. الألعاب وبطاقات الشحن
  if (service === 'games') {
    return calculateFinalServicePrice(rawAmount, config.networks);
  }

  // 12. منظومة الوادي (Al-Wadi - المشفر)
  // التأكد من تطبيق النسبة على السعر الأساسي الرسمي للباقة لمنع أي خصم مضاعف
  if (service === 'alwadi' || service === 'alwaadi') {
    const pkgKey = String((payload as any).packageId || payload.packageid || payload.num || payload.offerid || '').trim();
    const basePrice = ALWADI_OFFICIAL_PRICES[pkgKey] || (rawAmount === 2850 ? 3000 : rawAmount) || 3000;
    return calculateFinalServicePrice(basePrice, config.alwadi);
  }

  // 13. كروت شبكات الواي فاي (Networks)
  if (service === 'networks' || service === 'cards' || service === 'shabakat') {
    return calculateFinalServicePrice(rawAmount, config.networks);
  }

  return roundCurrency(rawAmount);
}
