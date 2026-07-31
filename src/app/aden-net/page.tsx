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
  Clock,
  Hash,
  Calendar,
  History,
  Phone,
  Users
} from 'lucide-react';
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

type Offer = {
    offerId: string;
    offerName: string;
    price: number;
    data: string;
    validity: string;
    num: string; 
};

const ADEN_NET_PRIMARY = '#1FB8C0';
const ADEN_NET_GRADIENT = {
    backgroundColor: '#1FB8C0',
    backgroundImage: `
        radial-gradient(at 0% 0%, #26D0D9 0px, transparent 50%),
        radial-gradient(at 100% 100%, #189BA1 0px, transparent 50%)
    `
};

const ADEN_NET_OFFERS: Offer[] = [
    { offerId: '20gb', offerName: 'عدن نت 20 جيجا', price: 3000, data: '20 GB', validity: 'شهر', num: '3000' },
    { offerId: '40gb', offerName: 'عدن نت 40 جيجا', price: 6000, data: '40 GB', validity: 'شهر', num: '6000' },
    { offerId: '60gb', offerName: 'عدن نت 60 جيجا', price: 9000, data: '60 GB', validity: 'شهر', num: '9000' },
    { offerId: '80gb', offerName: 'عدن نت 80 جيجا', price: 12000, data: '80 GB', validity: 'شهر', num: '12000' },
    { offerId: '120gb', offerName: 'عدن نت 120 جيجا (تجارية)', price: 30000, data: '120 GB', validity: 'شهر', num: '30000' },
];

