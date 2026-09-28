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
  Smartphone, 
  Globe, 
  Mail, 
  Phone as PhoneIcon, 
  Clock, 
  Users,
  Hash,
  Zap,
  Menu as MenuIcon
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, increment, collection as firestoreCollection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Offer = {
    offerName: string;
    price: number; 
    data?: string;
    sms?: string;
    minutes?: string;
    validity?: string;
    num: string;
};

// اللون الأزرق المعتمد لسبأفون
const SABA_PRIMARY = '#0048ad';
const SABA_GRADIENT = {
    backgroundColor: '#0048ad',
    backgroundImage: `radial-gradient(at 0% 0%, #1e5fc9 0px, transparent 50%), radial-gradient(at 100% 100%, #003380 0px, transparent 50%)`
};

const LOGO_URL = "https://i.postimg.cc/5NDY8cjk/unnamed.png";

// معامل التحويل للرصيد والباقات اليدوية
const RATE = 3.8;

// بيانات التبويب "فوري" من الصورة
const INSTANT_OFFERS = [
    { category: '600', price: 960, validity: '7 أيام', num: '600' },
    { category: '1000', price: 1600, validity: '15 يوم', num: '1000' },
    { category: '1650', price: 2640, validity: '30 يوم', num: '1650' },
    { category: '2500', price: 4000, validity: '45 يوم', num: '2500' },
    { category: '5000', price: 8000, validity: '100 يوم', num: '5000' },
    { category: '10000', price: 16000, validity: '220 يوم', num: '10000' },
];

const PREPAID_CATEGORIES = [
  {
    id: 'yabalash',
    title: 'باقات يابلاش',
    offers: [
      { num: '68', offerName: 'يابالش اليومية', price: 482, data: '100MB', validity: '24 ساعة' },
      { num: '69', offerName: 'يابالش الاسبوعية', price: 482, data: '300MB', validity: '7 أيام' },
      { num: '70', offerName: 'يابالش الشهرية', price: 1205, data: '1GB', validity: '30 يوم' },
      { num: '72', offerName: 'يابالش سوبر بلس', price: 3615, data: '3GB', validity: '30 يوم' },
    ]
  },
  {
    id: 'supernet',
    title: 'باقات سوبر نت',
    offers: [
      { num: '81', offerName: 'سوبرنت اليومية', price: 482, data: '200MB', validity: 'يوم' },
      { num: '82', offerName: 'سوبرنت 250MB', price: 1205, data: '250MB', validity: '30 يوم' },
      { num: '83', offerName: 'سوبرنت 500MB', price: 1808, data: '500MB', validity: '30 يوم' },
      { num: '84', offerName: 'سوبرنت 1GB', price: 3013, data: '1GB', validity: '30 يوم' },
      { num: '85', offerName: 'سوبرنت 4GB', price: 4820, data: '4GB', validity: '30 يوم' },
    ]
  }
];

const POSTPAID_CATEGORIES = [
  {
    id: 'post_yabalash',
    title: 'يابالش فوترة',
    offers: [
      { num: '88', offerName: 'يابالش الشهرية', price: 1205, data: '1GB', validity: 'شهر' },
      { num: '91', offerName: 'يابالش سوبر بلس', price: 3615, data: '4GB', validity: 'شهر' },
      { num: '98', offerName: 'سوبرنت فوترة اليومية', price: 482, data: '250MB', validity: 'يوم' },
      { num: '102', offerName: 'سوبرنت فوترة 4GB', price: 4820, data: '4GB', validity: 'شهر' },
    ]
  }
];

// مكون كرت التبويب "فوري" (تصميم مطابق للصورة)
const InstantOfferCard = ({ offer, onClick }: { offer: any, onClick: () => void }) => (
    <Card 
        className="overflow-hidden rounded-[20px] border-none shadow-md bg-white cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
        onClick={onClick}
    >
        <div className="bg-[#0048ad] p-3 text-white">
            <div className="flex justify-between items-center px-1">
                <div className="flex flex-col gap-[3px] items-start">
                   <div className="w-5 h-[1.5px] bg-white/60" />
                   <div className="w-5 h-[1.5px] bg-white/60" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold">فئة</span>
                    <div className="bg-white/20 p-1 rounded-full border border-white/20">
                        <div className="relative w-3.5 h-3.5">
                            <Image src={LOGO_URL} alt="S" fill className="rounded-full object-contain" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-center mt-3 mb-1">
                <h3 className="text-3xl font-black">{offer.category}</h3>
            </div>
        </div>
        <CardContent className="p-4 text-center space-y-4">
            <div>
                <p className="text-[10px] font-bold text-muted-foreground mb-1">السعر</p>
                <p className="text-lg font-black text-[#0048ad]">{offer.price.toLocaleString()}.00 ريال</p>
            </div>
            <div className="bg-[#0048ad]/10 py-1.5 px-6 rounded-lg inline-block mx-auto">
                <span className="text-[10px] font-bold text-[#0048ad]">{offer.validity}</span>
            </div>
        </CardContent>
    </Card>
);

