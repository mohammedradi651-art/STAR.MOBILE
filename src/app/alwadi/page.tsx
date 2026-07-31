'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  User, 
  CreditCard, 
  CheckCircle, 
  Wallet, 
  Hash, 
  Loader2, 
  Clock
} from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogDescription
} from "@/components/ui/alert-dialog";
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, writeBatch, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Lottie from 'lottie-react';

export const dynamic = 'force-dynamic';

const ALWADI_LOGO = "https://i.postimg.cc/MKMWP3VG/15.jpg";
const PACKAGE_IMG = "https://i.postimg.cc/ZKTtCjkh/unnamed-(1).png";

type RenewalOption = {
  id: string;
  title: string;
  price: number;
};

const PROVIDER_OPTIONS: RenewalOption[] = [
  { id: '1', title: 'تجديد شهرين', price: 3000 },
  { id: '3', title: 'تجديد 4 أشهر', price: 6000 },
  { id: '7', title: 'تجديد 6 أشهر', price: 9000 },
  { id: '9', title: 'تجديد سنة كاملة', price: 15000 },
];

/**
 * مكون التحميل بالشعار المتحرك الموحد
 */
const AlwadiMovingLoader = () => {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    fetch('/TH.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Lottie load error:", err));
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in-0 duration-500">
      <div className="relative w-28 h-28 flex items-center justify-center overflow-hidden">
          {animationData && (
            <Lottie 
                animationData={animationData} 
                loop={true} 
                style={{ width: '100%', height: '100%' }} 
            />
          )}
      </div>
    </div>
  );
};

