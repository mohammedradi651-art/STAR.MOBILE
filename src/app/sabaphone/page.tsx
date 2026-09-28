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
  Star,
  Database
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/accordion";
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

const SABA_PRIMARY = '#0056b3';
const SABA_GRADIENT = {
    backgroundColor: '#0056b3',
    backgroundImage: `radial-gradient(at 0% 0%, #007bff 0px, transparent 50%), radial-gradient(at 100% 100%, #003366 0px, transparent 50%)`
};

const LOGO_URL = "https://i.postimg.cc/5NDY8cjk/unnamed.png";

const SABA_FAST_CREDIT = [
    { num: '1', value: '150', price: 188, title: 'شحن 150 ريال' },
    { num: '2', value: '400', price: 500, title: 'شحن 400 ريال' },
    { num: '3', value: '600', price: 750, title: 'شحن 600 ريال' },
    { num: '4', value: '830', price: 1038, title: 'شحن 830 ريال' },
    { num: '5', value: '1250', price: 1563, title: 'شحن 1250 ريال' },
    { num: '6', value: '2500', price: 3125, title: 'شحن 2500 ريال' },
    { num: '7', value: '5000', price: 6250, title: 'شحن 5000 ريال' },
    { num: '8', value: '10000', price: 12500, title: 'شحن 10000 ريال' },
];

const SBAY_OFFERS = [
    { num: '1506', value: '125', price: 8, title: 'SBAY 8 ر.ي' },
    { num: '2518', value: '209', price: 9, title: 'SBAY 9 ر.ي' },
    { num: '3615', value: '300', price: 10, title: 'SBAY 10 ر.ي' },
];

const PREPAID_OFFERS = [
    {
        title: "باقات يابلاش",
        offers: [
            { num: '68', offerName: 'يابالش اليومية', price: 482, data: '100MB', validity: '24 ساعة' },
            { num: '69', offerName: 'يابالش الاسبوعية', price: 482, data: '300MB', validity: '7 أيام' },
            { num: '70', offerName: 'يابالش الشهرية', price: 1205, data: '1GB', validity: '30 يوم' },
            { num: '72', offerName: 'يابالش سوبر بلس', price: 3615, data: '3GB', validity: '30 يوم' },
        ]
    },
    {
        title: "باقات النت",
        offers: [
            { num: '81', offerName: 'سوبرنت اليومية', price: 482, data: '200MB', validity: 'يوم' },
            { num: '82', offerName: 'سوبرنت 250MB', price: 1205, data: '250MB', validity: '30 يوم' },
            { num: '83', offerName: 'سوبرنت 500MB', price: 1808, data: '500MB', validity: '30 يوم' },
            { num: '84', offerName: 'سوبرنت 1GB', price: 3013, data: '1GB', validity: '30 يوم' },
        ]
    }
];

const POSTPAID_OFFERS = [
    {
        title: "باقات فوترة",
        offers: [
            { num: '88', offerName: 'يابالش الشهرية فوترة', price: 1205, data: '1GB', validity: 'شهر' },
            { num: '91', offerName: 'يابالش سوبر بلس فوترة', price: 3615, data: '4GB', validity: 'شهر' },
            { num: '98', offerName: 'سوبرنت فوترة اليومية', price: 482, data: '250MB', validity: 'يوم' },
        ]
    }
];

