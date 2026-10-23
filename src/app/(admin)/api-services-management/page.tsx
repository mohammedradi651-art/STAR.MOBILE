'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { 
  Server, 
  Smartphone, 
  Wifi, 
  Globe, 
  Save, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Activity,
  ChevronRight,
  Info,
  CheckCircle2,
  Coins,
  Package,
  Hash
} from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { 
  DEFAULT_SERVICES_CONFIG, 
  SystemServicesConfig 
} from '@/lib/services-config';
import { cn } from '@/lib/utils';

// الشعارات الرسمية للخدمات
const LOGOS = {
  yemen_mobile: 'https://i.postimg.cc/tTXzYWY3/1200x630wa.jpg',
  you: 'https://i.postimg.cc/Y9hz6kzg/shrkt-yw.jpg',
  sabafon: 'https://i.postimg.cc/5NDY8cjk/unnamed.png',
  why: 'https://i.postimg.cc/kgWR7jwV/images-(8).jpg',
  yemen_4g: 'https://i.postimg.cc/FsmGqt98/1768999789252.jpg',
  aden_net: 'https://i.postimg.cc/FFV6dDqd/FB-IMG-1770843160346.jpg',
  landline_adsl: 'https://i.postimg.cc/ZRHzd8jN/FB-IMG-1768999572493.jpg',
  alwadi: 'https://i.postimg.cc/MKMWP3VG/15.jpg'
};

