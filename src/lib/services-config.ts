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
    rate: 1, // الباقات
    packagesRate: 1,
    unitsRate: 45, // قيمة الوحدة بالريال (افتراضي 45)
    instantNorthRate: 1, // فوري شمال (افتراضي 1)
    instantSouthRate: 3.0, // فوري جنوب عملة مرتفعة (الـ 1000 = 3000)
    balanceRate: 3.0,
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
  }
};

/**
 * حساب السعر النهائي للباقات
 */
export function calculateFinalServicePrice(basePrice: number, setting?: ServicePricingSetting): number {
  if (!basePrice || isNaN(basePrice) || basePrice <= 0) return 0;
  if (!setting) return Math.ceil(basePrice);

  if (setting.rate !== undefined && setting.rate > 0) {
    return Math.ceil(basePrice * setting.rate);
  }

  const percent = setting.percentage || 0;
  const fixed = setting.fixedFee || 0;
  const total = basePrice + (basePrice * (percent / 100)) + fixed;
  return Math.ceil(total);
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

  // يو YOU - أرقام الشحن الفوري
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
  'why_2000': 2000
};

/**
 * احتساب تكلفة العملية عبر الـ API بالاعتماد على أسعار وإعدادات الربط البرمجي
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
  },
  config: SystemServicesConfig = DEFAULT_SERVICES_CONFIG
): number {
  const service = (payload.service || 'yemen').toLowerCase().trim();
  const action = (payload.action || 'bill').toLowerCase().trim();
  const rawAmount = parseFloat(String(payload.amount || '0')) || 0;
  const rawNum = String(payload.num || '').trim();
  const packageKey = String(payload.offerid || payload.packageid || payload.num || '').trim();

  // 1. يمن موبايل
  if (service === 'yemen' || service === 'yem') {
    if (action === 'billoffer') {
      const basePackagePrice = rawAmount > 0 
        ? rawAmount 
        : (KNOWN_PACKAGE_PRICES[packageKey] || 0);
      return calculateFinalServicePrice(basePackagePrice, config.yemen_mobile);
    }
    return calculateFinalServicePrice(rawAmount, config.yemen_mobile);
  }

  // 2. يو YOU
  if (service === 'you') {
    if (action === 'billoffer' || action === 'queryoffer') {
      const youFastPrice = KNOWN_PACKAGE_PRICES[`you_${rawNum}`] || KNOWN_PACKAGE_PRICES[packageKey];
      const basePrice = rawAmount > 0 ? rawAmount : (youFastPrice || 0);
      return calculateFinalServicePrice(basePrice, config.you);
    }
    // شحن فوري أو رصيد يو (يطبق معامل العملة المرتفعة)
    const multiplier = config.you?.balanceRate ?? 3.0;
    return Math.ceil(rawAmount * multiplier);
  }

  // 3. سبأفون شمال (صنعاء وما حولها)
  if (service === 'sabaphone') {
    const rate = config.sabafon?.instantNorthRate ?? 1;
    return calculateFinalServicePrice(rawAmount * rate, config.sabafon);
  }

  // 4. سبأفون جنوب (عدن - عملة مرتفعة)
  if (service === 'sbay') {
    const southRate = config.sabafon?.instantSouthRate ?? config.sabafon?.balanceRate ?? 3.0;
    return Math.ceil(rawAmount * southRate);
  }

  // 5. سبأفون وحدات
  if (service === 'sabaunits') {
    const unitCount = parseFloat(rawNum || String(payload.amount || '0')) || 1;
    const unitPrice = config.sabafon?.unitsRate ?? 45;
    return Math.ceil(unitCount * unitPrice);
  }

  // 6. سبأفون باقات
  if (service === 'sabaoffer') {
    const sabaPkgPrice = KNOWN_PACKAGE_PRICES[`saba_${rawNum}`] || KNOWN_PACKAGE_PRICES[packageKey] || rawAmount;
    const pkgRate = config.sabafon?.packagesRate ?? 1;
    return Math.ceil(sabaPkgPrice * pkgRate);
  }

  // 7. شركة واي (Why)
  if (service === 'why') {
    const whyRate = config.why?.balanceRate ?? config.why?.rate ?? 3.8;
    const baseVal = rawAmount > 0 
      ? rawAmount 
      : (KNOWN_PACKAGE_PRICES[`why_${packageKey}`] || parseFloat(rawNum) || 0);
    return Math.ceil(baseVal * whyRate);
  }

  // 8. يمن فورجي 4G
  if (service === 'yem4g') {
    return calculateFinalServicePrice(rawAmount, config.yemen_4g);
  }

  // 9. عدن نت
  if (service === 'adenet') {
    return calculateFinalServicePrice(rawAmount, config.aden_net);
  }

  // 10. الهاتف الثابت والإنترنت المنزلي ADSL
  if (service === 'post') {
    return calculateFinalServicePrice(rawAmount, config.landline_adsl);
  }

  // 11. الألعاب وبطاقات الشحن
  if (service === 'games') {
    return calculateFinalServicePrice(rawAmount, config.networks);
  }

  // افتراضي لأي خدمة غير محددة
  return Math.ceil(rawAmount);
}
