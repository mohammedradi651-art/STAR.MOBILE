'use client';

import React, { useState, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  Search, 
  Loader2, 
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ALSAFAA_LOGO = "https://i.postimg.cc/nL2S7w6S/20260728-152016.jpg";

type AlsafaResult = {
    subscriberName: string;
    cardNumber: string;
    subscriptionStatus: string;
};

/**
 * مكون التحميل المطور - تم إصلاح الاستيراد لتجنب الأخطاء
 */
const AlsafaaMovingLoader = () => {
  const [LottieComponent, setLottieComponent] = useState<any>(null);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    const loadAssets = async () => {
        try {
            const [lottieMod, animRes] = await Promise.all([
                import('lottie-react'),
                fetch('/TH.json')
            ]);
            setLottieComponent(() => lottieMod.default);
            setAnimationData(await animRes.json());
        } catch (err) {
            console.error("Lottie load error:", err);
        }
    };
    loadAssets();
  }, []);

  const Lottie = LottieComponent;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in-0 duration-500">
      <div className="relative w-28 h-28 flex items-center justify-center overflow-hidden">
          {Lottie && animationData && (
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

export default function AlsafaaPage() {
  const { toast } = useToast();
  const [cardNumber, setCardNumber] = useState('');
  const [isInquiring, setIsInquiring] = useState(false);
  const [result, setResult] = useState<AlsafaResult | null>(null);

  const calculateDaysLeft = (status: string) => {
    const dateMatch = status.match(/(\d{1,4})[\/-](\d{1,4})[\/-](\d{1,4})/);
    if (!dateMatch) return null;
    
    try {
        let day, month, year;
        const p1 = dateMatch[1];
        const p2 = dateMatch[2];
        const p3 = dateMatch[3];

        if (p1.length === 4) {
            year = parseInt(p1);
            month = parseInt(p2);
            day = parseInt(p3);
        } else {
            day = parseInt(p1);
            month = parseInt(p2);
            year = parseInt(p3);
        }

        const expiryDate = new Date(year, month - 1, day);
        const today = new Date();
        expiryDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
            days: diffDays,
            date: `${day}-${month}-${year}`
        };
    } catch (e) {
        return null;
    }
  };

  const handleInquiry = async () => {
    if (!cardNumber) {
      toast({ variant: "destructive", title: "تنبيه", description: "الرجاء إدخل رقم الكرت أولاً." });
      return;
    }

    setIsInquiring(true);
    setResult(null);

    try {
        const res = await fetch('/api/alsafaa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardNumber })
        });
        const data = await res.json();

        if (data.success) {
            setResult(data.data);
        } else {
            setResult(null);
            toast({ 
                variant: "destructive", 
                title: "عذراً", 
                description: data.message || "عذراً، رقم الكرت غير موجود." 
            });
        }
    } catch (error) {
        setResult(null);
        toast({ variant: "destructive", title: "خطأ", description: "فشل الاتصال بسيرفر الشبكة." });
    } finally {
        setIsInquiring(false);
    }
  };

  const info = result ? calculateDaysLeft(result.subscriptionStatus) : null;
  const daysLeft = info?.days ?? 0;

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      <SimpleHeader title="شبكة الصفاء الرقمية" />
      
      {isInquiring && <AlsafaaMovingLoader />}
      
      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-mesh-gradient pt-8 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="bg-white p-2 rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-700 overflow-hidden border-2 border-white">
                    <div className="relative h-16 w-16">
                        <Image src={ALSAFAA_LOGO} alt="Alsafaa Logo" fill className="object-contain" priority />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">استعلام اشتراك الصفاء</h2>
                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">نظام الاستعلام المباشر</p>
                </div>
            </div>
        </div>

        <div className="px-4 mt-6 space-y-8">
            <Card className="rounded-[32px] border-none shadow-sm bg-card overflow-hidden">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cardNumber" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم الكرت</Label>
                            <Input
                                id="cardNumber"
                                type="tel"
                                placeholder="ادخل رقم الكرت"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                                className="h-12 rounded-2xl bg-muted/10 border-2 border-primary/20 focus-visible:ring-primary font-black text-lg text-center"
                            />
                        </div>
                        <button 
                            className="w-full h-11 rounded-2xl font-black bg-mesh-gradient text-white shadow-lg active:scale-95 transition-all border-none"
                            onClick={handleInquiry}
                            disabled={isInquiring || !cardNumber}
                        >
                            استعلام عن الكرت
                        </button>
                    </div>
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
                                    <h3 className="text-lg font-black text-foreground">{result.subscriberName}</h3>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">تاريخ الانتهاء</p>
                                        <p className="text-sm font-black text-foreground">{info?.date || "غير محدد"}</p>
                                    </div>
                                    <div className={cn("p-4 rounded-2xl text-center border", daysLeft > 10 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                                        <p className={cn("text-[9px] font-bold uppercase mb-1", daysLeft > 10 ? "text-green-600" : "text-red-600")}>الأيام المتبقية</p>
                                        <p className={cn("text-2xl font-black", daysLeft > 10 ? "text-green-600" : "text-red-600")}>{Math.max(0, daysLeft)}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-orange-50 dark:bg-orange-950/20 p-5 rounded-[28px] border border-orange-100 dark:border-orange-900/30 flex items-start gap-4" dir="rtl">
                        <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-xl mt-0.5">
                            <Info className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="text-right space-y-1">
                            <h4 className="text-xs font-black text-orange-700 dark:text-orange-400">تنويه هام</h4>
                            <p className="text-[10px] text-orange-600/80 font-bold leading-relaxed">
                                خدمة السداد المباشر لشبكة الصفاء غير متاحة حالياً عبر التطبيق. يرجى مراجعة أقرب وكيل معتمد أو الإدارة للتجديد.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <Toaster />
    </div>
  );
}