export default function SabaphonePage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState("packages");
    const [lineType, setLineType] = useState('prepaid');
    const [units, setUnits] = useState('');
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile } = useDoc<any>(userDocRef);

    const handlePhoneChange = (val: string, element: HTMLInputElement) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 9);
        setPhone(cleaned);
        if (cleaned.length === 9) {
            element.blur();
            if (!cleaned.startsWith('71') && !cleaned.startsWith('70')) {
                toast({ variant: 'destructive', title: 'تنبيه', description: 'رقم سبأفون يجب أن يبدأ بـ 71 أو 70' });
            }
        }
    };

    const handleProcessAction = async (payAmount: number, typeLabel: string, endpoint: string, numCode: string) => {
        if (!phone || !user || !userDocRef || !firestore) return;

        if ((userProfile?.balance ?? 0) < payAmount) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام العملية.' });
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
                    service: endpoint, 
                    num: numCode,
                    transid: transid 
                })
            });
            const result = await response.json();
            
            if (!response.ok || (result.resultCode !== "0" && result.resultCode !== 0)) {
                throw new Error(result.message || 'فشل تنفيذ العملية من المصدر.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-payAmount) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid,
                transactionDate: new Date().toISOString(),
                amount: payAmount,
                transactionType: `سداد سبأفون (${typeLabel})`,
                notes: `رقم الهاتف: ${phone}`,
                recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({ type: typeLabel, phone, amount: payAmount, transid });
            setShowSuccess(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ", description: error.message });
        } finally {
            setIsProcessing(false);
            setSelectedOffer(null);
        }
    };

    const currentOffers = lineType === 'prepaid' ? PREPAID_OFFERS : POSTPAID_OFFERS;

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
                            <h2 className="text-2xl font-black text-green-600">تمت العملية بنجاح</h2>
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
                            <Button className="w-full h-14 rounded-2xl font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
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

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-primary/5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2 px-1">رقم الجوال</Label>
                    <div className="relative">
                        <Input
                            type="tel"
                            placeholder="71xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-primary pr-12 pl-12"
                        />
                        <button onClick={() => {}} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"><Users className="h-5 w-5" /></button>
                    </div>
                </div>

                {phone.length === 9 && (phone.startsWith('71') || phone.startsWith('70')) && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-primary/5">
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-[10px]">باقات</TabsTrigger>
                                <TabsTrigger value="credit" className="rounded-xl font-bold text-[10px]">رصيد</TabsTrigger>
                                <TabsTrigger value="south" className="rounded-xl font-bold text-[10px]">جنوب</TabsTrigger>
                                <TabsTrigger value="units" className="rounded-xl font-bold text-[10px]">وحدات</TabsTrigger>
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
                                <div className="space-y-3">
                                    {currentOffers.map((cat, i) => (
                                        <div key={i} className="space-y-2">
                                            <h3 className="text-xs font-black text-muted-foreground uppercase mr-2">{cat.title}</h3>
                                            {cat.offers.map((o) => (
                                                <PackageItemCard key={o.num} offer={o} onClick={() => setSelectedOffer(o)} />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="credit" className="pt-2">
                                <div className="grid grid-cols-1 gap-2">
                                    {SABA_FAST_CREDIT.map((opt) => (
                                        <div key={opt.num} onClick={() => setSelectedOffer({ offerName: opt.title, price: opt.price, num: opt.num })} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm flex justify-between items-center cursor-pointer hover:bg-primary/5 active:scale-95 transition-all">
                                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">{opt.num}</div><span className="font-bold">{opt.title}</span></div>
                                            <span className="font-black text-primary">{opt.price} ر.ي</span>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="south" className="pt-2">
                                <div className="grid grid-cols-1 gap-2">
                                    {SBAY_OFFERS.map((opt) => (
                                        <div key={opt.num} onClick={() => handleProcessAction(opt.price, opt.title, 'sbay', opt.num)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm flex justify-between items-center cursor-pointer hover:bg-primary/5 active:scale-95 transition-all border border-green-500/10">
                                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 font-black"><Zap className="w-5 h-5"/></div><span className="font-bold">{opt.title}</span></div>
                                            <span className="font-black text-green-600">{opt.price} ر.ي</span>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="units" className="pt-2">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-primary/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل عدد الوحدات</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input type="number" placeholder="0" value={units} onChange={(e) => setUnits(e.target.value)} className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-primary" />
                                    </div>
                                    <Button className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg" onClick={() => handleProcessAction(parseInt(units), 'وحدات يدوية', 'sabaunits', units)} disabled={!units}>شحن الآن</Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <Toaster />
            <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد عملية السداد</AlertDialogTitle>
                        <div className="py-4 space-y-3 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">الخدمة:</span><span className="font-bold">{selectedOffer?.offerName}</span></div>
                            <div className="flex justify-between items-center py-3 bg-primary/5 rounded-xl px-2 mt-2"><span className="font-black">المبلغ المخصوم:</span><span className="font-black text-primary text-lg">{selectedOffer?.price.toLocaleString()} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4">
                        <AlertDialogAction onClick={() => selectedOffer && handleProcessAction(selectedOffer.price, selectedOffer.offerName, activeTab === 'packages' ? 'sabaoffer' : 'sabaphone', selectedOffer.num)} className="w-full rounded-2xl h-12 font-bold">تأكيد</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

const PackageItemCard = ({ offer, onClick }: { offer: any, onClick: () => void }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-primary/5 mb-2 cursor-pointer hover:bg-primary/5 transition-all flex items-center justify-between group" onClick={onClick}>
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Database className="w-5 h-5"/></div>
            <div className="text-right">
                <p className="text-xs font-black group-hover:text-primary transition-colors">{offer.offerName}</p>
                <p className="text-[9px] font-bold text-muted-foreground">{offer.validity} - {offer.data}</p>
            </div>
        </div>
        <span className="text-sm font-black text-primary">{offer.price} ر.ي</span>
    </div>
);
