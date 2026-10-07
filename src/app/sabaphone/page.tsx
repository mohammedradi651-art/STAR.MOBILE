'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  CheckCircle, 
  Globe, 
  Mail, 
  Phone as PhoneIcon, 
  Clock, 
  Users,
  Hash,
  Zap,
  Radio,
  Flame,
  Database,
  MessageSquare,
  MapPin,
  Smartphone,
  Calendar
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { initiateTelecomPayment, executeTelecomRequestWithTimeout } from '@/lib/telecom-order';
import { useServicesConfig } from '@/hooks/use-services-config';
import { roundCurrency, isUserApiCustomer } from '@/lib/services-config';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SABA_PRIMARY = '#0048ad';
const SABA_GRADIENT = {
    backgroundColor: '#0048ad',
    backgroundImage: `
        radial-gradient(at 0% 0%, #1e5fc9 0px, transparent 50%),
        radial-gradient(at 100% 100%, #003380 0px, transparent 50%)
    `
};

const LOGO_URL = "https://i.postimg.cc/5NDY8cjk/unnamed.png";

/**
 * فئات شحن فوري شمال (Sabaphone North) - السعر النهائي المباشر (الأساسي × 3)
 * بدون توضيح أي نسب أو معاملات للعميل
 */
const NORTH_INSTANT_OFFERS = [
  { num: '24', category: '22', price: 813, days: '5', unit: 'أيام', validity: '5 أيام' },
  { num: '16', category: '40', price: 1446, days: '8', unit: 'أيام', validity: '8 أيام' },
  { num: '20', category: '45', price: 1626, days: '8', unit: 'أيام', validity: '8 أيام' },
  { num: '21', category: '60', price: 2169, days: '14', unit: 'يوم', validity: '14 يوم' },
  { num: '23', category: '85', price: 3072, days: '40', unit: 'يوم', validity: '40 يوم' },
  { num: '14', category: '100', price: 3615, days: '50', unit: 'يوم', validity: '50 يوم' },
  { num: '8',  category: '125', price: 4518, days: '60', unit: 'يوم', validity: '60 يوم' },
  { num: '25', category: '150', price: 5424, days: '60', unit: 'يوم', validity: '60 يوم' },
  { num: '9',  category: '209', price: 7554, days: '180', unit: 'يوم', validity: '180 يوم' },
  { num: '10', category: '300', price: 10845, days: '365', unit: 'يوم', validity: '365 يوم' },
  { num: '11', category: '505', price: 18255, days: '365', unit: 'يوم', validity: '365 يوم' },
  { num: '18', category: '1270', price: 45912, days: '365', unit: 'يوم', validity: '365 يوم' },
];

/**
 * فئات شحن فوري جنوب (SBAY South) - 6 فئات محددة مع الصلاحيات
 */
const SOUTH_INSTANT_OFFERS = [
  { num: '3', category: '600', price: 960, days: '7', unit: 'أيام', validity: '7 أيام' },
  { num: '1000', category: '1000', price: 1600, days: '15', unit: 'يوم', validity: '15 يوم' },
  { num: '1650', category: '1650', price: 2640, days: '30', unit: 'يوم', validity: '30 يوم' },
  { num: '2500', category: '2500', price: 4000, days: '45', unit: 'يوم', validity: '45 يوم' },
  { num: '5000', category: '5000', price: 8000, days: '100', unit: 'يوم', validity: '100 يوم' },
  { num: '10000', category: '10000', price: 16000, days: '220', unit: 'يوم', validity: '220 يوم' },
];

/**
 * =========================================================================
 * 1. باقات سبأفون - دفع مسبق (PREPAID_PACKAGE_SECTIONS)
 * =========================================================================
 * - num: كود الباقة (هو الكود الذي يُرسل لسيرفر المزود في خدمة sabaoffer)
 * - name: اسم الباقة الظاهر للعميل
 * - price: السعر النهائي المخصوم بالريال
 */
