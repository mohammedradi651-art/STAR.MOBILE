'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  CheckCircle, 
  Search,
  Hash as HashIcon,
  Calendar,
  History,
  Globe,
  ArrowUpRight,
  Phone as PhoneIcon,
  Loader2,
  Database,
  Tag,
  Users,
  Clock,
  Info,
  Smartphone
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
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

const INTERNET_THEME = {
    primary: '#302C81',
    gradient: {
        backgroundColor: '#302C81',
        backgroundImage: `radial-gradient(at 0% 0%, #403AAB 0px, transparent 50%), radial-gradient(at 100% 100%, #221E5C 0px, transparent 50%)`
    }
};

const LANDLINE_THEME = {
    primary: '#F18312',
    gradient: {
        backgroundColor: '#F18312',
        backgroundImage: `radial-gradient(at 0% 0%, #FF9E3D 0px, transparent 50%), radial-gradient(at 100% 100%, #C76A00 0px, transparent 50%)`
    }
};

const INTERNET_PACKAGES = [
    {
        title: "1 ميجا",
        items: [
            { name: "10GB", price: 1575 },
            { name: "24GB", price: 3150 },
            { name: "100GB", price: 10500 },
        ]
    },
    {
        title: "2 ميجا",
        items: [
            { name: "24GB", price: 2520 },
            { name: "50GB", price: 4725 },
            { name: "188GB", price: 15750 },
        ]
    },
    {
        title: "4 ميجا",
        items: [
            { name: "66GB", price: 6930 },
            { name: "280GB", price: 26250 },
            { name: "480GB", price: 39900 },
        ]
    },
    {
        title: "8 ميجا",
        items: [
            { name: "120GB", price: 12600 },
            { name: "420GB", price: 39375 },
            { name: "720GB", price: 59850 },
        ]
    }
];

