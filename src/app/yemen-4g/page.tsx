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
  Search,
  Hash,
  Calendar,
  History,
  Globe,
  Clock,
  Phone,
  Loader2,
  Users
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type UserProfile = {
  balance?: number;
};

type QueryResult = {
    balance?: string;
    packagePrice?: string;
    expireDate?: string;
    message?: string;
};

type Offer = {
    offerId: string;
    offerName: string;
    price: number;
    data: string;
    validity: string;
    offertype: string; 
};

const YEMEN_4G_PRIMARY = '#106BA2';
const YEMEN_4G_GRADIENT = {
    backgroundColor: '#106BA2',
    backgroundImage: `
        radial-gradient(at 0% 0%, #1A85C4 0px, transparent 50%),
        radial-gradient(at 100% 100%, #0D5480 0px, transparent 50%)
    `
};

const YEMEN_4G_OFFERS: Offer[] = [
    { offerId: '4g_15gb', offerName: 'يمن فورجي 15 جيجا', price: 2400, data: '15 GB', validity: 'يوم 30', offertype: '4G_15GB' },
    { offerId: '4g_25gb', offerName: 'يمن فورجي 25 جيجا', price: 4000, data: '25 GB', validity: 'يوم 30', offertype: '4G_25GB' },
    { offerId: '4g_60gb', offerName: 'يمن فورجي 60 جيجا', price: 8000, data: '60 GB', validity: 'يوم 30', offertype: '4G_60GB' },
    { offerId: '4g_130gb', offerName: 'يمن فورجي 130 جيجا', price: 16000, data: '130 GB', validity: 'يوم 30', offertype: '4G_130GB' },
    { offerId: '4g_250gb', offerName: 'يمن فورجي 250 جيجا', price: 26000, data: '250 GB', validity: 'يوم 30', offertype: '4G_250GB' },
    { offerId: '4g_500gb', offerName: 'يمن فورجي 500 جيجا', price: 46000, data: '500 GB', validity: 'يوم 30', offertype: '4G_500GB' },
];