const PREPAID_PACKAGE_SECTIONS = [
  {
    id: 'yabalash',
    title: 'باقات يابلاش + واحد',
    badge: 'الأكثر طلباً',
    offers: [
      { num: '68', name: 'يابلاش اليومية', price: 1446, data: '100 MB', minutes: '30 دقيقة', sms: '30', validity: '24 ساعة' },
    ]
  },
  {
    id: 'four_g',
    title: 'باقات فورجي',
    badge: '4G',
    offers: [

    ]
  },
  {
    id: 'social',
    title: 'باقات التواصل الاجتماعي',
    badge: 'سوشيال',
    offers: [

    ]
  },
  {
    id: 'supernet',
    title: 'باقات سوبر نت',
    badge: 'إنترنت',
    offers: [

    ]
  },
  {
    id: 'sms',
    title: 'باقات الرسائل',
    badge: 'SMS',
    offers: [

    ]
  },
  {
    id: 'gsm',
    title: 'باقات جي اس ام',
    badge: 'دقائق GSM',
    offers: [

    ]
  },
  {
    id: 'south_packages',
    title: 'باقات الجنوب',
    badge: 'عدن والجنوب',
    offers: [

    ]
  }
];

/**
 * =========================================================================
 * 2. باقات سبأفون - فوترة (POSTPAID_PACKAGE_SECTIONS)
 * =========================================================================
 * - num: كود الباقة (هو الكود الذي يُرسل لسيرفر المزود في خدمة sabaoffer)
 * - name: اسم الباقة الظاهر للعميل
 * - price: السعر النهائي المخصوم بالريال
 */
export const POSTPAID_PACKAGE_SECTIONS = [
  {
    id: 'yabalash',
    title: 'باقات يابلاش + واحد',
    badge: 'الأكثر طلباً',
    offers: [

    ]
  },
  {
    id: 'four_g',
    title: 'باقات فورجي',
    badge: '4G',
    offers: [

    ]
  },
  {
    id: 'social',
    title: 'باقات التواصل الاجتماعي',
    badge: 'سوشيال',
    offers: [

    ]
  },
  {
    id: 'supernet',
    title: 'باقات سوبر نت',
    badge: 'إنترنت',
    offers: [

    ]
  },
  {
    id: 'sms',
    title: 'باقات الرسائل',
    badge: 'SMS',
    offers: [

    ]
  },
  {
    id: 'gsm',
    title: 'باقات جي اس ام',
    badge: 'دقائق GSM',
    offers: [

    ]
  },
  {
    id: 'south_packages',
    title: 'باقات الجنوب',
    badge: 'عدن والجنوب',
    offers: [

    ]
  }
];

// تصميم كارت فئة الشحن الفوري (موحد للشمال والجنوب: أزرق متدرج + بدون ريال + شريط أبيض مدموج للصلاحية)
const InstantCategoryCard = ({ item, onClick }: { item: any, onClick: () => void }) => (
    <div
        onClick={onClick}
        className="relative overflow-hidden rounded-[22px] p-3 text-center cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95 border border-white/10 flex flex-col justify-between"
        style={{
            background: 'linear-gradient(135deg, #0048ad 0%, #002c73 100%)',
        }}
    >
        <div className="space-y-0.5 pt-1">
            <span className="text-[10px] font-bold text-white/70 block">فئة</span>
            <div className="text-xl font-black text-white leading-tight">{item.category}</div>
        </div>

        <div className="my-1.5">
            <span className="text-sm font-black text-white/95 font-mono tracking-wide">
                {item.price.toLocaleString('en-US')}
            </span>
        </div>

        {/* شريط أبيض مدموج للصلاحية: الرقم قبل أيام */}
        <div 
            className="bg-white text-[#0048ad] py-1 px-1.5 rounded-xl text-[10px] font-black shadow-sm flex items-center justify-center gap-1 select-none"
            dir="rtl"
        >
            <span className="font-sans font-black">{item.days}</span>
            <span>{item.unit}</span>
        </div>
    </div>
);