export default function LandlinePage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState("internet");
    const [isSearching, setIsSearching] = useState(false);
    const [queryResult, setQueryResult] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const currentTheme = activeTab === 'internet' ? INTERNET_THEME : LANDLINE_THEME;

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
        const cleaned = val.replace(/\D/g, '').slice(0, 8);
        setPhone(cleaned);
        if (cleaned.length === 8) {
            element.blur();
            if (!cleaned.startsWith('0')) {
                toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'الرقم الأرضي يجب أن يبدأ بـ 0' });
            } else {
                handleSearch(cleaned);
            }
        }
    };

    const handleSearch = useCallback(async (phoneNumber: string = phone) => {
        if (!phoneNumber || phoneNumber.length < 7) {
            toast({ variant: 'destructive', title: 'رقم ناقص', description: 'يرجى إدخال رقم صحيح مكون من 8 أرقام.' });
            return;
        }
        
        setIsSearching(true);
        setQueryResult(null);
        try {
            const transid = Date.now().toString().slice(-8);
            const serviceType = activeTab === 'internet' ? 'adsl' : 'line';
            
            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    mobile: phoneNumber, 
                    action: 'query', 
                    service: 'post', 
                    type: serviceType, 
                    transid 
                })
            });
            const result = await response.json();
            
            const isSuccess = result.resultCode === "0" || result.resultCode === 0;

            if (isSuccess || result.resultCode === "-2") {
                let desc = "";
                const rawDesc = String(result.resultDesc || "");
                const rawBalance = String(result.balance || "");
                
                const importantKeywords = ['باقة', 'رصيد', 'تأريخ', 'مبلغ', 'فاتورة', 'مديونية', 'سداد'];
                const hasInfo = (text: string) => importantKeywords.some(kw => text.includes(kw));

                if (rawBalance && hasInfo(rawBalance)) {
                    desc = rawBalance;
                } else if (rawDesc && hasInfo(rawDesc)) {
                    desc = rawDesc;
                } else {
                    desc = (rawDesc.toLowerCase() === 'success' || !rawDesc) ? rawBalance : rawDesc;
                }

                if (!desc || desc.toLowerCase() === 'success') {
                    desc = "تم الاستعلام بنجاح.";
                }

                setQueryResult(desc);

                if (result.balance && !isNaN(parseFloat(result.balance))) {
                    setAmount(String(result.balance));
                }
            } else {
                throw new Error(result.resultDesc || 'الرقم غير مسجل أو هناك خطأ في الاستعلام.');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'تنبيه من المزود', description: error.message });
        } finally {
            setIsSearching(false);
        }
    }, [phone, activeTab, toast]);

    const handleContactPick = async () => {
        if (!('contacts' in navigator && 'ContactsManager' in window)) {
            toast({
                variant: "destructive",
                title: "غير مدعوم",
                description: "متصفحك لا يدعم الوصول لجهات الاتصال."
            });
            return;
        }
        try {
            const props = ['tel'];
            const opts = { multiple: false };
            const contacts = await (navigator as any).contacts.select(props, opts);
            if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
                let num = contacts[0].tel[0].replace(/\D/g, '').slice(-8);
                if (!num.startsWith('0')) num = '0' + num;
                setPhone(num);
                if (num.length === 8) handleSearch(num);
            }
        } catch (err) { console.error(err); }
    };

    const handlePayment = async () => {
        if (!phone || !amount || !user || !userDocRef || !firestore) return;
        const baseAmount = parseFloat(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) return;
        const commission = Math.ceil(baseAmount * 0.05);
        const totalToDeduct = baseAmount + commission;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام هذه العملية.' });
            return;
        }

        setIsProcessing(true);
        try {
            const transid = Date.now().toString().slice(-8);
            const serviceType = activeTab === 'internet' ? 'adsl' : 'line';
            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile: phone, amount: baseAmount, action: 'bill', service: 'post', type: serviceType, transid: transid })
            });
            const result = await response.json();
            if (!response.ok || (result.resultCode !== "0" && result.resultCode !== 0)) throw new Error(result.message || 'فشل السداد.');

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid, transactionDate: new Date().toISOString(), amount: totalToDeduct,
                transactionType: `سداد ${activeTab === 'internet' ? 'ADSL' : 'هاتف ثابت'}`,
                notes: `رقم: ${phone}`, recipientPhoneNumber: phone, transid: transid
            });
            await batch.commit();
            setLastTxDetails({ type: `سداد ${activeTab === 'internet' ? 'الإنترنت' : 'الثابت'}`, phone, amount: totalToDeduct, transid });
            setShowSuccess(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ", description: error.message });
        } finally {
            setIsProcessing(false);
            setIsConfirmingPayment(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isSearching && <ProcessingOverlay />}
            {isProcessing && <ProcessingOverlay />}

            <SimpleHeader title="الثابت والإنترنت الأرضي" />
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                
                <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={currentTheme.gradient}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="text-right">
                            <p className="text-xs font-bold opacity-80 mb-1">الرصيد المتوفر</p>
                            <h2 className="text-2xl font-black text-white">{userProfile?.balance?.toLocaleString('en-US') || '0'} <span className="text-[10px] opacity-70">ريال</span></h2>
                        </div>
                        <div className="p-3 bg-white/20 rounded-2xl"><Smartphone className="h-6 w-6 text-white" /></div>
                    </CardContent>
                </Card>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-primary/5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2 px-1">رقم الهاتف</Label>
                    <div className="relative">
                        <Input
                            type="tel"
                            placeholder="0xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-primary transition-all pr-12 pl-12"
                        />
                        <button onClick={handleContactPick} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors" style={{ color: currentTheme.primary }}><Users className="h-5 w-5" /></button>
                    </div>

                    {phone.length >= 7 && phone.startsWith('0') && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <Button 
                                className="w-full h-12 rounded-2xl font-bold mt-4 shadow-sm text-white" 
                                onClick={() => handleSearch()}
                                disabled={isSearching}
                                style={{ backgroundColor: currentTheme.primary }}
                            >
                                {isSearching ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Search className="ml-2 h-4 w-4" />}
                                استعلام
                            </Button>
                        </div>
                    )}
                </div>

                {phone.length >= 7 && phone.startsWith('0') && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        
                        {queryResult && (
                            <div className="rounded-3xl overflow-hidden shadow-lg p-1 animate-in zoom-in-95" style={currentTheme.gradient}>
                                <div className="bg-white/10 backdrop-blur-md rounded-[22px] p-5 text-right text-white space-y-2">
                                    <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">
                                        {queryResult}
                                    </p>
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue="internet" value={activeTab} onValueChange={(val) => { setActiveTab(val); setQueryResult(null); setAmount(''); }} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-primary/5">
                                <TabsTrigger value="internet" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#302C81] data-[state=active]:text-white">الإنترنت الأرضي</TabsTrigger>
                                <TabsTrigger value="landline" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#F18312] data-[state=active]:text-white">الهاتف الثابت</TabsTrigger>
                            </TabsList>

                            <TabsContent value="internet" className="pt-2 space-y-4">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#302C81]/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل المبلغ</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#302C81]" />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#302C81]/30 font-black text-sm">ر.ي</div>
                                    </div>
                                    <Button className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg text-white" onClick={() => setIsConfirmingPayment(true)} disabled={!amount} style={{ backgroundColor: '#302C81' }}>تسديد الآن</Button>
                                </div>

                                <div className="mt-8 space-y-6 pb-10">
                                    <Accordion type="single" collapsible className="w-full space-y-4">
                                        {INTERNET_PACKAGES.map((category, idx) => (
                                            <AccordionItem key={idx} value={`item-${idx}`} className="border-none">
                                                <AccordionTrigger className="px-5 py-5 rounded-[24px] hover:no-underline shadow-md text-white" style={INTERNET_THEME.gradient}>
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="h-10 w-10 relative overflow-hidden rounded-2xl border border-white/20"><Image src="https://i.postimg.cc/ZRHzd8jN/FB-IMG-1768999572493.jpg" alt="ADSL" fill className="object-cover"/></div>
                                                        <div className="flex flex-col items-start"><span className="text-[10px] font-bold text-white/70 uppercase">باقات</span><span className="text-sm font-black text-white">{category.title}</span></div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="bg-white dark:bg-slate-900/50 border-x border-b border-[#302C81]/10 rounded-b-[24px] p-3 space-y-2.5 animate-in slide-in-from-top-2">
                                                    {category.items.map((pkg, pIdx) => (
                                                        <div key={pIdx} onClick={() => { setAmount(String(pkg.price)); setIsConfirmingPayment(true); }} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm hover:bg-[#302C81]/5 transition-all cursor-pointer border border-[#302C81]/5">
                                                            <div className="flex items-center gap-4"><Globe className="w-4 h-4 text-[#302C81]" /><span className="text-sm font-black">{pkg.name}</span></div>
                                                            <div className="flex items-center gap-3"><p className="text-lg font-black text-[#302C81]">{pkg.price.toLocaleString()}</p><ArrowUpRight className="w-4 h-4 opacity-30" /></div>
                                                        </div>
                                                    ))}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            </TabsContent>

                            <TabsContent value="landline" className="pt-2 animate-in fade-in-0 duration-300 space-y-4">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#F18312]/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل مبلغ سداد الفاتورة</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#F18312]" />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F18312]/30 font-black text-sm">ر.ي</div>
                                    </div>
                                    <Button className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg text-white" onClick={() => setIsConfirmingPayment(true)} disabled={!amount} style={{ backgroundColor: '#F18312' }}>تسديد الآن</Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <Toaster />

            <AlertDialog open={isConfirmingPayment} onOpenChange={setIsConfirmingPayment}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد عملية السداد</AlertDialogTitle>
                        <div className="space-y-3 pt-4 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">رقم الهاتف:</span><span className="font-bold">{phone}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">المبلغ:</span><span className="font-bold">{parseFloat(amount || '0').toLocaleString('en-US')} ريال</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">العمولة الإدارية (5%):</span><span className="font-bold text-orange-600">{Math.ceil(parseFloat(amount || '0') * 0.05).toLocaleString('en-US')} ريال</span></div>
                            <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2 mt-2"><span className="font-black">إجمالي الخصم النهائي:</span><span className="font-black text-lg" style={{ color: currentTheme.primary }}>{(parseFloat(amount || '0') + Math.ceil(parseFloat(amount || '0') * 0.05)).toLocaleString('en-US')} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" style={{ backgroundColor: currentTheme.primary }} onClick={handlePayment}>تأكيد</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {showSuccess && lastTxDetails && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in-0">
                    <audio ref={audioRef} src="/sdad.mp3" autoPlay />
                    <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-8 flex justify-center"><CheckCircle className="h-16 w-16 text-white animate-bounce" /></div>
                        <CardContent className="p-8 space-y-6">
                            <div><h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2><p className="text-sm text-muted-foreground mt-1">تم تنفيذ طلب السداد بنجاح</p></div>
                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                                <div className="flex justify-between items-center border-b border-muted pb-2"><span className="text-muted-foreground flex items-center gap-2"><HashIcon className="w-3.5 h-3.5" /> رقم العملية:</span><span className="font-mono font-black" style={{ color: currentTheme.primary }}>{lastTxDetails.transid}</span></div>
                                <div className="flex justify-between items-center border-b border-muted pb-2"><span className="text-muted-foreground flex items-center gap-2"><PhoneIcon className="w-3.5 h-3.5" /> رقم الهاتف:</span><span className="font-mono font-bold">{lastTxDetails.phone}</span></div>
                                <div className="flex justify-between items-center border-b border-muted pb-2"><span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المخصوم:</span><span className="font-black" style={{ color: currentTheme.primary }}>{lastTxDetails.amount.toLocaleString()} ريال</span></div>
                                <div className="flex justify-between items-center pt-1"><span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span><span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span></div>
                            </div>
                            <Button className="w-full h-14 rounded-2xl font-bold text-lg text-white" style={{ backgroundColor: currentTheme.primary }} onClick={() => { setShowSuccess(false); handleSearch(); }}>إغلاق</Button>
                        </CardContent>
                    </Card>
                </div>
            )}
            <Toaster />
        </div>
    );
}
