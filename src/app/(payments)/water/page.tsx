'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  CheckCircle,
  Loader2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, increment, collection as firestoreCollection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Image from 'next/image';
import Lottie from 'lottie-react';

export const dynamic = 'force-dynamic';

const waterCities = [
    { label: "سيئون", value: "HD41" },
    { label: "تريم", value: "HD34" },
    { label: "شبام", value: "HD43" },
    { label: "القطن", value: "HD53" },
    { label: "ساه", value: "HD42" }
];

/**
 * مكون التحميل بالشعار المتحرك الموحد
 */
const WaterMovingLoader = () => {
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

export default function WaterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [selectedCity, setSelectedCity] = useState('');
  const [subscriberNumber, setSubscriberNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTxId, setLastTxId] = useState('');

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

  const handleSearch = async () => {
    if (!selectedCity) {
        toast({ variant: 'destructive', title: 'تنبيه', description: 'الرجاء اختيار المنطقة أولاً' });
        return;
    }
    if (!subscriberNumber) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال رقم المشترك' });
      return;
    }

    setIsSearching(true);
    setResult(null);
    try {
      const response = await fetch('/api/water/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: selectedCity, number: subscriberNumber })
      });
      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        toast({ variant: 'destructive', title: 'عذراً', description: data.message });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل الاتصال بالخدمة' });
    } finally {
      setIsSearching(false);
    }
  };

  const COMMISSION = 200;

  const handlePayNow = async () => {
    if (!user || !userProfile || !result || !firestore || !userDocRef) return;

    const billAmount = parseFloat(result.amount);
    const totalToDeduct = billAmount + COMMISSION;

    if ((userProfile.balance ?? 0) < totalToDeduct) {
        toast({
            variant: "destructive",
            title: "رصيد غير كافٍ",
            description: "رصيدك الحالي لا يكفي لسداد الفاتورة مع العمولة.",
        });
        setIsConfirming(false);
        return;
    }

    setIsProcessing(true);
    setIsConfirming(false);

    try {
        const batch = writeBatch(firestore);
        const now = new Date().toISOString();
        const requestId = Date.now().toString().slice(-8);
        setLastTxId(requestId);

        const cityName = waterCities.find(c => c.value === result.cityCode)?.label || 'غير محدد';

        batch.update(userDocRef, { balance: increment(-totalToDeduct) });

        const txRef = doc(firestoreCollection(firestore, `users/${user.uid}/transactions`));
        batch.set(txRef, {
            userId: user.uid,
            transactionDate: now,
            amount: totalToDeduct,
            transactionType: 'سداد فاتورة مياه',
            notes: `المنطقة: ${cityName} - رقم المشترك: ${result.subscriberNumber}`,
            recipientPhoneNumber: result.subscriberNumber
        });

        const requestRef = doc(firestoreCollection(firestore, 'waterRequests'));
        batch.set(requestRef, {
            id: requestId,
            userId: user.uid,
            userName: userProfile.displayName || 'مشترك',
            userPhone: userProfile.phoneNumber || '',
            city: cityName,
            subscriberNumber: result.subscriberNumber,
            subscriberName: result.name,
            billAmount: billAmount,
            commission: COMMISSION,
            totalAmount: totalToDeduct,
            status: 'pending',
            timestamp: now
        });

        await batch.commit();
        setShowSuccess(true);
    } catch (error: any) {
        toast({ variant: "destructive", title: "فشل العملية", description: "حدث خطأ أثناء معالجة الطلب." });
    } finally {
        setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
        <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in-0">
          <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
            <div className="bg-green-500 p-8 flex justify-center">
              <div className="bg-white/20 p-4 rounded-full animate-bounce">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
            </div>
            <CardContent className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2>
                <p className="text-sm text-muted-foreground mt-1">مؤسسة المياه والصرف الصحي - نظام السداد المباشر</p>
              </div>

              <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="text-muted-foreground">رقم المشترك:</span>
                  <span className="font-mono font-bold">{result?.subscriberNumber}</span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="text-muted-foreground">رقم الطلب:</span>
                  <span className="font-mono font-bold">{lastTxId}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-black text-primary">المبلغ المخصوم:</span>
                  <span className="font-black text-primary text-base">{(parseFloat(result?.amount || '0') + COMMISSION).toLocaleString()} ر.ي</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => router.push('/login')}>الرئيسية</Button>
                <Button className="rounded-2xl h-12 font-bold" onClick={() => { setShowSuccess(false); setResult(null); setSubscriberNumber(''); }}>سداد آخر</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      <SimpleHeader title="سداد المياه" />

      {(isSearching || isProcessing) && <WaterMovingLoader />}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-mesh-gradient pt-8 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="bg-white p-2 rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-700 overflow-hidden border-2 border-white">
                    <div className="relative h-16 w-24">
                        <Image src="https://i.postimg.cc/FzMTNtL3/images-(7).jpg" alt="المياه" fill className="object-contain" priority />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">سداد فواتير المياه</h2>
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">نظام السداد المباشر</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 mt-6 space-y-8">
            <Card className="rounded-[32px] border-none shadow-sm bg-card overflow-hidden">
                <CardContent className="p-6 space-y-5">
                    <div className="space-y-2" dir="rtl">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">اختيار المنطقة</Label>
                        <Select onValueChange={setSelectedCity} value={selectedCity}>
                            <SelectTrigger className="h-12 rounded-2xl bg-muted/10 border-2 border-primary/20 font-bold text-right flex-row-reverse">
                                <SelectValue placeholder="اختر مدينتك" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {waterCities.map(city => (
                                    <SelectItem key={city.value} value={city.value} className="font-bold text-right">{city.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="subscriberNumber" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم المشترك</Label>
                        <Input
                            id="subscriberNumber"
                            type="tel"
                            placeholder="ادخل رقم المشترك"
                            value={subscriberNumber}
                            onChange={(e) => setSubscriberNumber(e.target.value.replace(/\D/g, ''))}
                            className="h-12 rounded-2xl bg-muted/10 border-2 border-primary/20 focus-visible:ring-primary font-black text-lg text-center"
                        />
                    </div>
                    <Button 
                        className="w-full h-11 rounded-2xl font-black bg-mesh-gradient text-white shadow-lg active:scale-95 transition-all border-none"
                        onClick={handleSearch}
                        disabled={isSearching || !subscriberNumber || !selectedCity}
                    >
                        {isSearching ? <Loader2 className="animate-spin h-4 w-4 ml-2" /> : "استعلام عن الفاتورة"}
                    </Button>
                </CardContent>
            </Card>

            {result && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <Card className="rounded-[32px] border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="bg-mesh-gradient pb-6">
                            <CardTitle className="text-sm font-black text-white text-center">معلومات الاشتراك</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 pt-0 -mt-4">
                            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-xl border border-slate-100 dark:border-slate-800" dir="rtl">
                                <div className="text-center mb-6">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">الاسم</p>
                                    <h3 className="text-lg font-black text-foreground">{result.name}</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">فترة السداد</p>
                                        <p className="text-xs font-black">{result.period}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">رقم المشترك</p>
                                        <p className="text-xs font-black">{result.subscriberNumber}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-primary/5 p-5 rounded-3xl text-center border-2 border-dashed border-primary/10 mt-6">
                                    <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-1">إجمالي المبلغ المستحق</p>
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-3xl font-black text-primary">{parseFloat(result.amount).toLocaleString('en-US')}</span>
                                        <span className="text-xs font-bold text-primary">ريال</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="pt-2">
                        <Button 
                            className="w-full h-14 rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-transform"
                            onClick={() => setIsConfirming(true)}
                        >
                            تأكيد سداد الفاتورة
                        </Button>
                    </div>
                </div>
            )}
        </div>
      </div>

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
          <AlertDialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-mesh-gradient p-8 text-center text-white relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                  <AlertDialogHeader>
                      <AlertDialogTitle className="text-center font-black text-2xl text-white drop-shadow-md">تأكيد السداد</AlertDialogTitle>
                  </AlertDialogHeader>
              </div>
              <div className="p-6 space-y-4">
                  <div className="py-4 space-y-3 text-right text-sm">
                      <div className="flex justify-between items-center py-2 border-b border-dashed">
                          <span className="text-muted-foreground">رقم المشترك:</span>
                          <span className="font-mono font-bold">{result?.subscriberNumber}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-dashed">
                          <span className="text-muted-foreground">قيمة الفاتورة:</span>
                          <span className="font-bold">{parseFloat(result?.amount || '0').toLocaleString()} ر.ي</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-dashed">
                          <span className="text-muted-foreground">العمولة (ثابتة):</span>
                          <span className="font-bold text-orange-600">{COMMISSION} ر.ي</span>
                      </div>
                      <div className="flex justify-between items-center py-3 bg-muted/50 rounded-2xl px-3 mt-2">
                          <span className="font-black">الإجمالي المخصوم:</span>
                          <span className="font-black text-primary text-xl">{(parseFloat(result?.amount || '0') + COMMISSION).toLocaleString()} ريال</span>
                      </div>
                  </div>
                  <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0 pt-2">
                      <AlertDialogAction onClick={handlePayNow} className="w-full rounded-2xl h-12 font-bold shadow-lg">تأكيد السداد</AlertDialogAction>
                      <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                  </AlertDialogFooter>
              </div>
          </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