const PackageItemCard = ({ offer, onClick }: { offer: Offer, onClick: () => void }) => (
    <div 
      className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative border border-[#0048ad]/10 mb-3 text-center cursor-pointer hover:bg-[#0048ad]/5 transition-all active:scale-[0.98] group"
      onClick={onClick}
    >
      <div className="flex justify-center mb-3">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-md">
              <Image src={LOGO_URL} alt="Sabaphone" fill className="object-cover" />
          </div>
      </div>
      <h4 className="text-sm font-black text-[#0048ad] mb-1 group-hover:text-[#0048ad]/80 transition-colors">{offer.offerName}</h4>
      <div className="flex items-baseline justify-center mb-4">
        <span className="text-2xl font-black text-foreground">
            {Math.ceil(offer.price * RATE).toLocaleString('en-US')}
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
    const [activeTab, setActiveTab] = useState("packages");
    const [lineType, setLineType] = useState('prepaid');
    const [amount, setAmount] = useState('');
    const [selectedOffer, setSelectedOffer] = useState<any>(null);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile } = useDoc<any>(userDocRef);

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
            if (!cleaned.startsWith('71')) {
                toast({ variant: 'destructive', title: 'رقم غير مدعوم', description: 'يرجى إدخال رقم سبأفون جنوب يبدأ بـ 71' });
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
                let num = contacts[0].tel[0].replace(/[\s\-\(\)]/g, '').slice(-9);
                setPhone(num);
            }
        } catch (err) { console.error(err); }
    };

    const handleProcessPayment = async () => {
        if (!phone || !user || !userDocRef || !firestore || !selectedOffer) return;
        
        const finalToDeduct = selectedOffer.finalPrice;

        if ((userProfile?.balance ?? 0) < finalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام هذه العملية.' });
            return;
        }

        setIsProcessing(true);
        try {
            const transid = Date.now().toString().slice(-8);
            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mobile: phone, 
                    action: 'bill', 
                    service: selectedOffer.endpoint, 
                    num: selectedOffer.num,
                    transid: transid 
                })
            });
            const result = await response.json();
            
            if (!response.ok || (result.resultCode !== "0" && result.resultCode !== 0)) {
                throw new Error(result.message || 'فشل تنفيذ العملية من المصدر.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-finalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid,
                transactionDate: new Date().toISOString(),
                amount: finalToDeduct,
                transactionType: `سداد سبأفون (${selectedOffer.typeLabel})`,
                notes: `رقم الهاتف: ${phone}`,
                recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({ type: selectedOffer.typeLabel, phone, amount: finalToDeduct, transid });
            setShowSuccess(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "تنبيه", description: error.message });
        } finally {
            setIsProcessing(false);
            setIsConfirmingAction(false);
            setSelectedOffer(null);
        }
    };

    const currentCategories = lineType === 'prepaid' ? PREPAID_CATEGORIES : POSTPAID_CATEGORIES;

    if (showSuccess && lastTxDetails) {
        return (
            <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
                <audio ref={audioRef} src="/sdad.mp3" autoPlay />
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in-0">
                    <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-8 flex justify-center">
                            <div className="bg-white/20 p-4 rounded-full animate-bounce">
                                <CheckCircle className="h-16 w-16 text-white" />
                            </div>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2>
                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground">رقم العملية:</span>
                                    <span className="font-mono font-black text-primary">{lastTxDetails.transid}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground">نوع الخدمة:</span>
                                    <span className="font-bold">{lastTxDetails.type}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">المبلغ المخصوم:</span>
                                    <span className="font-black text-primary text-base">{lastTxDetails.amount.toLocaleString()} ر.ي</span>
                                </div>
                            </div>
                            <Button className="w-full h-14 rounded-2xl font-black" onClick={() => router.push('/login')} style={{ backgroundColor: SABA_PRIMARY }}>الرئيسية</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isProcessing && <ProcessingOverlay />}
            <SimpleHeader title="سبأفون" />
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                
                <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={SABA_GRADIENT}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="text-right">
                            <p className="text-xs font-bold opacity-80 mb-1">الرصيد المتوفر</p>
                            <h2 className="text-2xl font-black text-white">{userProfile?.balance?.toLocaleString('en-US') || '0'} <span className="text-[10px] opacity-70">ر.ي</span></h2>
                        </div>
                        <div className="p-3 bg-white/20 rounded-2xl"><Smartphone className="h-6 w-6 text-white" /></div>
                    </CardContent>
                </Card>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#0048ad]/10">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2 px-1">رقم الجوال</Label>
                    <div className="relative">
                        <Input
                            type="tel"
                            placeholder="71xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#0048ad] pr-12 pl-12"
                        />
                        <button onClick={handleContactPick} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#0048ad] hover:bg-[#0048ad]/10 rounded-xl transition-colors"><Users className="h-5 w-5" /></button>
                    </div>
                </div>

                {phone.length === 9 && phone.startsWith('71') && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#0048ad]/10">
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">باقات</TabsTrigger>
                                <TabsTrigger value="instant" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">فوري</TabsTrigger>
                                <TabsTrigger value="balance" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#0048ad] data-[state=active]:text-white">رصيد</TabsTrigger>
                            </TabsList>

                            <TabsContent value="packages" className="pt-2">
                                <div className="flex justify-center mb-4">
                                    <Tabs value={lineType} onValueChange={setLineType} className="max-w-[200px] w-full">
                                        <TabsList className="grid w-full grid-cols-2 bg-muted/30 rounded-xl h-9">
                                            <TabsTrigger value="prepaid" className="rounded-lg text-[10px]">مسبق الدفع</TabsTrigger>
                                            <TabsTrigger value="postpaid" className="rounded-lg text-[10px]">فوترة</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                                <Accordion type="single" collapsible className="w-full space-y-3">
                                    {currentCategories.map((cat) => (
                                        <AccordionItem key={cat.id} value={cat.id} className="border-none">
                                            <AccordionTrigger className="px-5 py-5 rounded-2xl text-white hover:no-underline shadow-md group data-[state=open]:rounded-b-none" style={{ backgroundColor: SABA_PRIMARY }}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                                        <Zap className="h-4 w-4 text-white" />
                                                    </div>
                                                    <span className="text-sm font-black flex-1 mr-4 text-right">{cat.title}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 bg-white dark:bg-slate-900 border-x border-b border-[#0048ad]/10 rounded-b-2xl shadow-sm">
                                                <div className="grid grid-cols-1 gap-1">
                                                    {cat.offers.map((o) => (
                                                        <PackageItemCard key={o.num} offer={o} onClick={() => {
                                                            setSelectedOffer({
                                                                typeLabel: o.offerName,
                                                                endpoint: 'sabaoffer',
                                                                num: o.num,
                                                                finalPrice: Math.ceil(o.price * RATE),
                                                                originalPrice: o.price
                                                            });
                                                            setIsConfirmingAction(true);
                                                        }} />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </TabsContent>

                            <TabsContent value="instant" className="pt-2">
                                <div className="grid grid-cols-2 gap-3 pb-20">
                                    {INSTANT_OFFERS.map((offer) => (
                                        <InstantOfferCard 
                                            key={offer.num} 
                                            offer={offer} 
                                            onClick={() => {
                                                setSelectedOffer({
                                                    typeLabel: `فئة ${offer.category}`,
                                                    endpoint: 'sbay',
                                                    num: offer.num,
                                                    finalPrice: offer.price,
                                                    originalPrice: offer.category
                                                });
                                                setIsConfirmingAction(true);
                                            }} 
                                        />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="balance" className="pt-2">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#0048ad]/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل المبلغ المراد شحنه</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input 
                                            type="number" 
                                            placeholder="0.00" 
                                            value={amount} 
                                            onChange={(e) => setAmount(e.target.value)} 
                                            className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#0048ad] focus-visible:ring-[#0048ad]" 
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0048ad]/30 font-black text-sm">ر.ي</div>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg text-white" 
                                        onClick={() => {
                                            const val = parseFloat(amount);
                                            if (isNaN(val) || val <= 0) return;
                                            setSelectedOffer({
                                                typeLabel: 'شحن رصيد يدوي',
                                                endpoint: 'sabaunits',
                                                num: val,
                                                finalPrice: Math.ceil(val * RATE),
                                                originalPrice: val
                                            });
                                            setIsConfirmingAction(true);
                                        }} 
                                        disabled={!amount} 
                                        style={{ backgroundColor: SABA_PRIMARY }}
                                    >
                                        تسديد الرصيد
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <Toaster />

            <AlertDialog open={isConfirmingAction} onOpenChange={setIsConfirmingAction}>
                <AlertDialogContent className="rounded-[32px] max-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد عملية السداد</AlertDialogTitle>
                        <div className="py-4 space-y-3 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">نوع العملية:</span>
                                <span className="font-bold">{selectedOffer?.typeLabel}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">رقم الهاتف:</span>
                                <span className="font-mono font-bold">{phone}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 bg-primary/5 rounded-xl px-2 mt-2">
                                <span className="font-black text-[#0048ad]">المبلغ المخصوم:</span>
                                <span className="font-black text-[#0048ad] text-lg">
                                    {selectedOffer?.finalPrice?.toLocaleString()} ريال
                                </span>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                        <AlertDialogAction 
                            onClick={handleProcessPayment} 
                            className="w-full rounded-2xl h-12 font-black"
                            style={{ backgroundColor: SABA_PRIMARY }}
                        >
                            تأكيد
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

