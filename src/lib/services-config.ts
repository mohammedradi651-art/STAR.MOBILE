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
 * حساب سعر الرصيد والشحن الفوري للعملة المرتفعة (الـ 1000 بـ 3000 أو حسب المعامل)
 */
export function calculateBalancePrice(baseAmount: number, setting?: ServicePricingSetting): number {
  if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) return 0;
  if (!setting) return Math.ceil(baseAmount);

  const multiplier = setting.balanceRate ?? setting.rate ?? 1;
  return Math.ceil(baseAmount * multiplier);
}