const PackageCard = ({ offer, onClick }: { offer: Offer, onClick: () => void }) => (
    <div 
      className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#1FB8C0]/5 mb-3 cursor-pointer hover:bg-[#1FB8C0]/5 transition-all active:scale-[0.98] group flex items-center justify-between"
      onClick={onClick}
    >
      <div className="flex items-center gap-4 text-right">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#1FB8C0]/10 bg-white shrink-0">
              <Image 
                  src="https://i.postimg.cc/FFV6dDqd/FB-IMG-1770843160346.jpg" 
                  alt="Aden Net" 
                  fill 
                  className="object-cover"
              />
          </div>
          <div className="flex flex-col items-start">
              <h4 className="text-sm font-black text-foreground group-hover:text-[#1FB8C0] transition-colors">{offer.offerName}</h4>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3 text-[#1FB8C0]"/> {offer.data}</span>
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3 text-[#1FB8C0]"/> {offer.validity}</span>
              </div>
          </div>
      </div>

      <div className="flex flex-col items-end text-left shrink-0">
        <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-[#1FB8C0]">{offer.price.toLocaleString('en-US')}</span>
        </div>
        <Button size="sm" className="h-7 rounded-lg text-[10px] font-black px-4 mt-1 bg-[#1FB8C0] hover:bg-[#1FB8C0]/90">سداد</Button>
      </div>
    </div>
);

export default function AdenNetPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [phone, setPhone] = useState('');
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
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

    const handlePhoneChange = (val: string, element: HTMLInputElement) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 9);
        setPhone(cleaned);
        
        if (cleaned.length === 9) {
            element.blur();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(50);
            }

            if (!cleaned.startsWith('79')) {
                toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم عدن نت يجب أن يبدأ بـ 79' });
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
                if (selectedNumber.startsWith('079')) selectedNumber = selectedNumber.substring(1);
                
                const inputElement = document.querySelector('input[type="tel"]') as HTMLInputElement;
                if (inputElement) handlePhoneChange(selectedNumber.slice(0, 9), inputElement);
                else setPhone(selectedNumber.slice(0, 9));
            }
        } catch (err) {
            console.error("Contacts selection failed:", err);
        }
    };

    const handleActivateOffer = async () => {
        if (!selectedOffer || !phone || !user || !userDocRef || !firestore) return;
        
        if (!phone.startsWith('79')) {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم عدن نت يجب أن يبدأ بـ 79' });
            return;
        }

        const basePrice = selectedOffer.price;
        const commission = Math.ceil(basePrice * 0.05);
        const totalToDeduct = basePrice + commission;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك لا يكفي لتفعيل الباقة شاملة العمولة.' });
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
                    service: 'adenet', 
                    num: selectedOffer.num,
                    transid: transid 
                })
            });
            const result = await response.json();
            
            const isSuccess = result.resultCode === "0" || result.resultCode === 0;
            if (!response.ok || !isSuccess) {
                throw new Error(result.message || result.resultDesc || 'فشل تفعيل الباقة من المصدر.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid, 
                transactionDate: new Date().toISOString(), 
                amount: totalToDeduct,
                transactionType: `تفعيل ${selectedOffer.offerName}`, 
                notes: `للرقم: ${phone}. سعر: ${basePrice} + عمولة: ${commission}.`, 
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
            <div className="flex flex-col h-full">
                <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in-0 p-4">
                    <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-8 flex justify-center">
                            <div className="bg-white/20 p-4 rounded-full animate-bounce">
                                <CheckCircle className="h-16 w-16 text-white" />
                            </div>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-green-600">تم تفعيل الباقة بنجاح</h2>
                                <p className="text-sm text-muted-foreground mt-1">تمت العملية بنجاح لصالح المشترك</p>
                            </div>

                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-[#1FB8C0]/10">
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> رقم العملية:</span>
                                    <span className="font-mono font-black text-[#1FB8C0]">{lastTxDetails.transid}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> رقم الهاتف:</span>
                                    <span className="font-mono font-bold tracking-widest">{lastTxDetails.phone}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> نوع الباقة:</span>
                                    <span className="font-bold">{lastTxDetails.type}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> الإجمالي المخصوم:</span>
                                    <span className="font-black text-[#1FB8C0]">{lastTxDetails.amount.toLocaleString('en-US')} ريال</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span>
                                    <span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => router.push('/login')}>الرئيسية</Button>
                                <Button className="rounded-2xl h-12 font-bold" onClick={() => router.push('/transactions')} style={{ backgroundColor: ADEN_NET_PRIMARY }}>
                                    <History className="ml-2 h-4 w-4" /> العمليات
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isActivatingOffer && <ProcessingOverlay />}

            <SimpleHeader title="عدن نت" />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={ADEN_NET_GRADIENT}>
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

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#1FB8C0]/5">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رقم الهاتف</Label>
                    </div>
                    <div className="relative">
                        <Input
                            type="tel"
                            placeholder="79xxxxxxx"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                            className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#1FB8C0] transition-all pr-12 pl-12"
                        />
                        <button 
                            onClick={handleContactPick}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#1FB8C0] hover:bg-[#1FB8C0]/10 rounded-xl transition-colors"
                            title="جهات الاتصال"
                        >
                            <Users className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {phone.length === 9 && phone.startsWith('79') && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <div className="pt-2 pb-10">
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4 px-1">باقات عدن نت المتوفرة</h3>
                            <div className="grid grid-cols-1 gap-1">
                                {ADEN_NET_OFFERS.map((offer) => (
                                    <PackageCard 
                                        key={offer.offerId} 
                                        offer={offer} 
                                        onClick={() => setSelectedOffer(offer)} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Toaster />

            <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد تفعيل باقة عدن نت</AlertDialogTitle>
                        <div className="py-4 space-y-3 text-right text-sm">
                            <p className="text-center text-lg font-black text-[#1FB8C0] mb-2">{selectedOffer?.offerName}</p>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">رقم المشترك:</span>
                                <span className="font-bold">{phone}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">سعر الباقة:</span>
                                <span className="font-bold">{selectedOffer?.price.toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground">النسبة (5%):</span>
                                <span className="font-bold text-orange-600">{Math.ceil((selectedOffer?.price || 0) * 0.05).toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2 mt-2">
                                <span className="font-black">إجمالي الخصم:</span>
                                <span className="font-black text-[#1FB8C0] text-lg">{((selectedOffer?.price || 0) + Math.ceil((selectedOffer?.price || 0) * 0.05)).toLocaleString('en-US')} ريال</span>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction onClick={handleActivateOffer} className="w-full rounded-2xl h-12 font-bold text-white" disabled={isActivatingOffer} style={{ backgroundColor: ADEN_NET_PRIMARY }}>
                            تفعيل الآن
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">تراجع</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