// تصميم كارت الباقة متطابق تماماً مع يمن موبايل
const PackageItemCard = ({ offer, onClick }: { offer: any, onClick: () => void }) => (
    <div 
      className="bg-[#e8f1fc] dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative border border-[#0048ad]/10 mb-3 text-center cursor-pointer hover:bg-[#0048ad]/5 transition-all active:scale-[0.98] group"
      onClick={onClick}
    >
      <div className="flex justify-center mb-3">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-md">
              <Image 
                  src={LOGO_URL} 
                  alt="Sabaphone" 
                  fill 
                  className="object-cover"
              />
          </div>
      </div>
      <h4 className="text-sm font-black text-[#0048ad] mb-1 group-hover:text-[#0048ad]/80 transition-colors">{offer.name}</h4>
      <div className="flex items-baseline justify-center mb-4">
        <span className="text-2xl font-black text-foreground">
            {offer.price.toLocaleString('en-US')}
        </span>
      </div>
      
      <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-[#0048ad]/10 text-center">
        <div className="space-y-1.5">
            <Globe className="w-5 h-5 mx-auto text-[#0048ad]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.data || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <Mail className="w-5 h-5 mx-auto text-[#0048ad]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.sms || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <PhoneIcon className="w-5 h-5 mx-auto text-[#0048ad]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.minutes || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <Clock className="w-5 h-5 mx-auto text-[#0048ad]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.validity || '-'}</p>
        </div>
      </div>
    </div>
);

export default function SabaphonePage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState<'units' | 'instant' | 'packages'>('units');
    const [lineTypeTab, setLineTypeTab] = useState<'prepaid' | 'postpaid'>('prepaid');
    
    // الوحدات
    const [unitsCount, setUnitsCount] = useState<string>('50');
    
    // فوري
    const [instantRegion, setInstantRegion] = useState<'north' | 'south'>('north');

    // كائن التأكيد الموحد
    const [confirmData, setConfirmData] = useState<{
        title: string;
        item: string;
        amount: number;
        service: string;
        num: string;
        action?: string;
    } | null>(null);

    const [isConfirming, setIsConfirming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile } = useDoc<any>(userDocRef);
    const { config } = useServicesConfig();
    const isApiUser = isUserApiCustomer(userProfile);

    useEffect(() => {
        if (showSuccess && audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        }
    }, [showSuccess]);

    const handlePhoneChange = (val: string, element: HTMLInputElement) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 9);
        setPhone(cleaned);
        if (cleaned.length === 9) {
            element.blur();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(50);
            }
            if (!cleaned.startsWith('71') && !cleaned.startsWith('72')) {
                toast({ 
                    variant: 'destructive', 
                    title: 'رقم غير صحيح', 
                    description: 'رقم سبأفون يجب أن يبدأ بـ 71 أو 72' 
                });
            }
        }
    };

    const handleContactPick = async () => {
        if (!('contacts' in navigator && 'ContactsManager' in window)) {
            toast({ variant: "destructive", title: "غير مدعوم", description: "متصفحك لا يدعم الوصول لجهات الاتصال." });
            return;
        }
        try {
            const props = ['tel'];
            const opts = { multiple: false };
            const contacts = await (navigator as any).contacts.select(props, opts);
            if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
                let selectedNumber = contacts[0].tel[0].replace(/[\s\-\(\)]/g, '');
                if (selectedNumber.startsWith('+967')) selectedNumber = selectedNumber.substring(4);
                if (selectedNumber.startsWith('00967')) selectedNumber = selectedNumber.substring(5);
                if (selectedNumber.startsWith('0')) selectedNumber = selectedNumber.substring(1);
                if (selectedNumber.length > 9) selectedNumber = selectedNumber.slice(-9);
                setPhone(selectedNumber);
                if (selectedNumber.length === 9) {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                    if (!selectedNumber.startsWith('71') && !selectedNumber.startsWith('72')) {
                        toast({ 
                            variant: 'destructive', 
                            title: 'رقم غير صحيح', 
                            description: 'رقم سبأفون يجب أن يبدأ بـ 71 أو 72' 
                        });
                    }
                }
            }
        } catch (err) { console.error(err); }
    };

    // حساب تكلفة الوحدات
    const calculateUnitsCost = (count: number) => {
        const unitRate = isApiUser ? (config.sabafon?.unitsRate ?? 45) : 43;
        return roundCurrency(count * unitRate);
    };

    // معالجة الضغط على سداد الوحدات
    const handleUnitsSubmit = () => {
        if (!phone || phone.length !== 9) {
            toast({ variant: 'destructive', title: 'رقم ناقص', description: 'يرجى إدخال رقم هاتف مكون من 9 أرقام.' });
            return;
        }
        const count = parseInt(unitsCount, 10);
        if (isNaN(count) || count < 50) {
            toast({ variant: 'destructive', title: 'كمية غير مقبولة', description: 'أقل طلب هو 50 وحدة.' });
            return;
        }

        const cost = calculateUnitsCost(count);
        setConfirmData({
            title: `شحن وحدات (${lineTypeTab === 'prepaid' ? 'دفع مسبق' : 'فوترة'})`,
            item: `${count} وحدة`,
            amount: cost,
            service: 'sabaunits',
            num: String(count)
        });
        setIsConfirming(true);
    };

    // اختيار فئة فوري شمال
    const handlePickNorthInstant = (item: typeof NORTH_INSTANT_OFFERS[0]) => {
        if (!phone || phone.length !== 9) {
            toast({ variant: 'destructive', title: 'رقم ناقص', description: 'يرجى إدخال رقم الهاتف أولاً.' });
            return;
        }
        const rate = isApiUser ? (config.sabafon?.instantNorthRate ?? 1) : 1;
        const finalCost = roundCurrency(item.price * rate);
        setConfirmData({
            title: `شحن فوري شمال`,
            item: `فئة ${item.category}`,
            amount: finalCost,
            service: 'sabaphone',
            num: item.num,
            action: 'bill'
        });
        setIsConfirming(true);
    };

    // اختيار فئة فوري جنوب
    const handlePickSouthInstant = (item: typeof SOUTH_INSTANT_OFFERS[0]) => {
        if (!phone || phone.length !== 9) {
            toast({ variant: 'destructive', title: 'رقم ناقص', description: 'يرجى إدخال رقم الهاتف أولاً.' });
            return;
        }
        const rate = isApiUser ? (config.sabafon?.instantSouthRate ?? config.sabafon?.balanceRate ?? 3.0) : 3.0;
        const finalCost = roundCurrency(item.price * rate);
        setConfirmData({
            title: `شحن فوري جنوب`,
            item: `فئة ${item.category}`,
            amount: finalCost,
            service: 'sbay',
            num: item.num,
            action: 'bill'
        });
        setIsConfirming(true);
    };

    // اختيار باقة
    const handlePickPackage = (pkg: any) => {
        if (!phone || phone.length !== 9) {
            toast({ variant: 'destructive', title: 'رقم ناقص', description: 'يرجى إدخال رقم الهاتف أولاً.' });
            return;
        }
        const rate = isApiUser ? (config.sabafon?.packagesRate ?? config.sabafon?.rate ?? 1) : 1;
        const finalCost = roundCurrency(pkg.price * rate);
        setConfirmData({
            title: `تفعيل ${pkg.name}`,
            item: pkg.name,
            amount: finalCost,
            service: 'sabaoffer',
            num: pkg.num
        });
        setIsConfirming(true);
    };

    // تنفيذ السداد بعد التأكيد
    const handleExecutePayment = async () => {
        if (!confirmData || !phone || !user || !userDocRef || !firestore) return;

        const totalCost = confirmData.amount;
        const currentBal = Number(userProfile?.balance || 0);

        if (currentBal < totalCost) {
            toast({ 
                variant: 'destructive', 
                title: 'رصيد غير كافٍ', 
                description: `رصيدك الحالي (${currentBal.toLocaleString()} ر.ي) لا يكفي لإتمام العملية (${totalCost.toLocaleString()} ر.ي).` 
            });
            return;
        }

        setIsProcessing(true);
        try {
            const { transid, backpass } = await initiateTelecomPayment({
                firestore,
                userId: user.uid,
                amount: totalCost,
                transactionType: confirmData.title,
                recipientPhoneNumber: phone,
                notes: `رقم الهاتف: ${phone} - ${confirmData.item}`,
                serviceCategory: 'سبافون'
            });

            setLastTxDetails({
                transid,
                type: confirmData.title,
                item: confirmData.item,
                phone,
                amount: totalCost
            });

            await executeTelecomRequestWithTimeout({
                firestore,
                userId: user.uid,
                transid,
                amount: totalCost,
                telecomPayload: {
                    mobile: phone,
                    action: confirmData.action || 'bill',
                    service: confirmData.service,
                    num: confirmData.num,
                    amount: confirmData.service === 'sabaunits' ? confirmData.num : undefined
                },
                backpass
            });

            setShowSuccess(true);
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'تنبيه من المزود',
                description: err.message || 'حدث خطأ أثناء معالجة الطلب.'
            });
        } finally {
            setIsProcessing(false);
            setIsConfirming(false);
            setConfirmData(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            <audio ref={audioRef} src="/sdad.mp3" preload="auto" />

            {isProcessing && <ProcessingOverlay message="جاري تنفيذ العملية..." />}

            <SimpleHeader title="سبأفون" />
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                
                {/* كارت الرصيد العلوي */}
                <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={SABA_GRADIENT}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="text-right">
                            <p className="text-xs font-bold opacity-80 mb-1">الرصيد المتوفر</p>
                            <div className="flex items-baseline gap-1">
                                <h2 className="text-2xl font-black text-white">{userProfile?.balance?.toLocaleString('en-US') || '0'}</h2>
                                <span className="text-[10px] font-bold opacity-70 text-white mr-1">ريال يمني</span>
                            </div>
                        </div>
                        <div className="p-3 bg-white/20 rounded-2xl"><Wallet className="h-6 w-6 text-white" /></div>
                    </CardContent>
                </Card>

                {/* حقل رقم الجوال */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#0048ad]/5">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رقم الجوال</Label>
                    </div>
                    <div className="relative">
                        <Input 
                            type="tel" 
                            placeholder="71xxxxxxx" 
                            value={phone} 
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)} 
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#0048ad] pr-12 pl-12" 
                        />
                        <button 
                            onClick={handleContactPick} 
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#0048ad] hover:bg-[#0048ad]/10 rounded-xl transition-colors"
                        >
                            <Users className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* التبويبات والمحتوى - لا تظهر نهائياً إلا بعد إكمال 9 أرقام صحيحة */}
                {phone.length === 9 && (phone.startsWith('71') || phone.startsWith('72')) && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
                        <Tabs dir="rtl" defaultValue="units" value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
                            <TabsList dir="rtl" className="grid w-full grid-cols-3 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#0048ad]/5">
                                <TabsTrigger value="units" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">الوحدات</TabsTrigger>
                                <TabsTrigger value="instant" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">فوري</TabsTrigger>
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">الباقات</TabsTrigger>
                            </TabsList>

                            {/* محدد الدفع المسبق / الفوترة المصغر - يظهر في الوحدات والباقات فقط ويختفي في فوري */}
                            {activeTab !== 'instant' && (
                                <div className="flex justify-center mt-3 mb-1">
                                    <Tabs dir="rtl" defaultValue="prepaid" value={lineTypeTab} onValueChange={(val: any) => setLineTypeTab(val)} className="w-full max-w-[200px]">
                                        <TabsList dir="rtl" className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-xl h-9 p-1 shadow-sm border border-[#0048ad]/5">
                                            <TabsTrigger value="prepaid" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">دفع مسبق</TabsTrigger>
                                            <TabsTrigger value="postpaid" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">فوترة</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            )}

                        {/* ---------------- 1. تبويب الوحدات ---------------- */}
                        <TabsContent value="units" className="pt-2 space-y-4 animate-in fade-in-0">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#0048ad]/5 text-center">
                                <Label className="text-sm font-black text-muted-foreground block mb-4">
                                    ادخل عدد الوحدات
                                </Label>
                                <div className="relative max-w-[240px] mx-auto">
                                    <Input 
                                        type="number" 
                                        min="50"
                                        placeholder="50" 
                                        value={unitsCount} 
                                        onChange={(e) => setUnitsCount(e.target.value)} 
                                        className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#0048ad] placeholder:text-[#0048ad]/10 focus-visible:ring-[#0048ad]" 
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0048ad]/30 font-black text-sm">وحدة</div>
                                </div>

                                {/* أزرار اختيار سريع */}
                                <div className="grid grid-cols-4 gap-2 mt-4 max-w-[260px] mx-auto">
                                    {[50, 100, 200, 500].map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setUnitsCount(String(c))}
                                            className={cn(
                                                "py-1.5 rounded-xl text-xs font-black transition-all border",
                                                unitsCount === String(c) 
                                                    ? "bg-[#0048ad] text-white border-[#0048ad] shadow-sm" 
                                                    : "bg-muted/10 text-foreground border-transparent hover:bg-muted/20"
                                            )}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>

                                {/* إجمالي المبلغ */}
                                <div className="bg-[#0048ad]/5 rounded-2xl p-3.5 mt-5 max-w-[280px] mx-auto flex items-center justify-between text-xs font-black">
                                    <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                                    <span className="text-base font-black text-[#0048ad]">
                                        {calculateUnitsCost(parseInt(unitsCount || '0') || 0).toLocaleString()} ريال
                                    </span>
                                </div>

                                <Button 
                                    className="w-full h-14 rounded-2xl text-lg font-black mt-6 shadow-lg shadow-[#0048ad]/20 text-white" 
                                    onClick={handleUnitsSubmit} 
                                    disabled={!unitsCount || parseInt(unitsCount) < 50} 
                                    style={{ backgroundColor: SABA_PRIMARY }}
                                >
                                    تنفيذ السداد
                                </Button>
                            </div>
                        </TabsContent>

                        {/* ---------------- 2. تبويب فوري ---------------- */}
                        <TabsContent value="instant" className="pt-2 space-y-4 animate-in fade-in-0">
                            {/* محدد المنطقة */}
                            <div className="flex justify-center mb-2">
                                <Tabs dir="rtl" defaultValue="north" value={instantRegion} onValueChange={(val: any) => setInstantRegion(val)} className="w-full max-w-[220px]">
                                    <TabsList dir="rtl" className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-xl h-9 p-1 shadow-sm border border-[#0048ad]/5">
                                        <TabsTrigger value="north" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">شمال</TabsTrigger>
                                        <TabsTrigger value="south" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">جنوب</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {/* فئات الشمال */}
                            {instantRegion === 'north' && (
                                <div className="grid grid-cols-3 gap-2.5">
                                    {NORTH_INSTANT_OFFERS.map((item) => (
                                        <InstantCategoryCard
                                            key={item.num}
                                            item={item}
                                            onClick={() => handlePickNorthInstant(item)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* فئات الجنوب */}
                            {instantRegion === 'south' && (
                                <div className="grid grid-cols-3 gap-2.5">
                                    {SOUTH_INSTANT_OFFERS.map((item) => (
                                        <InstantCategoryCard
                                            key={item.num}
                                            item={item}
                                            onClick={() => handlePickSouthInstant(item)}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- 3. تبويب الباقات ---------------- */}
                        <TabsContent value="packages" className="space-y-4 pt-1">
                            <Accordion type="single" collapsible className="w-full space-y-3">
                                {(lineTypeTab === 'prepaid' ? PREPAID_PACKAGE_SECTIONS : POSTPAID_PACKAGE_SECTIONS).map((cat) => (
                                    <AccordionItem key={cat.id} value={cat.id} className="border-none">
                                        <AccordionTrigger 
                                            className="px-4 py-4 rounded-2xl text-white hover:no-underline shadow-md group data-[state=open]:rounded-b-none" 
                                            style={{ backgroundColor: SABA_PRIMARY }}
                                        >
                                            <div className="flex items-center justify-between flex-1 ml-2">
                                                <span className="text-sm font-black text-right">{cat.title}</span>
                                                <div className="bg-white text-[#0048ad] font-black text-xs px-3 py-1 rounded-xl shadow-inner shrink-0">
                                                    {cat.badge}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 bg-white dark:bg-slate-900 border-x border-b border-[#0048ad]/10 rounded-b-2xl shadow-sm">
                                            {cat.offers.length === 0 ? (
                                                <div className="text-center py-4 text-xs font-bold text-muted-foreground">
                                                    لا توجد عروض متاحة حالياً لهذا القسم.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {cat.offers.map((o) => (
                                                        <PackageItemCard 
                                                            key={o.num} 
                                                            offer={o} 
                                                            onClick={() => handlePickPackage(o)} 
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
            </div>

            <Toaster />

            {/* نافذة تأكيد السداد متطابقة تماماً مع يمن موبايل */}
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد عملية السداد</AlertDialogTitle>
                        {confirmData && (
                            <div className="space-y-3 pt-4 text-right text-sm">
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground">رقم الهاتف:</span>
                                    <span className="font-bold">{phone}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground">نوع الخدمة:</span>
                                    <span className="font-bold">{confirmData.title}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground">الفئة / الباقة:</span>
                                    <span className="font-bold text-[#0048ad]">{confirmData.item}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2">
                                    <span className="font-black">إجمالي الخصم:</span>
                                    <span className="font-black text-[#0048ad] text-lg">
                                        {confirmData.amount.toLocaleString()} ريال
                                    </span>
                                </div>
                            </div>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction 
                            className="w-full rounded-2xl h-12 font-bold text-white" 
                            style={{ backgroundColor: SABA_PRIMARY }} 
                            onClick={handleExecutePayment}
                        >
                            تأكيد السداد
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">
                            إلغاء
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* شاشة النجاح متطابقة تماماً مع يمن موبايل */}
            {showSuccess && lastTxDetails && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in-0">
                    <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-8 flex justify-center">
                            <div className="bg-white/20 p-4 rounded-full animate-bounce">
                                <CheckCircle className="h-16 w-16 text-white" />
                            </div>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2>
                                <p className="text-sm text-muted-foreground mt-1">تم تنفيذ العملية بنجاح لصالح المشترك</p>
                            </div>

                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-[#0048ad]/20">
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> رقم العملية:</span>
                                    <span className="font-mono font-black text-[#0048ad]">{lastTxDetails.transid}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> رقم الهاتف:</span>
                                    <span className="font-mono font-bold tracking-widest">{lastTxDetails.phone}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> الخدمة:</span>
                                    <span className="font-bold">{lastTxDetails.type}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المخصوم:</span>
                                    <span className="font-black text-[#0048ad]">{lastTxDetails.amount.toLocaleString()} ريال</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span>
                                    <span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="rounded-2xl h-14 font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
                                <Button 
                                    className="rounded-2xl h-14 font-black text-white" 
                                    onClick={() => { setShowSuccess(false); setLastTxDetails(null); }} 
                                    style={{ backgroundColor: SABA_PRIMARY }}
                                >
                                    سداد جديد
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
