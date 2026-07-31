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
  Hash as HashIcon,
  Calendar,
  Smartphone,
  Globe,
  Mail,
  Phone as PhoneIcon,
  Clock,
  Users
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

// --- TYPES ---
type UserProfile = {
  balance?: number;
};

type FastOffer = {
    num: string;
    value: string;
    price: number;
    title: string;
};

type Offer = {
    offerName: string;
    offerId: string;
    price: number;
    data?: string;
    sms?: string;
    minutes?: string;
    validity?: string;
    offertype: string; 
    id?: string; 
};

// --- STYLES ---
const YOU_PRIMARY = '#FECC4F';
const YOU_GRADIENT = {
    backgroundColor: '#FECC4F',
    backgroundImage: `
        radial-gradient(at 0% 0%, #FFD97D 0px, transparent 50%),
        radial-gradient(at 100% 100%, #E6B000 0px, transparent 50%)
    `
};

// --- DATA DEFINITIONS ---

const YOU_FAST_OFFERS: FastOffer[] = [
    { num: '4', value: '410', price: 1700, title: 'شحن 410 ريال' },
    { num: '6', value: '830', price: 3500, title: 'شحن 830 ريال' },
    { num: '11', value: '1000', price: 4000, title: 'شحن 1000 ريال' },
    { num: '7', value: '1250', price: 5000, title: 'شحن 1250 ريال' },
    { num: '8', value: '2500', price: 10000, title: 'شحن 2500 ريال' },
    { num: '9', value: '5000', price: 19000, title: 'شحن 5000 ريال' },
    { num: '10', value: '7500', price: 29000, title: 'شحن 7500 ريال' },
];

const YOU_CATEGORIES = [
  {
    id: 'unified',
    title: 'باقات السعر الموحد',
    badge: 'YOU',
    icon: Smartphone,
    offers: [
      { offerId: 'unified_300', offerName: 'باقة السعر الموحد 300', price: 2904, data: '500MB', minutes: '300', sms: '300', validity: 'شهر', offertype: 'Sawa_300_PRE' },
      { offerId: 'unified_4gb', offerName: 'باقة السعر الموحد 4 جيجا فورجي', price: 2904, data: '4GB', minutes: '300', sms: '200', validity: 'شهر', offertype: 'Mix_4GB_4G_PRE' },
      { offerId: '4g_5gb', offerName: 'باقة فورجي 5 قيقا', price: 5445, data: '5GB', validity: 'شهر', offertype: 'Mix_5Giga_4G_PRE' },
      { offerId: 'smart_4g_weekly', offerName: 'باقة سمارت فورجي الاسبوعية', price: 2251, data: '4GB', validity: 'اسبوع', offertype: 'Smart4Giga_4G_PRE' },
      { offerId: 'waffer_plus_10gb', offerName: 'باقة وفر بلس 10 جيجا', price: 2500, data: '10GB', validity: 'شهر', offertype: 'WafferPlus10_4G_PRE' },
      { offerId: 'sawa_mix', offerName: 'سوا مكس 1200', price: 4901, data: '1GB', minutes: '1200', sms: '800', validity: 'شهر', offertype: 'Mix_5000_PRE' },
      { offerId: '4g_mix_12gb', offerName: 'فورجي مكس 12جيجا', price: 9874, data: '12GB', minutes: '600', sms: '200', validity: 'شهر', offertype: 'Mix_12Giga_4G_PRE' },
      { offerId: 'smart_4g_15gb', offerName: 'سمارت فورجي 15 جيجا', price: 12705, data: '15GB', minutes: '-', sms: '-', validity: 'شهر', offertype: 'Smart15Giga_4G_PRE' },
      { offerId: 'smart_daily', offerName: 'باقة سمارت اليومية', price: 1815, data: '3GB', validity: 'شهر', offertype: 'Smart3Giga_3G_PRE' },
    ]
  }
];

// --- SUB-COMPONENTS ---

