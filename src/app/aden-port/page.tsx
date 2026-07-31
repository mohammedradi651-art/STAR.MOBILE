
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  User, 
  CheckCircle, 
  Search, 
  Wallet, 
  History, 
  Hash, 
  Calendar,
  Ship,
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
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Package = {
  id: number;
  name: string;
  price: number;
  icon: any;
};

const ADEN_PORT_PACKAGES: Package[] = [
  { id: 1, name: "تجديد شهرين", price: 3000, icon: Clock },
  { id: 3, name: "تجديد 4 أشهر", price: 6000, icon: Clock },
  { id: 7, name: "تجديد 6 أشهر", price: 9000, icon: Clock },
  { id: 9, name: "تجديد سنة كاملة", price: 15000, icon: Calendar },
];

export default function AdenPortPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [subscriberNumber, setSubscriberNumber] = useState('');
  const [subscriberInfo, setSubscriberInfo] = useState<{ id: number; name: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
    if (!subscriberNumber) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال رقم المشترك' });
      return;
    }

    setIsSearching(true);
    setSubscriberInfo(null);
    try {
      const response = await fetch('/api/aden-port/subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: subscriberNumber })
      });
      const data = await response.json();

      if (data.success) {
        setSubscriberInfo({ id: data.subscriber_id, name: data.subscriber });
      } else {
        toast({ variant: 'destructive', title: 'غير موجود', description: data.message || 'المشترك غير موجود في قاعدة البيانات' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل الاتصال بالخدمة' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleRenew = async () => {
    if (!user || !subscriberInfo || !selectedPackage) return;

    if ((userProfile?.balance ?? 0) < selectedPackage.price) {
      toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك لا يكفي لإتمام هذه العملية' });
      return;
    }

    setIsProcessing(true);
    setIsConfirming(false);

    try {
      const response = await fetch('/api/aden-port/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          subscriber_id: subscriberInfo.id,
          service_id: selectedPackage.id,
          price: selectedPackage.price,
          packageName: selectedPackage.name,
          subscriberName: subscriberInfo.name
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowSuccess(true);
      } else {
        throw new Error(data.error || 'فشلت عملية التجديد');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
        <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/10/13/audio_a141b2c45e.mp3" preload="auto" />
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in-0">
          <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
            <div className="bg-green-500 p-8 flex justify-center">
              <div className="bg-white/20 p-4 rounded-full animate-bounce">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
            </div>
            <CardContent className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-green-600">تم التجديد بنجاح</h2>
                <p className="text-sm text-muted-foreground mt-1">بندر عدن - نظام التجديد المباشر</p>
              </div>

              <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="text-muted-foreground">المشترك:</span>
                  <span className="font-bold">{subscriberInfo?.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="text-muted-foreground">الباقة:</span>
                  <span className="font-bold">{selectedPackage?.name}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-black text-primary">المبلغ المخصوم:</span>
                  <span className="font-black text-primary text-base">{selectedPackage?.price.toLocaleString()} ر.ي</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => router.push('/login')}>الرئيسية</Button>
                <Button className="rounded-2xl h-12 font-bold" onClick={() => router.push('/transactions')}>
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
      {isSearching && <ProcessingOverlay message="جاري الاستعلام..." />}
      {isProcessing && <ProcessingOverlay message="جاري تنفيذ التجديد..." />}

      <SimpleHeader title="بندر عدن" />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Balance Card */}
        <Card className="overflow-hidden rounded-[28px] shadow-lg bg-mesh-gradient text-white border-none">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="text-right">
              <p className="text-[10px] font-black opacity-80 mb-1 uppercase tracking-widest">رصيدك الحالي</p>
              <div className="flex items-baseline gap-1">
                <h2 className="text-2xl font-black text-white">{userProfile?.balance?.toLocaleString() || '0'}</h2>
                <span className="text-[10px] font-bold opacity-70">ريال</span>
              </div>
            </div>
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Ship className="h-6 w-6 text-white" />
            </div>
          </CardContent>
        </Card>

        {/* Search Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-primary/5 space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم المشترك</Label>
            <div className="relative">
              <Input
                type="tel"
                placeholder="مثال: 29825"
                value={subscriberNumber}
                onChange={(e) => setSubscriberNumber(e.target.value.replace(/\D/g, ''))}
                className="text-center font-black text-xl h-14 rounded-2xl bg-muted/20 border-none focus-visible:ring-primary"
              />
              <Hash className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-40" />
            </div>
          </div>
          <Button 
            className="w-full h-12 rounded-2xl font-black text-base shadow-lg" 
            onClick={handleSearch}
            disabled={isSearching || !subscriberNumber}
          >
            {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="ml-2 h-5 w-5" />}
            استعلام عن المشترك
          </Button>
        </div>

        {/* Results and Packages */}
        {subscriberInfo && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <Card className="rounded-[32px] border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-xs font-black text-primary uppercase text-center flex items-center justify-center gap-2">
                  <User className="h-4 w-4" /> معلومات المشترك
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 text-center">
                <p className="text-[10px] font-bold text-muted-foreground mb-1">الاسم الرباعي</p>
                <h3 className="text-lg font-black text-foreground">{subscriberInfo.name}</h3>
                <p className="text-xs font-mono font-bold text-primary mt-1">ID: {subscriberInfo.id}</p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">اختر باقة التجديد</h3>
              <div className="grid grid-cols-1 gap-3">
                {ADEN_PORT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setIsConfirming(true);
                    }}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-primary/5 hover:bg-primary/5 transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
                        <pkg.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm">{pkg.name}</p>
                        <p className="text-[9px] font-bold text-muted-foreground">منظومة بندر عدن</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black text-primary">{pkg.price.toLocaleString()} <span className="text-[10px]">ر.ي</span></p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent className="rounded-[32px] max-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">تأكيد عملية التجديد</AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2">
              هل أنت متأكد من تجديد باقة <span className="text-primary font-black">{selectedPackage?.name}</span> للمشترك <span className="font-bold text-foreground">{subscriberInfo?.name}</span>؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 bg-muted/50 rounded-2xl px-4 space-y-2 mt-4 text-sm">
            <div className="flex justify-between items-center"><span className="text-muted-foreground">قيمة الباقة:</span><span className="font-bold">{selectedPackage?.price.toLocaleString()} ر.ي</span></div>
            <div className="flex justify-between items-center pt-2 border-t border-dashed"><span className="font-black">الإجمالي المخصوم:</span><span className="font-black text-primary text-lg">{selectedPackage?.price.toLocaleString()} ر.ي</span></div>
          </div>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
            <AlertDialogAction onClick={handleRenew} className="w-full rounded-2xl h-12 font-black shadow-lg">تأكيد السداد</AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