export default function AlwadiPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [isInquiring, setIsInquiring] = useState(false);
  const [inquiryResult, setInquiryResult] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<RenewalOption | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<any>(userDocRef);

  const getFinalPrice = (price: number) => {
    const discountPercent = userProfile?.alwadiDiscount || 0;
    return price * (1 - discountPercent / 100);
  };

  useEffect(() => {
    if (showSuccess && audioRef.current) {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
    }
  }, [showSuccess]);

  const handleInquiry = async () => {
    if (!cardNumber) {
      toast({ variant: "destructive", title: "خطأ", description: "الرجاء إدخال رقم الكرت أولاً." });
      return;
    }
    setIsInquiring(true);
    setInquiryResult(null);
    setSelectedOption(null);

    try {
      const res = await fetch("/api/alwadi/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: cardNumber })
      });
      const result = await res.json();
      if (result.success) {
        setInquiryResult(result);
      } else {
        toast({ variant: "destructive", title: "عذراً", description: result.message || "رقم الكرت غير موجود." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل الاتصال بالمنظومة." });
    } finally {
      setIsInquiring(false);
    }
  };

  const handleRenewClick = () => {
    if (!selectedOption) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى اختيار فئة التجديد أولاً." });
      return;
    }
    const finalPrice = getFinalPrice(selectedOption.price);
    if ((userProfile?.balance ?? 0) < finalPrice) {
      toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "رصيدك الحالي لا يكفي لإتمام هذه العملية." });
      return;
    }
    setIsConfirming(true);
  };

  const handleFinalSubmit = async () => {
    if (!user || !selectedOption || !userDocRef || !firestore || !inquiryResult) return;

    setIsProcessing(true);
    setIsConfirming(false);

    const finalPrice = getFinalPrice(selectedOption.price);

    try {
        const res = await fetch('/api/alwadi/renew', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.uid,
                cardNumber: cardNumber,
                packageId: selectedOption.id,
                subscriberId: inquiryResult.data.id
            }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || "فشلت عملية التجديد في المنظومة.");

        const batch = writeBatch(firestore);
        const now = new Date().toISOString();

        batch.update(userDocRef, { balance: increment(-finalPrice) });

        const txRef = doc(collection(firestore, 'users', user.uid, 'transactions'));
        batch.set(txRef, {
            userId: user.uid,
            transactionDate: now,
            amount: finalPrice,
            transactionType: 'تجديد منظومة الوادي',
            notes: `باقة: ${selectedOption.title} - رقم الكرت: ${cardNumber}`,
            subscriberName: inquiryResult.data.name,
            cardNumber: cardNumber
        });

        const notifRef = doc(collection(firestore, 'users', user.uid, 'notifications'));
        batch.set(notifRef, {
            title: 'تم التجديد بنجاح',
            body: `تم تجديد باقة ${selectedOption.title} بنجاح لمشترك منظومة الوادي: ${inquiryResult.data.name}.`,
            timestamp: now
        });

        await batch.commit();
        setShowSuccess(true);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'فشل العملية', description: error.message });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      <SimpleHeader title="منظومة الوادي" />

      {(isInquiring || isProcessing) && <AlwadiMovingLoader />}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        
        <div className="bg-mesh-gradient pt-4 pb-8 px-6 rounded-b-[40px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="bg-white p-2 rounded-[28px] shadow-2xl animate-in zoom-in-95 duration-700 overflow-hidden border-2 border-white">
                    <div className="relative h-16 w-48">
                        <Image src={ALWADI_LOGO} alt="Alwadi Logo" fill className="object-contain" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">تجديد اشتراك منظومة الوادي</h2>
                    <div className="flex items-center justify-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">نظام التجديد المباشر</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 mt-6 space-y-8">
            <Card className="rounded-[32px] border-none shadow-sm bg-card overflow-hidden">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cardNumber" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم الكرت</Label>
                            <div className="relative">
                                <Input
                                    id="cardNumber"
                                    type="tel"
                                    placeholder="ادخل رقم الكرت"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                                    className="h-12 rounded-2xl bg-muted/10 border-2 border-primary/20 focus-visible:ring-primary pr-11 font-black text-lg text-right"
                                />
                                <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-60" />
                            </div>
                        </div>
                        <button 
                            className="w-full h-11 rounded-2xl font-black bg-mesh-gradient text-white shadow-lg active:scale-95 transition-all border-none flex items-center justify-center"
                            onClick={handleInquiry}
                            disabled={isInquiring || !cardNumber}
                        >
                            استعلام عن الكرت
                        </button>
                    </div>
                </CardContent>
            </Card>

            {inquiryResult && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <Card className="rounded-[32px] border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="bg-mesh-gradient pb-6">
                            <CardTitle className="text-sm font-black text-white text-center">معلومات الاشتراك</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 pt-0 -mt-4">
                            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-xl border border-slate-100 dark:border-slate-800">
                                <div className="text-center mb-6">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">الاسم</p>
                                    <h3 className="text-lg font-black text-foreground">{inquiryResult.data.name}</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">تاريخ الانتهاء</p>
                                        <p className="text-sm font-black text-foreground">{inquiryResult.data.expiry}</p>
                                    </div>
                                    <div className={cn("p-4 rounded-2xl text-center border", inquiryResult.data.days_left > 10 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                                        <p className={cn("text-[9px] font-bold uppercase mb-1", inquiryResult.data.days_left > 10 ? "text-green-600" : "text-red-600")}>الأيام المتبقية</p>
                                        <p className={cn("text-2xl font-black", inquiryResult.data.days_left > 10 ? "text-green-600" : "text-red-600")}>{Math.max(0, inquiryResult.data.days_left)}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">اختر فئة التجديد</h3>
                    <div className="bg-primary/10 px-3 py-1 rounded-full flex items-center gap-2 border border-primary/5">
                        <Wallet className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-black text-primary">{(userProfile?.balance ?? 0).toLocaleString('en-US')} ر.ي</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {PROVIDER_OPTIONS.map((opt) => {
                        const finalPrice = getFinalPrice(opt.price);
                        const isDiscounted = finalPrice < opt.price;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => setSelectedOption(opt)}
                                className={cn(
                                    "p-4 rounded-[32px] border-2 transition-all duration-300 flex flex-col items-center justify-center text-center gap-2 overflow-hidden shadow-sm active:scale-[0.98]",
                                    selectedOption?.id === opt.id 
                                        ? "border-primary bg-primary/5 scale-[1.02]" 
                                        : "bg-white dark:bg-slate-900 border-transparent hover:border-primary/10"
                                )}
                            >
                                <div className="bg-white/10 rounded-2xl w-14 h-14 flex items-center justify-center overflow-hidden border border-border shadow-inner mb-1">
                                    <Image src={PACKAGE_IMG} alt="Pkg" width={40} height={40} className="object-contain" />
                                </div>
                                <span className="text-[11px] font-black block text-foreground truncate w-full">{opt.title}</span>
                                <div className='flex flex-col items-center gap-0.5'>
                                    {isDiscounted && (
                                        <span className="text-[9px] font-bold text-muted-foreground line-through opacity-60">
                                            {opt.price.toLocaleString()}
                                        </span>
                                    )}
                                    <p className="text-base font-black text-primary">{finalPrice.toLocaleString('en-US')} <span className="text-[8px]">ر.ي</span></p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="pt-2">
                <Button 
                    className={cn(
                        "w-full h-14 rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all duration-300",
                        !inquiryResult ? "opacity-30 cursor-not-allowed grayscale" : "opacity-100"
                    )}
                    onClick={handleRenewClick}
                    disabled={!selectedOption || !inquiryResult}
                >
                    تجديد الآن
                </Button>
            </div>
        </div>
      </div>

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-mesh-gradient p-8 text-center text-white relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-center font-black text-2xl text-white drop-shadow-md">تأكيد التجديد</AlertDialogTitle>
                </AlertDialogHeader>
            </div>
            <div className="p-6 space-y-4">
                <div className="py-4 space-y-3 text-right text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                        <span className="text-muted-foreground flex items-center gap-2">رقم الكرت:</span>
                        <span className="font-mono font-bold">{cardNumber}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                        <span className="text-muted-foreground flex items-center gap-2">نوع الفئة:</span>
                        <span className="font-bold">{selectedOption?.title}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-muted/50 rounded-2xl px-3 mt-2">
                        <span className="font-black">المبلغ المخصوم:</span>
                        <span className="font-black text-primary text-xl">{getFinalPrice(selectedOption?.price || 0).toLocaleString('en-US')} ريال</span>
                    </div>
                </div>
                <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0 pt-2">
                    <AlertDialogAction onClick={handleFinalSubmit} className="w-full rounded-2xl h-12 font-black shadow-lg">تأكيد</AlertDialogAction>
                    <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                </AlertDialogFooter>
            </div>
        </AlertDialogContent>
      </AlertDialog>

      {showSuccess && inquiryResult && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in-0">
            <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
            <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                <div className="bg-green-500 p-8 flex justify-center">
                    <div className="bg-white/20 p-4 rounded-full animate-bounce">
                        <CheckCircle className="h-16 w-16 text-white" />
                    </div>
                </div>
                <CardContent className="p-8 space-y-6">
                    <div>
                        <h2 className="text-2xl font-black text-green-600">تم التجديد بنجاح</h2>
                        <p className="text-sm text-muted-foreground mt-1">منظومة الوادي - نظام السداد المباشر</p>
                    </div>

                    <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2">المشترك:</span>
                            <span className="font-bold">{inquiryResult?.data?.name}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2">الفئة:</span>
                            <span className="font-bold">{selectedOption?.title}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2">رقم الكرت:</span>
                            <span className="font-mono font-bold">{cardNumber}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="font-black text-primary">المبلغ المخصوم:</span>
                            <span className="font-black text-primary text-base">{getFinalPrice(selectedOption?.price || 0).toLocaleString('en-US')} ريال</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button className="h-12 rounded-2xl font-bold bg-muted w-full" onClick={() => router.push('/login')}>الرئيسية</button>
                        <button className="h-12 rounded-2xl font-bold bg-primary text-white w-full" onClick={() => { setShowSuccess(false); setInquiryResult(null); setCardNumber(''); }}>تجديد آخر</button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      <Toaster />
    </div>
  );
}
