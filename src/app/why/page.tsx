
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
  Calendar
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
    sms?: string;
    minutes?: string;
};

const WHY_PRIMARY = '#7c3aed'; 
const WHY_GRADIENT = {
    backgroundColor: '#7c3aed',
    backgroundImage: `
        radial-gradient(at 0% 0%, #a78bfa 0px, transparent 50%),
        radial-gradient(at 100% 100%, #5b21b6 0px, transparent 50%)
    `
};

const LOGO_URL = "https://i.postimg.cc/kgWR7jwV/images-(8).jpg";

const WHY_OFFERS: Offer[] = [
    { offerName: 'باقة كرم 250', price: 250, data: '100MB', validity: '7 أيام', packageid: '91', num: '250', sms: '10', minutes: '20' },
    { offerName: 'باقة كرم 500', price: 500, data: '250MB', validity: '30 يوم', packageid: '92', num: '500', sms: '50', minutes: '50' },
    { offerName: 'باقة كرم 900', price: 900, data: '500MB', validity: '45 يوم', packageid: '93', num: '900', sms: '100', minutes: '100' },
    { offerName: 'باقة كرم 2000', price: 2000, data: '1GB', validity: '60 يوم', packageid: '94', num: '2000', sms: '500', minutes: '200' },
];

const PackageItemCard = ({ offer, onClick }: { offer: Offer, onClick: () => void }) => {
    const finalPrice = Math.ceil(offer.price * 3.1);

    return (
        <div 
          className="bg-[#f3f0ff] dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative border border-primary/10 mb-3 text-center cursor-pointer hover:bg-primary/5 transition-all active:scale-[0.98] group"
          onClick={onClick}
        >
          <div className="flex justify-center mb-3">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-md">
                  <Image src={LOGO_URL} alt="Why Logo" fill className="object-cover" />
              </div>
          </div>
          <h4 className="text-sm font-black text-primary mb-1 group-hover:text-primary/80 transition-colors">{offer.offerName}</h4>
          <div className="flex items-baseline justify-center mb-4">
            <span className="text-2xl font-black text-foreground">
                {finalPrice.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground mr-1">ر.ي</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-primary/10 text-center">
            <div className="space-y-1.5">
                <Globe className="w-5 h-5 mx-auto text-primary" />
                <p className="text-[11px] font-black text-foreground truncate">{offer.data || '-'}</p>
            </div>
            <div className="space-y-1.5">
                <Mail className="w-5 h-5 mx-auto text-primary" />
                <p className="text-[11px] font-black text-foreground truncate">{offer.sms || '-'}</p>
            </div>
            <div className="space-y-1.5">
                <PhoneIcon className="w-5 h-5 mx-auto text-primary" />
                <p className="text-[11px] font-black text-foreground truncate">{offer.minutes || '-'}</p>
            </div>
            <div className="space-y-1.5">
                <Clock className="w-5 h-5 mx-auto text-primary" />
                <p className="text-[11px] font-black text-foreground truncate">{offer.validity || '-'}</p>
            </div>
          </div>
        </div>
    );
};

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
                let num = contacts[0].tel[0].replace(/[\s\-\(\)]/g, '').slice(-9);
                setPhone(num);
            }
        } catch (err) { console.error(err); }
    };

    const handleProcessPayment = async (payAmount: number, typeLabel: string, extraPayload: any) => {
        if (!phone || !user || !userDocRef || !firestore) return;
        
        const totalToDeduct = Math.ceil(payAmount * 3.1);

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
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
                    service: 'why', 
                    transid: transid,
                    amount: payAmount, // إرسال المبلغ الصافي قبل الضرب في 3.1
                    ...extraPayload 
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
                notes: `للرقم: ${phone}. (النسبة المعتمدة 3.1x)`,
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

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isProcessing && <ProcessingOverlay />}
            <SimpleHeader title="واي" />
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
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-primary pr-12 pl-12"
                        />
                        <button onClick={handleContactPick} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"><Users className="h-5 w-5" /></button>
                    </div>
                </div>

                {phone.length === 9 && (phone.startsWith('70') || phone.startsWith('71')) && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" defaultValue="packages">
                            <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-primary/10">
                                <TabsTrigger value="packages" className="rounded-xl font-bold text-sm data-[state=active]:bg-primary data-[state=active]:text-white">باقات كرم</TabsTrigger>
                                <TabsTrigger value="balance" className="rounded-xl font-bold text-sm data-[state=active]:bg-primary data-[state=active]:text-white">سداد رصيد</TabsTrigger>
                            </TabsList>

                            <TabsContent value="packages" className="pt-2">
                                <div className="grid grid-cols-1 gap-1">
                                    {WHY_OFFERS.map((offer) => (
                                        <PackageItemCard key={offer.packageid} offer={offer} onClick={() => setSelectedOffer(offer)} />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="balance" className="pt-2">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-primary/5 text-center">
                                    <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل مبلغ الشحن</Label>
                                    <div className="relative max-w-[240px] mx-auto">
                                        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-primary" />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 font-black text-sm">ر.ي</div>
                                    </div>
                                    <div className="mt-4 p-3 bg-primary/5 rounded-2xl border border-dashed border-primary/20">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">إجمالي الخصم (النسبة 3.1x)</p>
                                        <p className="text-lg font-black text-primary">{amount ? Math.ceil(parseFloat(amount) * 3.1).toLocaleString() : '0'} ريال</p>
                                    </div>
                                    <Button className="w-full h-14 rounded-2xl text-lg font-black mt-6 shadow-lg text-white" onClick={() => setIsConfirmingBalance(true)} disabled={!amount} style={{ backgroundColor: WHY_PRIMARY }}>شحن رصيد</Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            <Toaster />
            <audio ref={audioRef} src="/sdad.mp3" preload="auto" />

            <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد تفعيل الباقة</AlertDialogTitle>
                        <div className="space-y-3 pt-4 text-right text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">اسم الباقة:</span><span className="font-bold">{selectedOffer?.offerName}</span></div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">نسبة التحويل:</span><span className="font-bold">3.1x</span></div>
                            <div className="flex justify-between items-center py-3 bg-primary/10 rounded-xl px-2 mt-2"><span className="font-black text-primary">المبلغ المخصوم:</span><span className="font-black text-primary text-lg">{selectedOffer && Math.ceil(selectedOffer.price * 3.1).toLocaleString()} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" style={{ backgroundColor: WHY_PRIMARY }} onClick={() => selectedOffer && handleProcessPayment(selectedOffer.price, 'تفعيل باقة', { num: selectedOffer.num, packageid: selectedOffer.packageid })}>تأكيد</AlertDialogAction>
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
                            <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">نسبة التحويل:</span><span className="font-bold">3.1x</span></div>
                            <div className="flex justify-between items-center py-3 bg-primary/10 rounded-xl px-2 mt-2"><span className="font-black text-primary">إجمالي الخصم:</span><span className="font-black text-primary text-lg">{Math.ceil(parseFloat(amount || '0') * 3.1).toLocaleString()} ريال</span></div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" style={{ backgroundColor: WHY_PRIMARY }} onClick={() => handleProcessPayment(parseFloat(amount), 'رصيد', { israsid: '1' })}>تأكيد الشحن</AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