export default function ApiServicesManagementPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

  const configDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'system_settings', 'telecom_config') : null),
    [firestore]
  );
  const { data: remoteConfig } = useDoc<SystemServicesConfig>(configDocRef);

  const [activeTab, setActiveTab] = useState<'telecom' | 'alwadi' | 'networks' | 'api_creds'>('telecom');
  const [config, setConfig] = useState<SystemServicesConfig>(DEFAULT_SERVICES_CONFIG);
  const [showPassword, setShowPassword] = useState(false);
  const [showAlwadiPass, setShowAlwadiPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingBalance, setIsTestingBalance] = useState(false);
  const [agentBalance, setAgentBalance] = useState<string | null>(null);

  useEffect(() => {
    if (remoteConfig) {
      setConfig({
        telecomApi: { ...DEFAULT_SERVICES_CONFIG.telecomApi, ...(remoteConfig.telecomApi || {}) },
        yemen_mobile: { ...DEFAULT_SERVICES_CONFIG.yemen_mobile, ...(remoteConfig.yemen_mobile || {}) },
        you: { ...DEFAULT_SERVICES_CONFIG.you, ...(remoteConfig.you || {}) },
        sabafon: { 
          ...DEFAULT_SERVICES_CONFIG.sabafon, 
          ...(remoteConfig.sabafon || {}),
          packagesRate: remoteConfig.sabafon?.packagesRate ?? remoteConfig.sabafon?.rate ?? DEFAULT_SERVICES_CONFIG.sabafon.packagesRate,
          instantNorthRate: remoteConfig.sabafon?.instantNorthRate ?? DEFAULT_SERVICES_CONFIG.sabafon.instantNorthRate,
          instantSouthRate: remoteConfig.sabafon?.instantSouthRate ?? remoteConfig.sabafon?.balanceRate ?? DEFAULT_SERVICES_CONFIG.sabafon.instantSouthRate,
          unitsRate: remoteConfig.sabafon?.unitsRate ?? DEFAULT_SERVICES_CONFIG.sabafon.unitsRate,
        },
        why: { ...DEFAULT_SERVICES_CONFIG.why, ...(remoteConfig.why || {}) },
        yemen_4g: { ...DEFAULT_SERVICES_CONFIG.yemen_4g, ...(remoteConfig.yemen_4g || {}) },
        aden_net: { ...DEFAULT_SERVICES_CONFIG.aden_net, ...(remoteConfig.aden_net || {}) },
        landline_adsl: { ...DEFAULT_SERVICES_CONFIG.landline_adsl, ...(remoteConfig.landline_adsl || {}) },
        alwadi: { 
          ...DEFAULT_SERVICES_CONFIG.alwadi, 
          ...(remoteConfig.alwadi || {}),
          packages: {
            twoMonths: remoteConfig.alwadi?.packages?.twoMonths ?? DEFAULT_SERVICES_CONFIG.alwadi.packages!.twoMonths,
            fourMonths: remoteConfig.alwadi?.packages?.fourMonths ?? DEFAULT_SERVICES_CONFIG.alwadi.packages!.fourMonths,
            sixMonths: remoteConfig.alwadi?.packages?.sixMonths ?? DEFAULT_SERVICES_CONFIG.alwadi.packages!.sixMonths,
            oneYear: remoteConfig.alwadi?.packages?.oneYear ?? DEFAULT_SERVICES_CONFIG.alwadi.packages!.oneYear,
          }
        },
        networks: { ...DEFAULT_SERVICES_CONFIG.networks, ...(remoteConfig.networks || {}) },
      });
    }
  }, [remoteConfig]);

  if (!isUserLoading && !isUserAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-background">
        <div className="p-4 bg-destructive/10 text-destructive rounded-full mb-4">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-black text-foreground">غير مصرح لك بالدخول</h2>
        <p className="text-sm text-muted-foreground mt-2">هذه اللوحة خاصة بمدير النظام فقط للتحكم في الأسعار والربط البرمجي.</p>
        <Button onClick={() => router.push('/account')} className="mt-6 font-bold rounded-2xl">العودة لحسابي</Button>
      </div>
    );
  }

  const handleSaveAll = async () => {
    if (!firestore || !configDocRef) return;
    setIsSaving(true);
    try {
      const dataToSave = {
        ...config,
        updatedAt: new Date().toISOString()
      };
      await setDoc(configDocRef, dataToSave, { merge: true });
      toast({
        title: "تم حفظ التعديلات والأسعار بنجاح! ✅",
        description: "تم تحديث كافة الأسعار والنسب في التطبيق فورياً.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "فشل الحفظ",
        description: e.message || "حدث خطأ أثناء حفظ الإعدادات.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAgentBalance = async () => {
    setIsTestingBalance(true);
    setAgentBalance(null);
    try {
      const res = await fetch('/api/telecom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-source': 'internal' },
        body: JSON.stringify({ action: 'balance' })
      });
      const data = await res.json();
      if (data.balance !== undefined) {
        setAgentBalance(`${data.balance} ر.ي`);
        toast({
          title: "تم الاتصال بنجاح! 🟢",
          description: `رصيد حسابك المتاح لدى السيرفر: ${data.balance} ريال يمني`,
        });
      } else if (data.resultDesc || data.message) {
        setAgentBalance(data.resultDesc || data.message);
        toast({
          title: "رد السيرفر",
          description: data.resultDesc || data.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "رد غير متوقع",
          description: JSON.stringify(data),
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "فشل فحص الرصيد",
        description: e.message || "تعذر الوصول للسيرفر المزود.",
      });
    } finally {
      setIsTestingBalance(false);
    }
  };

  const updateTelecomApi = (key: keyof typeof config.telecomApi, val: string) => {
    setConfig(prev => ({
      ...prev,
      telecomApi: { ...prev.telecomApi, [key]: val }
    }));
  };

  const updateServiceSetting = (
    service: 'yemen_mobile' | 'you' | 'sabafon' | 'why' | 'yemen_4g' | 'aden_net' | 'landline_adsl' | 'alwadi' | 'networks',
    key: string,
    val: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [service]: {
        ...(prev[service] as any),
        [key]: val
      }
    }));
  };

  const updateAlwadiPackage = (pkgKey: 'twoMonths' | 'fourMonths' | 'sixMonths' | 'oneYear', val: number) => {
    setConfig(prev => ({
      ...prev,
      alwadi: {
        ...prev.alwadi,
        packages: {
          ...(prev.alwadi.packages || DEFAULT_SERVICES_CONFIG.alwadi.packages!),
          [pkgKey]: val
        }
      }
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950 relative overflow-hidden">
      
      {/* شريط الرأس مع زر رجوع وزر حفظ سريع */}
      <header className="flex items-center justify-between px-3 h-14 bg-card border-b shrink-0 z-20">
        <button 
          onClick={() => router.push('/account')} 
          className="p-1.5 hover:bg-muted rounded-full transition-colors text-foreground"
          aria-label="رجوع"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <h1 className="font-black text-sm text-foreground">لوحة التحكم بالأسعار والـ API</h1>

        <Button 
          onClick={handleSaveAll} 
          disabled={isSaving}
          size="sm"
          className="h-8 px-3.5 rounded-xl font-black text-xs bg-primary hover:bg-primary/90 text-white gap-1 shadow-sm"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>حفظ</span>
        </Button>
      </header>

      {/* منطقة المحتوى القابلة للتمرير بسلاسة لأسفل */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 no-scrollbar">
        
        {/* كارت الرصيد المباشر */}
        <div className="bg-gradient-to-br from-primary via-indigo-700 to-purple-800 text-white p-3.5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="p-1 bg-white/20 rounded-lg">
                  <Activity className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-[11px] font-black">رصيد حسابك في سيرفر الربط</span>
              </div>
              <Badge className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                متصل مباشر
              </Badge>
            </div>

            <div className="flex items-center justify-between bg-black/25 p-2 rounded-xl border border-white/10">
              <div>
                <span className="text-[9px] text-white/70 font-bold block">الرصيد المتاح للشحن:</span>
                <span className="text-base font-black text-amber-300">
                  {agentBalance || 'انقر للفحص'}
                </span>
              </div>
              <Button
                onClick={handleTestAgentBalance}
                disabled={isTestingBalance}
                size="sm"
                className="bg-white text-slate-900 hover:bg-white/90 rounded-lg font-black text-[11px] h-7 px-2.5 shadow gap-1"
              >
                {isTestingBalance ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
                فحص
              </Button>
            </div>
          </div>
        </div>

        {/* أزرار التبويبات الأربعة */}
        <div className="grid grid-cols-4 gap-1 bg-card p-1 rounded-xl border shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('telecom')}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-lg font-black text-[10px] transition-all gap-1",
              activeTab === 'telecom'
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>الاتصالات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('alwadi')}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-lg font-black text-[10px] transition-all gap-1",
              activeTab === 'alwadi'
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>الوادي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('networks')}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-lg font-black text-[10px] transition-all gap-1",
              activeTab === 'networks'
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>الواي فاي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('api_creds')}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-lg font-black text-[10px] transition-all gap-1",
              activeTab === 'api_creds'
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Server className="w-3.5 h-3.5" />
            <span>سيرفر API</span>
          </button>
        </div>

        {/* 1. تبويب شبكات الاتصال */}
        {activeTab === 'telecom' && (
          <div className="space-y-3">
            
            {/* يمن موبايل (حقل واحد) */}
            <SingleFieldTelecomCard
              name="يمن موبايل"
              badge="77xxxxxxx"
              logo={LOGOS.yemen_mobile}
              setting={config.yemen_mobile}
              onToggle={(enabled) => updateServiceSetting('yemen_mobile', 'enabled', enabled)}
              onRateChange={(val) => updateServiceSetting('yemen_mobile', 'rate', val)}
            />

            {/* شركة يو (سعرين: باقات السعر الموحد + رصيد وفوري عملة مرتفعة) */}
            <DualPriceTelecomCard
              name="شركة يو (YOU)"
              badge="73xxxxxxx"
              logo={LOGOS.you}
              setting={config.you}
              onToggle={(enabled) => updateServiceSetting('you', 'enabled', enabled)}
              onPackageRateChange={(val) => updateServiceSetting('you', 'rate', val)}
              onBalanceRateChange={(val) => updateServiceSetting('you', 'balanceRate', val)}
            />

            {/* سبأفون: تخصيص الباقات، الفوري جنوب، الفوري شمال، والوحدات */}
            <SabafonConfigCard
              setting={config.sabafon}
              onToggle={(enabled) => updateServiceSetting('sabafon', 'enabled', enabled)}
              onPackagesRateChange={(val) => {
                updateServiceSetting('sabafon', 'packagesRate', val);
                updateServiceSetting('sabafon', 'rate', val);
              }}
              onInstantSouthRateChange={(val) => {
                updateServiceSetting('sabafon', 'instantSouthRate', val);
                updateServiceSetting('sabafon', 'balanceRate', val);
              }}
              onInstantNorthRateChange={(val) => updateServiceSetting('sabafon', 'instantNorthRate', val)}
              onUnitsRateChange={(val) => updateServiceSetting('sabafon', 'unitsRate', val)}
            />

            {/* شركة واي: عملة مرتفعة شاملة للباقات والرصيد */}
            <SingleFieldTelecomCard
              name="شركة واي (Y Telecom)"
              badge="70xxxxxxx"
              logo={LOGOS.why}
              setting={config.why}
              onToggle={(enabled) => updateServiceSetting('why', 'enabled', enabled)}
              onRateChange={(val) => {
                updateServiceSetting('why', 'rate', val);
                updateServiceSetting('why', 'balanceRate', val);
              }}
              isHighCurrency={true}
              presetButtons={[3.8, 3.0]}
            />

            {/* يمن فورجي (حقل واحد) */}
            <SingleFieldTelecomCard
              name="يمن فورجي (Yemen 4G)"
              badge="10xxxxxxx"
              logo={LOGOS.yemen_4g}
              setting={config.yemen_4g}
              onToggle={(enabled) => updateServiceSetting('yemen_4g', 'enabled', enabled)}
              onRateChange={(val) => updateServiceSetting('yemen_4g', 'rate', val)}
            />

            {/* عدن نت (حقل واحد) */}
            <SingleFieldTelecomCard
              name="عدن نت (Aden Net 4G)"
              badge="02 / 79"
              logo={LOGOS.aden_net}
              setting={config.aden_net}
              onToggle={(enabled) => updateServiceSetting('aden_net', 'enabled', enabled)}
              onRateChange={(val) => updateServiceSetting('aden_net', 'rate', val)}
            />

            {/* الثابت والإنترنت (حقل واحد) */}
            <SingleFieldTelecomCard
              name="الثابت والإنترنت ADSL"
              badge="01 / 02"
              logo={LOGOS.landline_adsl}
              setting={config.landline_adsl}
              onToggle={(enabled) => updateServiceSetting('landline_adsl', 'enabled', enabled)}
              onRateChange={(val) => updateServiceSetting('landline_adsl', 'rate', val)}
            />

          </div>
        )}

        {/* 2. تبويب منظومة الوادي */}
        {activeTab === 'alwadi' && (
          <div className="space-y-3">
            <Card className="rounded-2xl border shadow-sm bg-card overflow-hidden">
              <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative w-9 h-9 rounded-xl overflow-hidden border shadow-sm">
                    <Image src={LOGOS.alwadi} alt="Alwadi" fill className="object-cover" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black">منظومة الوادي</h3>
                    <p className="text-[10px] text-muted-foreground font-bold">تجديد اشتراكات الكروت</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs",
                    config.alwadi.enabled 
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {config.alwadi.enabled ? "مفعلة" : "معطلة"}
                  </span>
                  <Switch 
                    checked={config.alwadi.enabled} 
                    onCheckedChange={(val) => updateServiceSetting('alwadi', 'enabled', val)}
                  />
                </div>
              </div>

              <CardContent className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-black">نسبة / معامل المنظومة (مثلاً 0.95 أو 1):</Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateServiceSetting('alwadi', 'rate', 0.95)}
                        className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border transition-all",
                          (config.alwadi.rate ?? 1) === 0.95 ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground"
                        )}
                      >
                        0.95 (خصم 5%)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateServiceSetting('alwadi', 'rate', 1)}
                        className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border transition-all",
                          (config.alwadi.rate ?? 1) === 1 ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground"
                        )}
                      >
                        1 (بدون خصم)
                      </button>
                    </div>
                  </div>

                  <RateDecimalInput 
                    value={config.alwadi.rate}
                    onChange={(val) => updateServiceSetting('alwadi', 'rate', val)}
                    defaultValue={1}
                    className="rounded-lg font-black h-8 text-center text-xs"
                    placeholder="مثال: 0.95"
                  />
                </div>

                {/* سطر توضيحي لحسبة أسعار باقات منظومة الوادي بعد تطبيق النسبة */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 p-2 rounded-xl text-[10px] flex items-center justify-between font-black">
                  <span>سعر باقة شهرين (3,000) للعميل بالـ API:</span>
                  <span className="text-primary text-xs font-black">
                    {Math.ceil(3000 * (config.alwadi.rate ?? 1)).toLocaleString()} ر.ي 
                    <span className="text-[9px] text-muted-foreground mr-1">
                      ({(config.alwadi.rate ?? 1) === 1 ? 'بدون خصم' : `خصم: ${3000 - Math.ceil(3000 * (config.alwadi.rate ?? 1))} ر.ي`})
                    </span>
                  </span>
                </div>

                <div className="pt-2 border-t">
                  <h4 className="text-[10px] font-black text-muted-foreground mb-1.5">أسعار باقات التجديد الرسمية (ر.ي)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/30 rounded-xl border flex flex-col justify-between">
                      <p className="text-[10px] font-black">شهرين (رمز 1)</p>
                      <Input 
                        type="number"
                        value={config.alwadi.packages?.twoMonths || 3000}
                        onChange={(e) => updateAlwadiPackage('twoMonths', parseFloat(e.target.value) || 0)}
                        className="rounded-lg font-black h-7 text-center text-xs bg-card mt-1"
                      />
                    </div>

                    <div className="p-2 bg-muted/30 rounded-xl border flex flex-col justify-between">
                      <p className="text-[10px] font-black">4 أشهر (رمز 3)</p>
                      <Input 
                        type="number"
                        value={config.alwadi.packages?.fourMonths || 6000}
                        onChange={(e) => updateAlwadiPackage('fourMonths', parseFloat(e.target.value) || 0)}
                        className="rounded-lg font-black h-7 text-center text-xs bg-card mt-1"
                      />
                    </div>

                    <div className="p-2 bg-muted/30 rounded-xl border flex flex-col justify-between">
                      <p className="text-[10px] font-black">6 أشهر (رمز 7)</p>
                      <Input 
                        type="number"
                        value={config.alwadi.packages?.sixMonths || 9000}
                        onChange={(e) => updateAlwadiPackage('sixMonths', parseFloat(e.target.value) || 0)}
                        className="rounded-lg font-black h-7 text-center text-xs bg-card mt-1"
                      />
                    </div>

                    <div className="p-2 bg-muted/30 rounded-xl border flex flex-col justify-between">
                      <p className="text-[10px] font-black">سنة كاملة (رمز 9)</p>
                      <Input 
                        type="number"
                        value={config.alwadi.packages?.oneYear || 15000}
                        onChange={(e) => updateAlwadiPackage('oneYear', parseFloat(e.target.value) || 0)}
                        className="rounded-lg font-black h-7 text-center text-xs bg-card mt-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 3. تبويب شبكات الواي فاي */}
        {activeTab === 'networks' && (
          <div className="space-y-3">
            <Card className="rounded-2xl border shadow-sm bg-card overflow-hidden">
              <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border shadow-sm">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black">كروت شبكات الواي فاي</h3>
                    <p className="text-[10px] text-muted-foreground font-bold">نسبة الزيادة على الكروت</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs",
                    config.networks.enabled 
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {config.networks.enabled ? "مفعلة" : "معطلة"}
                  </span>
                  <Switch 
                    checked={config.networks.enabled} 
                    onCheckedChange={(val) => updateServiceSetting('networks', 'enabled', val)}
                  />
                </div>
              </div>

              <CardContent className="p-3 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-black">عمولة صاحب الـ API (افتراضي 0.95 = 5% له):</Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateServiceSetting('networks', 'rate', 0.95)}
                        className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border transition-all",
                          (config.networks.rate ?? 0.95) === 0.95 ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground"
                        )}
                      >
                        0.95 (5%)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateServiceSetting('networks', 'rate', 1)}
                        className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border transition-all",
                          (config.networks.rate ?? 0.95) === 1 ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground"
                        )}
                      >
                        1 (كامل)
                      </button>
                    </div>
                  </div>

                  <RateDecimalInput 
                    value={config.networks.rate}
                    onChange={(val) => updateServiceSetting('networks', 'rate', val)}
                    defaultValue={0.95}
                    className="rounded-lg font-black h-8 text-center text-xs"
                    placeholder="مثال: 0.95"
                  />
                </div>

                {/* سطر توضيحي لحسبة عمولة الـ API للكروت */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 p-2 rounded-xl text-[10px] flex items-center justify-between font-black">
                  <span>الـ 1,000 ر.ي كرت يكون لصاحب الـ API:</span>
                  <span className="text-primary text-xs font-black">
                    {Math.ceil(1000 * (config.networks.rate ?? 0.95)).toLocaleString()} ر.ي 
                    <span className="text-[9px] text-muted-foreground mr-1">
                      (عمولتك: {1000 - Math.ceil(1000 * (config.networks.rate ?? 0.95))} ر.ي)
                    </span>
                  </span>
                </div>

                <div className="p-2.5 bg-muted/30 rounded-xl border text-[10px] font-bold text-muted-foreground">
                  يمكنك إدارة وتفاصيل الشبكات والكروت من:
                  <Button variant="link" onClick={() => router.push('/networks-management')} className="font-black text-primary p-0 h-auto mr-1 text-[10px]">
                    إدارة الشبكات ↗
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4. تبويب سيرفر الـ API */}
        {activeTab === 'api_creds' && (
          <div className="space-y-3">
            <Card className="rounded-2xl border shadow-sm bg-card overflow-hidden">
              <div className="p-2.5 bg-muted/40 border-b flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs font-black">سيرفر الشحن (Robot API)</h3>
              </div>

              <CardContent className="p-3 space-y-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black">رابط السيرفر (Base URL)</Label>
                  <Input 
                    value={config.telecomApi.apiBaseUrl}
                    onChange={(e) => updateTelecomApi('apiBaseUrl', e.target.value)}
                    dir="ltr"
                    className="font-mono text-xs rounded-lg h-8"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black">معرف الوكيل (USERID)</Label>
                    <Input 
                      value={config.telecomApi.userId}
                      onChange={(e) => updateTelecomApi('userId', e.target.value)}
                      dir="ltr"
                      placeholder="e.g. 5231"
                      className="font-mono text-xs rounded-lg h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black">اسم المستخدم (USERNAME)</Label>
                    <Input 
                      value={config.telecomApi.username}
                      onChange={(e) => updateTelecomApi('username', e.target.value)}
                      dir="ltr"
                      placeholder="770326828"
                      className="font-mono text-xs rounded-lg h-8"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black">كلمة المرور / المفتاح (PASSWORD)</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? 'text' : 'password'}
                      value={config.telecomApi.password}
                      onChange={(e) => updateTelecomApi('password', e.target.value)}
                      dir="ltr"
                      placeholder="••••••••••••"
                      className="font-mono text-xs rounded-lg h-8 pl-8"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-sm bg-card overflow-hidden">
              <div className="p-2.5 bg-muted/40 border-b flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs font-black">سيرفر منظومة الوادي (XML-RPC)</h3>
              </div>

              <CardContent className="p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black">المضيف (Host)</Label>
                    <Input 
                      value={config.telecomApi.alwadiHost || ''}
                      onChange={(e) => updateTelecomApi('alwadiHost', e.target.value)}
                      dir="ltr"
                      placeholder="api.alwaadi.net"
                      className="font-mono text-xs rounded-lg h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black">قاعدة البيانات (DB)</Label>
                    <Input 
                      value={config.telecomApi.alwadiDb || ''}
                      onChange={(e) => updateTelecomApi('alwadiDb', e.target.value)}
                      dir="ltr"
                      placeholder="alwaadi_DB"
                      className="font-mono text-xs rounded-lg h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black">المستخدم (User)</Label>
                    <Input 
                      value={config.telecomApi.alwadiUsername || ''}
                      onChange={(e) => updateTelecomApi('alwadiUsername', e.target.value)}
                      dir="ltr"
                      placeholder="770326M"
                      className="font-mono text-xs rounded-lg h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black">كلمة المرور (Pass)</Label>
                    <div className="relative">
                      <Input 
                        type={showAlwadiPass ? 'text' : 'password'}
                        value={config.telecomApi.alwadiPassword || ''}
                        onChange={(e) => updateTelecomApi('alwadiPassword', e.target.value)}
                        dir="ltr"
                        placeholder="••••••••••••"
                        className="font-mono text-xs rounded-lg h-8 pl-8"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowAlwadiPass(!showAlwadiPass)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showAlwadiPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* زر حفظ أسفل القائمة */}
        <div className="pt-2 pb-6">
          <Button 
            onClick={handleSaveAll} 
            disabled={isSaving}
            className="w-full h-11 rounded-xl font-black text-xs shadow-md bg-primary hover:bg-primary/90 text-white gap-2"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            حفظ كافة التغييرات والأسعار
          </Button>
        </div>

      </div>

      <Toaster />
    </div>
  );
}