const PackageItemCard = ({ offer, onClick }: { offer: Offer, onClick: () => void }) => (
    <div 
      className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative border border-[#FECC4F]/20 mb-3 text-center cursor-pointer hover:bg-[#FECC4F]/5 transition-all active:scale-[0.98] group"
      onClick={onClick}
    >
      <h4 className="text-sm font-black text-[#E6B000] mb-2 group-hover:text-[#FECC4F] transition-colors">{offer.offerName}</h4>
      <div className="flex items-baseline justify-center mb-4">
        <span className="text-2xl font-black text-[#4A3B00] dark:text-white">
            {offer.price.toLocaleString('en-US')}
        </span>
      </div>
      
      <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-[#FECC4F]/10 text-center">
        <div className="space-y-1.5">
            <Globe className="w-5 h-5 mx-auto text-[#FECC4F]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.data || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <Mail className="w-5 h-5 mx-auto text-[#FECC4F]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.sms || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <PhoneIcon className="w-5 h-5 mx-auto text-[#FECC4F]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.minutes || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <Clock className="w-5 h-5 mx-auto text-[#FECC4F]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.validity || '-'}</p>
        </div>
      </div>
    </div>
);

const FastOfferCard = ({ offer, onClick }: { offer: FastOffer, onClick: () => void }) => (
    <div 
      className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#FECC4F]/10 mb-3 cursor-pointer hover:bg-[#FECC4F]/5 transition-all active:scale-[0.98] group flex items-center justify-between"
      onClick={offer && onClick}
    >
      <div className="flex items-center gap-4 text-right">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#FECC4F]/20 bg-white shrink-0">
              <Image src="https://i.postimg.cc/Y9hz6kzg/shrkt-yw.jpg" alt="YOU" fill className="object-cover" />
          </div>
          <div className="flex flex-col items-start">
              <h4 className="text-sm font-black text-foreground group-hover:text-[#E6B000] transition-colors">{offer.title}</h4>
              <p className="text-[10px] font-bold text-muted-foreground">شحن فوري مباشر</p>
          </div>
      </div>

      <div className="flex items-baseline text-left shrink-0">
        <span className="text-xl font-black text-[#4A3B00] dark:text-[#FECC4F]">{offer.price.toLocaleString('en-US')}</span>
      </div>
    </div>
);

export default function YouServicesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState("packages");
    const [lineType, setLineType] = useState('prepaid');
    const [amount, setAmount] = useState('');
    const [selectedFastOffer, setSelectedFastOffer] = useState<FastOffer | null>(null);
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
    const [isConfirmingBalance, setIsConfirmingBalance] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isActivatingOffer, setIsActivatingOffer] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const handlePhoneChange = (val: string, element: HTMLInputElement) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 9);
        setPhone(cleaned);
        
        if (cleaned.length === 9) {
            element.blur();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(50);
            }

            if (!cleaned.startsWith('73')) {
                toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم شركة YOU يجب أن يبدأ بـ 73' });
            }
        }
    };

    const handleContactPick = async () => {
        if (!('contacts' in navigator && 'ContactsManager' in window)) {
            toast({
                variant: "destructive",
                title: "غير مدعوم",
                description: "متصفحك لا يدعم الوصول لجهات الاتصال.",
            });
            return;
        }

        try {
            const props = ['tel'];
            const opts = { multiple: false };
            const contacts = await (navigator as any).contacts.select(props, opts);
            
            if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
                let selectedNumber = contacts[0].tel[0];
                selectedNumber = selectedNumber.replace(/[\s\-\(\)]/g, '');
                if (selectedNumber.startsWith('+967')) selectedNumber = selectedNumber.substring(4);
                if (selectedNumber.startsWith('00967')) selectedNumber = selectedNumber.substring(5);
                if (selectedNumber.startsWith('07')) selectedNumber = selectedNumber.substring(1);
                
                const inputElement = document.querySelector('input[type="tel"]') as HTMLInputElement;
                if (inputElement) handlePhoneChange(selectedNumber, inputElement);
                else setPhone(selectedNumber.slice(0, 9));
            }
        } catch (err) {
            console.error("Contacts selection failed:", err);
        }
    };

    useEffect(() => {
        if (showSuccess && audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        }
    }, [showSuccess]);

    const handleProcessPayment = async (payAmount: number, typeLabel: string, numCode: string = '0') => {
        if (!phone || !user || !userDocRef || !firestore) return;
        
        if (!phone.startsWith('73')) {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم شركة YOU يجب أن يبدأ بـ 73' });
            return;
        }

        const finalToDeduct = typeLabel.includes('شحن') ? payAmount : payAmount * 3;

        if ((userProfile?.balance ?? 0) < finalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام هذه العملية.' });
            return;
        }

        setIsProcessing(true);
        try {
            const transid = Date.now().toString().slice(-8);
            const apiPayload: any = {
                mobile: phone,
                action: 'bill',
                service: 'you',
                transid: transid,
                type: lineType,
            };

            if (typeLabel === 'رصيد') {
                apiPayload.num = payAmount; 
                apiPayload.israsid = '1';
            } else {
                apiPayload.num = numCode;
            }

            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload)
            });
            const result = await response.json();
            
            if (!response.ok || (result.resultCode !== "0" && result.resultCode !== 0 && result.resultCode !== "-2" && result.resultCode !== -2)) {
                throw new Error(result.message || 'فشل عملية السداد من المصدر.');
            }
            
            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-finalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid,
                transactionDate: new Date().toISOString(),
                amount: finalToDeduct,
                transactionType: `سداد YOU ${typeLabel}`,
                notes: `إلى رقم: ${phone}`,
                recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({ type: `سداد YOU ${typeLabel}`, phone: phone, amount: finalToDeduct, transid: transid });
            setShowSuccess(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "فشل السداد", description: error.message });
        } finally {
            setIsProcessing(false);
            setIsConfirmingBalance(false);
            setSelectedFastOffer(null);
        }
    };

    const handleActivateOffer = async () => {
        if (!selectedOffer || !phone || !user || !userDocRef || !firestore) return;
        
        if (!phone.startsWith('73')) {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم شركة YOU يجب أن يبدأ بـ 73' });
            return;
        }

        const totalToDeduct = selectedOffer.price;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لتفعيل هذه الباقة.' });
            return;
        }

        setIsActivatingOffer(true);
        try {
            const transid = Date.now().toString().slice(-8);
            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mobile: phone, 
                    action: 'billoffer', 
                    service: 'you', 
                    num: selectedOffer.offertype, 
                    amount: selectedOffer.price, 
                    type: lineType,
                    transid 
                })
            });
            const result = await response.json();
            
            const isSuccess = result.resultCode === "0" || result.resultCode === 0;
            const isPending = result.resultCode === "-2" || result.resultCode === -2;

            if (!response.ok || (!isSuccess && !isPending)) {
                throw new Error(result.message || 'فشل تفعيل الباقة من المصدر.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid, 
                transactionDate: new Date().toISOString(), 
                amount: totalToDeduct,
                transactionType: `تفعيل باقة YOU: ${selectedOffer.offerName}`, 
                notes: `للرقم: ${phone}. الحالة: ${isPending ? 'قيد التنفيذ' : 'ناجحة'}`, 
                recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({
                type: `تفعيل ${selectedOffer.offerName}`,
                phone: phone,
                amount: totalToDeduct,
                transid: transid
            });
            setShowSuccess(true);
            setSelectedOffer(null);
        } catch (e: any) {
            toast({ variant: "destructive", title: "خطأ", description: e.message });
        } finally {
            setIsActivatingOffer(false);
        }
    };

    if (showSuccess && lastTxDetails) {
        return (
            <div className="flex flex-col h-full bg-[#FFF9F0] dark:bg-slate-950">
                <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in-0 p-4">
                    <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-10 flex justify-center">
                            <div className="bg-white/20 p-5 rounded-full animate-bounce">
                                <CheckCircle className="h-16 w-16 text-white" />
                            </div>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2>
                                <p className="text-sm text-muted-foreground mt-1">تمت العملية بنجاح لصالح المشترك</p>
                            </div>

                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-[#FECC4F]/20">
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><HashIcon className="w-3.5 h-3.5" /> رقم العملية:</span>
                                    <span className="font-mono font-black text-[#E6B000]">{lastTxDetails.transid}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><PhoneIcon className="w-3.5 h-3.5" /> رقم الهاتف:</span>
                                    <span className="font-mono font-bold tracking-widest">{lastTxDetails.phone}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> الخدمة:</span>
                                    <span className="font-bold">{lastTxDetails.type}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المخصوم:</span>
                                    <span className="font-black text-[#E6B000]">{lastTxDetails.amount.toLocaleString('en-US')} ريال</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span>
                                    <span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="rounded-2xl h-14 font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
                                <Button className="rounded-2xl h-14 font-black text-white" onClick={() => { setShowSuccess(false); setPhone(''); }} style={{ backgroundColor: '#E6B000' }}>سداد جديد</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const currentCategories = YOU_CATEGORIES;

    return (
        <div className="flex flex-col h-full bg-[#FFF9F0] dark:bg-slate-950">
            {isActivatingOffer && <ProcessingOverlay message="جاري تفعيل الباقة..." />}
            {isProcessing && <ProcessingOverlay message="جاري تنفيذ طلبك..." />}

            <SimpleHeader title="خدمات YOU" />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                <Card className="overflow-hidden rounded-[28px] shadow-lg border-none mb-4" style={YOU_GRADIENT}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="text-right">
                            <p className={cn("text-xs font-bold opacity-80 mb-1 text-[#4A3B00]")}>الرصيد المتوفر</p>
                            <div className="flex items-baseline gap-1">
                                <h2 className="text-2xl font-black text-[#4A3B00]">
                                    {userProfile?.balance?.toLocaleString('en-US') || '0'}
                                </h2>
                                <span className="text-[10px] font-bold opacity-70 text-[#4A3B00] mr-1">ريال يمني</span>
                            </div>
                        </div>
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <Wallet className="h-6 w-6 text-[#4A3B00]" />
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#FECC4F]/20">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رقم الجوال</Label>
                    </div>
                    <div className="relative">
                        <Input
                            type="tel"
                            placeholder="73xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#FECC4F] transition-all pr-12 pl-12"
                        />
                        <button 
                            onClick={handleContactPick}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#E6B000] hover:bg-[#FECC4F]/10 rounded-xl transition-colors"
                            title="جهات الاتصال"
                        >
                            <Users className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {phone.length === 9 && phone.startsWith('73') && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        
                        <div className="flex justify-center mt-2">
                            <Tabs value={lineType} onValueChange={setLineType} className="w-full max-w-[240px]">
                                <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-xl h-10 p-1 shadow-sm border border-[#FECC4F]/10">
                                    <TabsTrigger value="prepaid" className="rounded-lg font-bold text-xs data-[state=active]:bg-[#FECC4F] data-[state=active]:text-[#4A3B00]">دفع مسبق</TabsTrigger>
                                    <TabsTrigger value="postpaid" className="rounded-lg font-bold text-xs data-[state=active]:bg-[#FECC4F] data-[state=active]:text-[#4A3B00]">فوترة</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <Tabs defaultValue="packages" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#FECC4F]/10">
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#FECC4F] data-[state=active]:text-[#4A3B00]">الباقات</TabsTrigger>
                                <TabsTrigger value="fast" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#FECC4F] data-[state=active]:text-[#4A3B00]">فوري</TabsTrigger>
                                <TabsTrigger value="balance" className="rounded-xl font-bold text-xs data-[state=active]:bg-[#FECC4F] data-[state=active]:text-[#4A3B00]">رصيد</TabsTrigger>
                            </TabsList>

                            <TabsContent value="packages" className="pt-2 animate-in fade-in-0 duration-300">
                                <Accordion type="single" collapsible className="w-full space-y-3">
                                    {currentCategories.map((cat) => (
                                        <AccordionItem key={cat.id} value={cat.id} className="border-none">
                                            <AccordionTrigger className="px-4 py-4 rounded-2xl text-[#4A3B00] hover:no-underline shadow-md group data-[state=open]:rounded-b-none" style={YOU_GRADIENT}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="bg-white/30 text-[#4A3B00] font-black text-xs px-3 py-1 rounded-xl shadow-inner shrink-0">{cat.badge}</div>
                                                    <span className="text-sm font-black flex-1 mr-4 text-right">{cat.title}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 bg-white dark:bg-slate-900 border-x border-b border-[#FECC4F]/20 rounded-b-2xl shadow-sm">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {cat.offers.map((o) => (
                                                        <PackageItemCard key={o.offerId} offer={o} onClick={() => setSelectedOffer(o)} />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </TabsContent>

                            <TabsContent value="fast" className="pt-2 animate-in fade-in-0 duration-300">
                                <div className="grid grid-cols-1 gap-1">
                                    {YOU_FAST_OFFERS.map((offer) => (
                                        <FastOfferCard key={offer.num} offer={offer} onClick={() => setSelectedFastOffer(offer)} />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="balance" className="pt-2 animate-in fade-in-0 duration-300">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#FECC4F]/10 space-y-6">
                                    <div className="w-full text-center">
                                        <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل المبلغ</Label>
                                        <div className="relative max-w-[240px] mx-auto">
                                            <Input 
                                                type="number" 
                                                placeholder="0.00" 
                                                value={amount} 
                                                onChange={(e) => setAmount(e.target.value)} 
                                                className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#E6B000] placeholder:text-[#FECC4F]/20 focus-visible:ring-[#FECC4F]" 
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FECC4F]/40 font-black text-sm">ر.ي</div>
                                        </div>
                                    </div>
                                    {amount && parseFloat(amount) >= 200 && (
                                        <div className="mt-4 animate-in fade-in-0 slide-in-from-top-2 text-center">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">الرصيد بعد الضريبة</p>
                                            <p className="text-xl font-black text-[#E6B000]">{(parseFloat(amount) * 0.828).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</p>
                                        </div>
                                    )}
                                    <Button 
                                        className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg bg-[#FECC4F] text-[#4A3B00] hover:bg-[#E6B000]" 
                                        onClick={() => {
                                            const val = parseFloat(amount);
                                            if (isNaN(val) || val < 200) { toast({ variant: 'destructive', title: 'خطأ في المبلغ', description: 'أقل مبلغ للسداد هو 200 ريال.' }); return; }
                                            setIsConfirmingBalance(true);
                                        }} 
                                        disabled={!amount}
                                    >
                                        تنفيذ السداد
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <Toaster />
            <audio ref={audioRef} src="/sdad.mp3" preload="auto" />

            <AlertDialog open={isConfirmingBalance} onOpenChange={setIsConfirmingBalance}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black text-[#4A3B00]">تأكيد سداد رصيد</AlertDialogTitle>
                        <div className="space-y-3 pt-4 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">رقم الهاتف:</span><span className="font-bold">{phone}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">نوع الخط:</span><span className="font-bold">{lineType === 'prepaid' ? 'دفع مسبق' : 'فوترة'}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">المبلغ:</span><span className="font-bold">{parseFloat(amount || '0').toLocaleString('en-US')} ريال</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">النسبة:</span><span className="font-bold">{(parseFloat(amount || '0') * 2).toLocaleString('en-US')} ريال</span></div>
                            <div className="flex justify-between items-center py-3 bg-[#FECC4F]/10 rounded-xl px-2 mt-2"><span className="font-black text-[#4A3B00]">إجمالي الخصم:</span><span className="font-black text-[#E6B000] text-lg">{(parseFloat(amount || '0') * 3).toLocaleString('en-US')} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold bg-[#FECC4F] text-[#4A3B00] hover:bg-[#E6B000]" onClick={() => handleProcessPayment(parseFloat(amount), 'رصيد')}>تأكيد</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!selectedFastOffer} onOpenChange={() => setSelectedFastOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader><AlertDialogTitle className="text-center font-black text-[#4A3B00]">تأكيد شحن فوري</AlertDialogTitle>
                        <div className="py-4 space-y-3 text-right text-sm">
                            <p className="text-center text-lg font-black text-[#E6B000] mb-2">{selectedFastOffer?.title}</p>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">رقم الهاتف:</span><span className="font-bold">{phone}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">نوع الخط:</span><span className="font-bold">{lineType === 'prepaid' ? 'دفع مسبق' : 'فوترة'}</span></div>
                            <div className="flex justify-between items-center py-3 bg-[#FECC4F]/10 rounded-xl px-2 mt-2"><span className="font-black text-[#4A3B00]">إجمالي الخصم:</span><span className="font-black text-[#E6B000] text-lg">{(selectedFastOffer?.price || 0).toLocaleString('en-US')} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction onClick={() => selectedFastOffer && handleProcessPayment(selectedFastOffer.price, selectedFastOffer.title, selectedFastOffer.num)} className="w-full rounded-2xl h-12 font-bold bg-[#FECC4F] text-[#4A3B00] hover:bg-[#E6B000]">تفعيل الآن</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">تراجع</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader><AlertDialogTitle className="text-center font-black text-[#4A3B00]">تأكيد تفعيل الباقة</AlertDialogTitle>
                        <div className="py-4 space-y-3 text-right text-sm">
                            <p className="text-center text-lg font-black text-[#E6B000] mb-2">{selectedOffer?.offerName}</p>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">رقم الهاتف:</span><span className="font-bold">{phone}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">نوع الخط:</span><span className="font-bold">{lineType === 'prepaid' ? 'دفع مسبق' : 'فوترة'}</span></div>
                            <div className="flex justify-between items-center py-3 bg-[#FECC4F]/10 rounded-xl px-2 mt-2"><span className="font-black text-[#4A3B00]">إجمالي الخصم:</span><span className="font-black text-[#E6B000] text-lg">{(selectedOffer?.price || 0).toLocaleString('en-US')} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction onClick={handleActivateOffer} className="w-full rounded-2xl h-12 font-bold bg-[#FECC4F] text-[#4A3B00] hover:bg-[#E6B000]" disabled={isActivatingOffer}>تفعيل الآن</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0" disabled={isActivatingOffer}>تراجع</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
