
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
  Users,
  Zap,
  Loader2
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
import Image from 'next/image';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Offer = {
    offerName: string;
    price: number;
    data: string;
    validity: string;
    packageid: string;
    num: string;
};

const WHY_PRIMARY = '#FE8B19';
const WHY_GRADIENT = {
    backgroundColor: '#FE8B19',
    backgroundImage: `
        radial-gradient(at 0% 0%, #FFA84D 0px, transparent 50%),
        radial-gradient(at 100% 100%, #D47100 0px, transparent 50%)
    `
};

const WHY_OFFERS: Offer[] = [
    { offerName: 'شحن باقة كرم 250', price: 250, data: '100MB', validity: '7 أيام', packageid: '91', num: '250' },
    { offerName: 'شحن باقة كرم 500', price: 500, data: '250MB', validity: '30 يوم', packageid: '92', num: '500' },
    { offerName: 'شحن باقة كرم 900', price: 900, data: '500MB', validity: '45 يوم', packageid: '93', num: '900' },
    { offerName: 'شحن باقة كرم 2000', price: 2000, data: '1GB', validity: '60 يوم', packageid: '94', num: '2000' },
];

export default function WhyPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState("packages");
    const [amount, setAmount] = useState('');
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
    const [isConfirmingBalance, setIsConfirmingBalance] = useState(false);
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
            if (!cleaned.startsWith('70') && !cleaned.startsWith('71')) {
                toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم شركة واي يجب أن يبدأ بـ 70 أو 71' });
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
                let num = contacts[0].tel[0].replace(/\D/g, '').slice(-9);
                setPhone(num);
            }
        } catch (err) { console.error(err); }
    };

    const handleProcessPayment = async (payAmount: number, typeLabel: string, payload: any) => {
        if (!phone || !user || !userDocRef || !firestore) return;
        
        const commission = typeLabel === 'رصيد' ? Math.ceil(payAmount * 0.05) : 0;
        const totalToDeduct = payAmount + commission;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك لا يكفي لإتمام هذه العملية.' });
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
                    service: 'why', 
                    transid: transid,
                    ...payload 
                })
            });
            const result = await response.json();
            
            if (!response.ok || (result.resultCode !== "0" && result.resultCode !== 0 && result.resultCode !== "-2" && result.resultCode !== -2)) {
                throw new Error(result.message || result.resultDesc || 'فشل عملية السداد من المصدر.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid,
                transactionDate: new Date().toISOString(),
                amount: totalToDeduct,
                transactionType: `سداد واي (${typeLabel})`,
                notes: `للرقم: ${phone}. ${typeLabel === 'رصيد' ? `مبلغ: ${payAmount} + عمولة: ${commission}` : ''}`,
                recipientPhoneNumber: phone,
                transid: transid
            });
            await batch.commit();
            
            setLastTxDetails({ type: `سداد واي ${typeLabel}`, phone: phone, amount: totalToDeduct, transid: transid });
            setShowSuccess(true);
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ", description: error.message });
        } finally {
            setIsProcessing(false);
            setIsConfirmingBalance(false);
            setSelectedOffer(null);
        }
    };

    if (showSuccess && lastTxDetails) {
        return (
            <div className="flex flex-col h-full bg-[#FFF9F0]">
                <audio ref={audioRef} src="/sdad.mp3" autoPlay />
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-10 flex justify-center"><CheckCircle className="h-16 w-16 text-white animate-bounce" /></div>
                        <CardContent className="p-8 space-y-6">
                            <div><h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2><p className="text-sm text-muted-foreground mt-1">تم تنفيذ طلب السداد بنجاح</p></div>
                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-[#FE8B19]/20">
                                <div className="flex justify-between items-center border-b border-muted pb-2"><span className="text-muted-foreground flex items-center gap-2"><HashIcon className="w-3.5 h-3.5" /> رقم العملية:</span><span className="font-mono font-black text-[#FE8B19]">{lastTxDetails.transid}</span></div>
                                <div className="flex justify-between items-center border-b border-muted pb-2"><span className="text-muted-foreground flex items-center gap-2"><PhoneIcon className="w-3.5 h-3.5" /> رقم الجوال:</span><span className="font-mono font-bold tracking-widest">{lastTxDetails.phone}</span></div>
                                <div className="flex justify-between items-center border-b border-muted pb-2"><span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المخصوم:</span><span className="font-black text-[#FE8B19]">{lastTxDetails.amount.toLocaleString('en-US')} ريال</span></div>
                                <div className="flex justify-between items-center pt-1"><span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span><span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span></div>
                            </div>
                            <Button className="w-full h-14 rounded-2xl font-bold text-lg text-white" style={{ backgroundColor: '#FE8B19' }} onClick={() => setShowSuccess(false)}>إغلاق</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isProcessing && <ProcessingOverlay />}
            <SimpleHeader title="خدمات واي (Way)" />
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                
                <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={WHY_GRADIENT}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="text-right">
                            <p className="text-xs font-bold opacity-80 mb-1">رصيدك المتوفر</p>
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
                            placeholder="70xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#FE8B19] pr-12 pl-12"
                        />
                        <button onClick={handleContactPick} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#FE8B19] hover:bg-[#FE8B19]/10 rounded-xl transition-colors"><Users className="h-5 w-5" /></button>
                    </div>
                </div>

                {phone.length === 9 && (phone.startsWith('70') || phone.startsWith('71')) && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" defaultValue="packages">
                            <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#FE8B19]/10">
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#FE8B19] data-[state=active]:text-white">باقات كرم</TabsTrigger>
                                <TabsTrigger value="balance" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#FE8B19] data-[state=active]:text-white">سداد رصيد</TabsTrigger>
                            </TabsList>

                            <TabsContent value="packages" className="pt-2 space-y-3">
                                {WHY_OFFERS.map((offer) => (
                                    <div key={offer.packageid} onClick={() => setSelectedOffer(offer)} className="bg-white dark:bg-slate-900 rounded-[24px] p-4 flex items-center justify-between border border-[#FE8B19]/10 cursor-pointer hover:bg-[#FE8B19]/5 active:scale-[0.98] transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-[#FE8B19]/10 rounded-xl"><Zap className="w-5 h-5 text-[#FE8B19]" /></div>
                                            <div className="text-right">
                                                <h4 className="font-black text-sm">{offer.offerName}</h4>
                                                <div className="flex gap-3 mt-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3"/> {offer.data}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/> {offer.validity}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left font-black text-[#FE8B19] text-base">{offer.price} ر.ي</div>
                                    </div>
                                ))}
                            </TabsContent>

                            <TabsContent value="balance" className="pt-2">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#FE8B19]/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل مبلغ الشحن</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#FE8B19]" />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FE8B19]/30 font-black text-sm">ر.ي</div>
                                    </div>
                                    <Button className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg text-white" onClick={() => setIsConfirmingBalance(true)} disabled={!amount} style={{ backgroundColor: '#FE8B19' }}>شحن رصيد</Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد تفعيل الباقة</AlertDialogTitle>
                        <div className="space-y-3 pt-4 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">اسم الباقة:</span><span className="font-bold">{selectedOffer?.offerName}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">المبلغ المخصوم:</span><span className="font-black text-[#FE8B19] text-lg">{selectedOffer?.price.toLocaleString()} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" style={{ backgroundColor: '#FE8B19' }} onClick={() => selectedOffer && handleProcessPayment(selectedOffer.price, 'تفعيل باقة', { num: selectedOffer.num, packageid: selectedOffer.packageid })}>تأكيد</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isConfirmingBalance} onOpenChange={setIsConfirmingBalance}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد شحن الرصيد</AlertDialogTitle>
                        <div className="space-y-3 pt-4 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">مبلغ الشحن:</span><span className="font-bold">{parseFloat(amount || '0').toLocaleString()} ريال</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">العمولة (5%):</span><span className="font-bold text-orange-600">{Math.ceil(parseFloat(amount || '0') * 0.05).toLocaleString()} ريال</span></div>
                            <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2 mt-2"><span className="font-black">إجمالي الخصم:</span><span className="font-black text-[#FE8B19] text-lg">{(parseFloat(amount || '0') + Math.ceil(parseFloat(amount || '0') * 0.05)).toLocaleString()} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" style={{ backgroundColor: '#FE8B19' }} onClick={() => handleProcessPayment(parseFloat(amount), 'رصيد', { israsid: '1' })}>تأكيد الشحن</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Toaster />
        </div>
    );
}