// حقل إدخال الكسور العشرية والنسب بدقة وسلاسة دون حذف الفاصلة (0.)
interface RateDecimalInputProps {
  value: number | undefined;
  onChange: (val: number) => void;
  defaultValue?: number;
  placeholder?: string;
  className?: string;
  dir?: string;
}

function RateDecimalInput({
  value,
  onChange,
  defaultValue = 1,
  placeholder = "مثال: 0.95",
  className,
  dir = "ltr"
}: RateDecimalInputProps) {
  const currentNum = value !== undefined ? value : defaultValue;
  const [text, setText] = useState<string>(String(currentNum));

  useEffect(() => {
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed === currentNum) return;
    if (text.endsWith('.') || text.endsWith('.0') || text === '0' || text === '') return;
    setText(String(currentNum));
  }, [currentNum]);

  const handleChange = (raw: string) => {
    let formatted = raw.replace('،', '.').replace(/[^0-9.]/g, '');
    const parts = formatted.split('.');
    if (parts.length > 2) {
      formatted = parts[0] + '.' + parts.slice(1).join('');
    }
    setText(formatted);

    const parsed = parseFloat(formatted);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(text);
    if (isNaN(parsed) || parsed < 0) {
      setText(String(defaultValue));
      onChange(defaultValue);
    } else {
      setText(String(parsed));
      onChange(parsed);
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      dir={dir}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
}

// بطاقة سبأفون المخصصة: الباقات، الفوري (جنوب / شمال)، والوحدات
interface SabafonConfigCardProps {
  setting: any;
  onToggle: (enabled: boolean) => void;
  onPackagesRateChange: (val: number) => void;
  onInstantSouthRateChange: (val: number) => void;
  onInstantNorthRateChange: (val: number) => void;
  onUnitsRateChange: (val: number) => void;
}

function SabafonConfigCard({
  setting,
  onToggle,
  onPackagesRateChange,
  onInstantSouthRateChange,
  onInstantNorthRateChange,
  onUnitsRateChange,
}: SabafonConfigCardProps) {
  const currentPkgRate = setting.packagesRate ?? setting.rate ?? 1;
  const currentSouthRate = setting.instantSouthRate ?? setting.balanceRate ?? 3.0;
  const currentNorthRate = setting.instantNorthRate ?? 1;
  const currentUnitsRate = setting.unitsRate ?? 45;

  const [pkgText, setPkgText] = useState(String(currentPkgRate));
  const [southText, setSouthText] = useState(String(currentSouthRate));
  const [northText, setNorthText] = useState(String(currentNorthRate));
  const [unitsText, setUnitsText] = useState(String(currentUnitsRate));

  useEffect(() => {
    if (parseFloat(pkgText) !== currentPkgRate && !pkgText.endsWith('.')) {
      setPkgText(String(currentPkgRate));
    }
  }, [currentPkgRate]);

  useEffect(() => {
    if (parseFloat(southText) !== currentSouthRate && !southText.endsWith('.')) {
      setSouthText(String(currentSouthRate));
    }
  }, [currentSouthRate]);

  useEffect(() => {
    if (parseFloat(northText) !== currentNorthRate && !northText.endsWith('.')) {
      setNorthText(String(currentNorthRate));
    }
  }, [currentNorthRate]);

  useEffect(() => {
    if (parseFloat(unitsText) !== currentUnitsRate && !unitsText.endsWith('.')) {
      setUnitsText(String(currentUnitsRate));
    }
  }, [currentUnitsRate]);

  const handleTextChange = (raw: string, setter: (val: string) => void, notifier: (val: number) => void) => {
    const formatted = raw.replace('،', '.').replace(/[^0-9.]/g, '');
    setter(formatted);
    const parsed = parseFloat(formatted);
    if (!isNaN(parsed) && parsed >= 0) {
      notifier(parsed);
    }
  };

  return (
    <Card className="rounded-2xl border-2 border-primary/20 shadow-sm bg-card overflow-hidden">
      {/* رأس البطاقة */}
      <div className="p-3 bg-primary/5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border shadow-sm shrink-0 bg-white">
            <Image src={LOGOS.sabafon} alt="SabaFon" fill className="object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-foreground">سبأفون (SabaFon)</h3>
              <Badge variant="outline" className="text-[9px] font-bold py-0 px-1 border-primary/30 text-primary">71 / 72xxxxxxx</Badge>
            </div>
            <p className="text-[9.5px] font-bold text-muted-foreground mt-0.5">
              تخصيص أسعار الوحدات، الباقات، والفوري (جنوب / شمال)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className={cn(
            "text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs",
            setting.enabled 
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
              : "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            {setting.enabled ? "مفعلة" : "معطلة"}
          </span>
          <Switch checked={setting.enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      <CardContent className="p-3 space-y-3">
        {/* 1. باقات سبأفون */}
        <div className="p-2.5 bg-muted/20 rounded-xl border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              1. باقات سبأفون (معامل/نسبة):
            </span>
            <div className="relative w-24">
              <Input 
                type="text"
                inputMode="decimal"
                value={pkgText}
                onChange={(e) => handleTextChange(e.target.value, setPkgText, onPackagesRateChange)}
                className="rounded-lg font-black h-7 text-center text-xs bg-card"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>مثال: باقة بـ 1,000 ر.ي تصبح: <strong className="text-foreground">{Math.ceil(1000 * currentPkgRate).toLocaleString()} ر.ي</strong></span>
            <div className="flex items-center gap-1">
              {[1, 0.971].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPkgText(String(p));
                    onPackagesRateChange(p);
                  }}
                  className={cn(
                    "px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors",
                    currentPkgRate === p ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted text-muted-foreground border-border"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. الفوري جنوب (عملة مرتفعة) */}
        <div className="p-2.5 bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              2. الشحن الفوري - جنوب (عملة مرتفعة):
            </span>
            <div className="relative w-24">
              <Input 
                type="text"
                inputMode="decimal"
                value={southText}
                onChange={(e) => handleTextChange(e.target.value, setSouthText, onInstantSouthRateChange)}
                className="rounded-lg font-black h-7 text-center text-xs bg-card border-blue-300 focus-visible:ring-blue-500"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>الـ 1,000 فوري جنوب تصبح: <strong className="text-blue-700 dark:text-blue-400">{Math.ceil(1000 * currentSouthRate).toLocaleString()} ر.ي</strong></span>
            <div className="flex items-center gap-1">
              {[3.0, 3.5, 3.8].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSouthText(String(p));
                    onInstantSouthRateChange(p);
                  }}
                  className={cn(
                    "px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors",
                    currentSouthRate === p ? "bg-blue-600 text-white border-blue-600" : "bg-card hover:bg-muted text-muted-foreground border-border"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. الفوري شمال (صنعاء) */}
        <div className="p-2.5 bg-amber-500/5 rounded-xl border border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              3. الشحن الفوري - شمال (صنعاء):
            </span>
            <div className="relative w-24">
              <Input 
                type="text"
                inputMode="decimal"
                value={northText}
                onChange={(e) => handleTextChange(e.target.value, setNorthText, onInstantNorthRateChange)}
                className="rounded-lg font-black h-7 text-center text-xs bg-card border-amber-300 focus-visible:ring-amber-500"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>الـ 1,000 فوري شمال تصبح: <strong className="text-amber-700 dark:text-amber-400">{Math.ceil(1000 * currentNorthRate).toLocaleString()} ر.ي</strong></span>
            <div className="flex items-center gap-1">
              {[1.0, 0.971].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setNorthText(String(p));
                    onInstantNorthRateChange(p);
                  }}
                  className={cn(
                    "px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors",
                    currentNorthRate === p ? "bg-amber-600 text-white border-amber-600" : "bg-card hover:bg-muted text-muted-foreground border-border"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. سداد الوحدات */}
        <div className="p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              4. سداد الوحدات (سعر/معامل الوحدة):
            </span>
            <div className="relative w-24">
              <Input 
                type="text"
                inputMode="decimal"
                value={unitsText}
                onChange={(e) => handleTextChange(e.target.value, setUnitsText, onUnitsRateChange)}
                className="rounded-lg font-black h-7 text-center text-xs bg-card border-emerald-300 focus-visible:ring-emerald-500"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>الـ 100 وحدة تصبح: <strong className="text-emerald-700 dark:text-emerald-400">{Math.ceil(100 * currentUnitsRate).toLocaleString()} ر.ي</strong></span>
            <div className="flex items-center gap-1">
              {[45, 1.0].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setUnitsText(String(p));
                    onUnitsRateChange(p);
                  }}
                  className={cn(
                    "px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors",
                    currentUnitsRate === p ? "bg-emerald-600 text-white border-emerald-600" : "bg-card hover:bg-muted text-muted-foreground border-border"
                  )}
                >
                  {p} {p === 45 ? 'ر.ي' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// بطاقة الخدمة ذات السعرين (خاص بشركات: يو، سبأفون، واي)
function DualPriceTelecomCard({
  name,
  badge,
  logo,
  setting,
  onToggle,
  onPackageRateChange,
  onBalanceRateChange,
  packageLabel = "باقات السعر الموحد",
  balanceLabel = "سداد رصيد وفوري (عملة مرتفعة)"
}: {
  name: string;
  badge: string;
  logo: string;
  setting: any;
  onToggle: (enabled: boolean) => void;
  onPackageRateChange: (val: number) => void;
  onBalanceRateChange: (val: number) => void;
  packageLabel?: string;
  balanceLabel?: string;
}) {
  const currentPkgRate = setting.rate ?? 1;
  const currentBalRate = setting.balanceRate ?? 3.0;

  const [pkgText, setPkgText] = useState<string>(String(currentPkgRate));
  const [balText, setBalText] = useState<string>(String(currentBalRate));

  useEffect(() => {
    if (parseFloat(pkgText) !== currentPkgRate && !pkgText.endsWith('.')) {
      setPkgText(String(currentPkgRate));
    }
  }, [currentPkgRate]);

  useEffect(() => {
    if (parseFloat(balText) !== currentBalRate && !balText.endsWith('.')) {
      setBalText(String(currentBalRate));
    }
  }, [currentBalRate]);

  const handlePkgChange = (raw: string) => {
    const formatted = raw.replace('،', '.').replace(/[^0-9.]/g, '');
    setPkgText(formatted);
    const parsed = parseFloat(formatted);
    if (!isNaN(parsed) && parsed > 0) {
      onPackageRateChange(parsed);
    }
  };

  const handleBalChange = (raw: string) => {
    const formatted = raw.replace('،', '.').replace(/[^0-9.]/g, '');
    setBalText(formatted);
    const parsed = parseFloat(formatted);
    if (!isNaN(parsed) && parsed > 0) {
      onBalanceRateChange(parsed);
    }
  };

  const balanceCostThousand = Math.ceil(1000 * currentBalRate);

  return (
    <Card className="rounded-2xl border shadow-sm bg-card overflow-hidden">
      {/* رأس البطاقة */}
      <div className="p-2.5 bg-muted/40 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden border shadow-sm shrink-0 bg-white">
            <Image src={logo} alt={name} fill className="object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-black text-foreground">{name}</h3>
              <Badge variant="outline" className="text-[9px] font-bold py-0 px-1">{badge}</Badge>
            </div>
            <p className="text-[9px] font-bold text-muted-foreground">
              {setting.enabled ? "الخدمة مفعلة (سعران مخصصان)" : "الخدمة معطلة"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className={cn(
            "text-[9px] font-black px-2 py-0.5 rounded-full border shadow-2xs",
            setting.enabled 
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
              : "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            {setting.enabled ? "مفعلة" : "معطلة"}
          </span>
          <Switch checked={setting.enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      <CardContent className="p-2.5 space-y-2.5">
        
        {/* السعر 1: باقات السعر الموحد */}
        <div className="p-2 bg-muted/20 rounded-xl border space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-foreground flex items-center gap-1">
              <Package className="w-3 h-3 text-primary" />
              {packageLabel} (معامل/نسبة):
            </span>
            <div className="relative w-24">
              <Input 
                type="text"
                inputMode="decimal"
                value={pkgText}
                onChange={(e) => handlePkgChange(e.target.value)}
                className="rounded-lg font-black h-7 text-center text-xs bg-card"
                placeholder="1"
                dir="ltr"
              />
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground font-bold">
            {currentPkgRate === 1 ? "حسب السعر المعتمد للباقات (الألف بألف)" : `سعر الباقات مضروب في ${currentPkgRate}`}
          </p>
        </div>

        {/* السعر 2: سداد رصيد وفوري عملة مرتفعة (الـ 1000 تصبح 3000) */}
        <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-900 dark:text-amber-300 flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-600" />
              {balanceLabel}:
            </span>
            <div className="relative w-24">
              <Input 
                type="text"
                inputMode="decimal"
                value={balText}
                onChange={(e) => handleBalChange(e.target.value)}
                className="rounded-lg font-black h-7 text-center text-xs bg-card border-amber-300"
                placeholder="مثال: 3"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-black text-amber-800 dark:text-amber-400">
            <span>الـ 1,000 رصيد يدفع الزبون:</span>
            <span className="text-primary text-xs font-black">{balanceCostThousand.toLocaleString()} ر.ي</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

// بطاقة الخدمة بحقل واحد فقط للنسبة / المعامل وتدعم العملة المرتفعة والفواصل
function SingleFieldTelecomCard({
  name,
  badge,
  logo,
  setting,
  onToggle,
  onRateChange,
  isHighCurrency = false,
  presetButtons
}: {
  name: string;
  badge: string;
  logo: string;
  setting: any;
  onToggle: (enabled: boolean) => void;
  onRateChange: (val: number) => void;
  isHighCurrency?: boolean;
  presetButtons?: number[];
}) {
  const currentRate = setting.rate ?? (isHighCurrency ? 3.0 : 1);
  const [textValue, setTextValue] = useState<string>(String(currentRate));

  useEffect(() => {
    if (parseFloat(textValue) !== currentRate && !textValue.endsWith('.')) {
      setTextValue(String(currentRate));
    }
  }, [currentRate]);

  const handleInputChange = (raw: string) => {
    const formatted = raw.replace('،', '.').replace(/[^0-9.]/g, '');
    setTextValue(formatted);
    const parsed = parseFloat(formatted);
    if (!isNaN(parsed) && parsed > 0) {
      onRateChange(parsed);
    }
  };

  const costForThousand = Math.ceil(1000 * currentRate);
  const diffFromThousand = 1000 - costForThousand;
  const buttons = presetButtons || (isHighCurrency ? [3.0, 3.8] : [1, 0.971]);

  return (
    <Card className="rounded-2xl border shadow-sm bg-card overflow-hidden">
      
      {/* رأس البطاقة */}
      <div className="p-2.5 bg-muted/40 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden border shadow-sm shrink-0 bg-white">
            <Image src={logo} alt={name} fill className="object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-black text-foreground">{name}</h3>
              <Badge variant="outline" className="text-[9px] font-bold py-0 px-1">{badge}</Badge>
              {isHighCurrency && (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[8px] py-0 px-1">
                  عملة مرتفعة
                </Badge>
              )}
            </div>
            <p className="text-[9px] font-bold text-muted-foreground">
              {setting.enabled ? (isHighCurrency ? "مفعلة (شامل الباقات والرصيد)" : "الخدمة مفعلة") : "الخدمة معطلة"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className={cn(
            "text-[9px] font-black px-2 py-0.5 rounded-full border shadow-2xs",
            setting.enabled 
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
              : "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            {setting.enabled ? "مفعلة" : "معطلة"}
          </span>
          <Switch checked={setting.enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      {/* محتوى البطاقة: حقل واحد فقط للنسبة / المعامل */}
      <CardContent className="p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] font-black text-foreground shrink-0">
            {isHighCurrency ? "معامل العملة المرتفعة:" : "النسبة / المعامل:"}
          </Label>

          <div className="relative flex-1 max-w-[120px]">
            <Input 
              type="text"
              inputMode="decimal"
              value={textValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className={cn(
                "rounded-lg font-black h-8 text-center text-xs bg-muted/20",
                isHighCurrency && "border-amber-300 bg-amber-500/5 text-amber-900 dark:text-amber-300"
              )}
              placeholder={isHighCurrency ? "مثال: 3.0" : "مثال: 0.954"}
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {buttons.map(btnVal => (
              <button
                key={btnVal}
                type="button"
                onClick={() => {
                  setTextValue(String(btnVal));
                  onRateChange(btnVal);
                }}
                className={cn(
                  "text-[9px] font-black px-1.5 py-1 rounded-md border transition-all",
                  currentRate === btnVal ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {btnVal}
              </button>
            ))}
          </div>
        </div>

        {/* سطر توضيحي ذكي */}
        <div className={cn(
          "px-2 py-1.5 rounded-lg border text-[10px] flex items-center justify-between",
          isHighCurrency ? "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-300 font-black" : "bg-muted/40 text-foreground"
        )}>
          {isHighCurrency ? (
            <>
              <span>شامل الباقات والرصيد: الـ 1,000 =</span>
              <span className="text-primary text-xs font-black">{costForThousand.toLocaleString()} ر.ي</span>
            </>
          ) : currentRate === 1 ? (
            <span className="font-bold text-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              الألف بألف تماماً (1,000 ر.ي = 1,000 ر.ي)
            </span>
          ) : currentRate < 1 ? (
            <span className="font-bold text-emerald-600">
              تكلفة الـ 1,000 ر.ي = {costForThousand} ر.ي (فائدة الـ API: {diffFromThousand} ر.ي)
            </span>
          ) : (
            <span className="font-bold text-primary">
              سعر الـ 1,000 ر.ي للزبون = {costForThousand} ر.ي
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