const PackageCard = ({ offer, onClick }: { offer: Offer, onClick: () => void }) => (
    <div 
      className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#106BA2]/10 mb-3 cursor-pointer hover:bg-[#106BA2]/5 transition-all active:scale-[0.98] group flex items-center justify-between"
      onClick={onClick}
    >
      <div className="flex items-center gap-4 text-right">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#106BA2]/10 bg-white shrink-0">
              <Image 
                  src="https://i.postimg.cc/FsmGqt98/1768999789252.jpg" 
                  alt="Yemen 4G" 
                  fill 
                  className="object-cover"
              />
          </div>
          <div className="flex flex-col items-start">
              <h4 className="text-sm font-black text-foreground group-hover:text-[#106BA2] transition-colors">{offer.offerName}</h4>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3 text-[#106BA2]"/> {offer.data}</span>
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3 text-[#106BA2]"/> {offer.validity}</span>
              </div>
          </div>
      </div>

      <div className="flex flex-col items-end text-left shrink-0">
        <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-[#106BA2]">{offer.price.toLocaleString('en-US')}</span>
        </div>
        <Button size="sm" className="h-7 rounded-lg text-[10px] font-black px-4 mt-1 bg-[#106BA2] hover:bg-[#106BA2]/90">سداد</Button>
      </div>
    </div>
);

export default function Yemen4GPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState("packages");
    const [isSearching, setIsSearching] = useState(false);
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [amount, setAmount] = useState('');
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
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

    useEffect(() => {
        if (showSuccess && audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        }
    }, [showSuccess]);

    const handlePhoneChange = (val: string) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 9);
        setPhone(cleaned);
        if (cleaned.length === 9) {
            if (!cleaned.startsWith('10')) {
                toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن فورجي يجب أن يبدأ بـ 10' });
            } else {
                handleSearch(cleaned);
            }
        }
    };

    const handleSearch = async (phoneNumber: string = phone) => {
        if (!phoneNumber || phoneNumber.length !== 9) return;
        
        if (!phoneNumber.startsWith('10')) {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن فورجي يجب أن يبدأ بـ 10' });
            return;
        }

        setIsSearching(true);
        setQueryResult(null);
        try {
            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile: phoneNumber, action: 'query', service: 'yem4g' })
            });
            const result = await response.json();
            
            const isSuccess = result.resultCode === "0" || result.resultCode === 0;
            const isPending = result.resultCode === "-2" || result.resultCode === -2;

            if (!isSuccess && !isPending) {
                throw new Error(result.resultDesc || result.message || 'فشل الاستعلام من المصدر.');
            }
            
            const raw = result.balance || '';
            let balance = '...';
            let price = '...';
            let expiry = '...';

            const balMatch = raw.match(/(الرصيد المتبقي|رصيد الباقة):\s*([\d.]+)/i);
            if (balMatch) {
                const unitMatch = raw.match(/(KB|GB|MB)/i);
                const unit = unitMatch ? unitMatch[0].toUpperCase() : 'GB';
                balance = `${balMatch[2]} ${unit}`;
            }

            const priceMatch = raw.match(/قيمة الباقة:\s*([\d.]+)/i);
            if (priceMatch) price = priceMatch[1];

            const dateMatch = raw.match(/تأريخ الانتهاء:\s*(\d{4})[-]?(\d{2})[-]?(\d{2})/i);
            if (dateMatch) {
                expiry = `${parseInt(dateMatch[3])}/${parseInt(dateMatch[2])}/${dateMatch[1]}`;
            } else if (result.expireDate) {
                expiry = result.expireDate;
            }
            
            if (balance === '...' && price === '...' && result.resultDesc) {
                throw new Error(result.resultDesc);
            }

            setQueryResult({ balance, packagePrice: price, expireDate: expiry, message: result.resultDesc });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'تنبيه من المزود', description: error.message });
        } finally {
            setIsSearching(false);
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
                if (selectedNumber.startsWith('010')) selectedNumber = selectedNumber.substring(1);
                
                const cleanedNum = selectedNumber.slice(0, 9);
                setPhone(cleanedNum);
                if (cleanedNum.length === 9) handleSearch(cleanedNum);
            }
        } catch (err) {
            console.error("Contacts selection failed:", err);
        }
    };

    const handlePayment = async () => {
        if (!phone || !amount || !user || !userDocRef || !firestore) return;
        
        if (!phone.startsWith('10')) {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن فورجي يجب أن يبدأ بـ 10' });
            return;
        }

        const baseAmount = parseFloat(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) return;

        const commission = Math.ceil(baseAmount * 0.05);
        const totalToDeduct = baseAmount + commission;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام هذه العملية شاملة العمولة.' });
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
                    amount: baseAmount, 
                    action: 'bill',
                    service: 'yem4g',
                    type: '2', 
                    transid: transid,
                })
            });
            const result = await response.json();
            
            const isSuccess = result.resultCode === "0" || result.resultCode === 0;
            const isPending = result.resultCode === "-2" || result.resultCode === -2;

            if (!response.ok || (!isSuccess && !isPending)) {
                throw new Error(result.resultDesc || result.message || 'فشل عملية السداد من المصدر.');
            }
            
            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid,
                transactionDate: new Date().toISOString(),
                amount: totalToDeduct,
                transactionType: 'سداد يمن فورجي',
                notes: `إلى رقم: ${phone}. مبلغ: ${baseAmount} + عمولة: ${commission}.`,
                recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({ type: 'سداد رصيد يمن فورجي', phone: phone, amount: totalToDeduct, transid: transid });
            setShowSuccess(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "فشل السداد", description: error.message });
        } finally {
            setIsProcessing(false);
            setIsConfirming(false);
        }
    };

    const handleActivateOffer = async () => {
        if (!selectedOffer || !phone || !user || !userDocRef || !firestore) return;
        
        if (!phone.startsWith('10')) {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن فورجي يجب أن يبدأ بـ 10' });
            return;
        }

        const basePrice = selectedOffer.price;
        const commission = Math.ceil(basePrice * 0.05);
        const totalToDeduct = basePrice + commission;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لتفعيل هذه الباقة شاملة العمولة.' });
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
                    action: 'bill', 
                    service: 'yem4g', 
                    amount: basePrice,
                    type: '1',
                    transid 
                })
            });
            const result = await response.json();
            
            const isSuccess = result.resultCode === "0" || result.resultCode === 0;
            const isPending = result.resultCode === "-2" || result.resultCode === -2;

            if (!response.ok || (!isSuccess && !isPending)) {
                throw new Error(result.resultDesc || result.message || 'فشل تفعيل الباقة من المصدر.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid, transactionDate: new Date().toISOString(), amount: totalToDeduct,
                transactionType: `تفعيل ${selectedOffer.offerName}`, notes: `للرقم: ${phone}. سعر: ${basePrice} + عمولة: ${commission}.`, recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({ type: `تفعيل ${selectedOffer.offerName}`, phone: phone, amount: totalToDeduct, transid: transid });
            setShowSuccess(true);
            setSelectedOffer(null);
            handleSearch();
        } catch (e: any) {
            toast({ variant: "destructive", title: "خطأ", description: e.message });
        } finally {
            setIsActivatingOffer(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isSearching && <ProcessingOverlay />}
            {isActivatingOffer && <ProcessingOverlay />}
            {isProcessing && <ProcessingOverlay />}

            <SimpleHeader title="يمن فورجي" />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={YEMEN_4G_GRADIENT}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="text-right">
                            <p className="text-xs font-bold opacity-80 mb-1">الرصيد المتوفر</p>
                            <div className="flex items-baseline gap-1">
                                <h2 className="text-2xl font-black text-white">{userProfile?.balance?.toLocaleString('en-US') || '0'}</h2>
                                <span className="text-[10px] font-bold opacity-70 text-white mr-1">ريال يمني</span>
                            </div>
                        </div>
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <Wallet className="h-6 w-6 text-white" />
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#106BA2]/5">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رقم الهاتف</Label>
                    </div>
                    <div className="relative">
                        <Input
                            type="tel"
                            placeholder="10xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#106BA2] transition-all pr-12 pl-12"
                        />
                        <button 
                            onClick={handleContactPick}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#106BA2] hover:bg-[#106BA2]/10 rounded-xl transition-colors"
                            title="جهات الاتصال"
                        >
                            <Users className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {phone.length === 9 && phone.startsWith('10') && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        {queryResult && (
                            <div className="rounded-3xl overflow-hidden shadow-lg p-1 animate-in zoom-in-95" style={YEMEN_4G_GRADIENT}>
                                <div className="bg-white/10 backdrop-blur-md rounded-[22px] grid grid-cols-3 text-center text-white">
                                    <div className="p-3 border-l border-white/10">
                                        <p className="text-[10px] font-bold opacity-80 mb-1">الرصيد المتبقي</p>
                                        <p className="text-sm font-black">{queryResult.balance}</p>
                                    </div>
                                    <div className="p-3 border-l border-white/10">
                                        <p className="text-[10px] font-bold opacity-80 mb-1">قيمة الباقة</p>
                                        <p className="text-sm font-black">{queryResult.packagePrice} ر.ي</p>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-[10px] font-bold opacity-80 mb-1">تاريخ الانتهاء</p>
                                        <p className="text-sm font-black">{queryResult.expireDate}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Tabs defaultValue="packages" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#106BA2]/5">
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#106BA2] data-[state=active]:text-white">الباقات</TabsTrigger>
                                <TabsTrigger value="balance" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#106BA2] data-[state=active]:text-white">سداد رصيد</TabsTrigger>
                            </TabsList>

                            <TabsContent value="packages" className="pt-2 animate-in fade-in-0 duration-300">
                                <div className="grid grid-cols-1 gap-1">
                                    {YEMEN_4G_OFFERS.map((offer) => (
                                        <PackageCard 
                                            key={offer.offerId} 
                                            offer={offer} 
                                            onClick={() => setSelectedOffer(offer)} 
                                        />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="balance" className="pt-2 animate-in fade-in-0 duration-300">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#106BA2]/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل المبلغ</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input 
                                            type="number" 
                                            placeholder="0.00" 
                                            value={amount} 
                                            onChange={(e) => setAmount(e.target.value)} 
                                            className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#106BA2] placeholder:text-[#106BA2]/10 focus-visible:ring-[#106BA2]" 
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#106BA2]/30 font-black text-sm">ر.ي</div>
                                    </div>
                                    <Button 
                                        className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg shadow-[#106BA2]/20 text-white" 
                                        onClick={() => setIsConfirming(true)} 
                                        disabled={!amount}
                                        style={{ backgroundColor: '#106BA2' }}
                                    >
                                        تسديد الآن
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <Toaster />

            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد سداد رصيد</AlertDialogTitle>
                        <div className="space-y-3 pt-4 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">رقم الهاتف:</span>
                                <span className="font-bold">{phone}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">المبلغ:</span>
                                <span className="font-bold">{parseFloat(amount || '0').toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">النسبة (5%):</span>
                                <span className="font-bold text-orange-600">{Math.ceil(parseFloat(amount || '0') * 0.05).toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2 mt-2">
                                <span className="font-black">إجمالي المطلوب:</span>
                                <span className="font-black text-[#106BA2] text-lg">{(parseFloat(amount || '0') + Math.ceil(parseFloat(amount || '0') * 0.05)).toLocaleString('en-US')} ريال</span>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" onClick={handlePayment} style={{ backgroundColor: YEMEN_4G_PRIMARY }}>تأكيد السداد</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد تفعيل الباقة</AlertDialogTitle>
                        <div className="py-4 space-y-3 text-right text-sm">
                            <p className="text-center text-lg font-black text-[#106BA2] mb-2">{selectedOffer?.offerName}</p>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">سعر الباقة:</span>
                                <span className="font-bold">{(selectedOffer?.price || 0).toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">النسبة (5%):</span>
                                <span className="font-bold text-orange-600">{Math.ceil((selectedOffer?.price || 0) * 0.05).toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2 mt-2">
                                <span className="font-black">إجمالي الخصم:</span>
                                <span className="font-black text-[#106BA2] text-lg">{((selectedOffer?.price || 0) + Math.ceil((selectedOffer?.price || 0) * 0.05)).toLocaleString('en-US')} ريال</span>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction onClick={handleActivateOffer} className="w-full rounded-2xl h-12 font-bold text-white" disabled={isActivatingOffer} style={{ backgroundColor: YEMEN_4G_PRIMARY }}>
                            تفعيل الآن
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0" disabled={isActivatingOffer}>تراجع</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
