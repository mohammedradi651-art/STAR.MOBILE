"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Smartphone, ArrowLeftRight, SatelliteDish, Wifi, History, Wallet, MessageCircleQuestion, Heart, Gamepad2, Globe, PhoneCall, Zap, CreditCard, Droplets, ChevronLeft as LucideChevronLeft } from "lucide-react";
import React, { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

const Icon4G = ({ size }: { size?: number }) => (
  <span className="font-black leading-none" style={{ fontSize: size ? `${size * 0.8}px` : '10px' }}>4G</span>
);

const AlsafaaIcon = ({ className, size, style }: { className?: string, size?: number, style?: React.CSSProperties }) => (
  <div className={cn("relative overflow-hidden rounded-xl", className)} style={{ width: size, height: size, ...style }}>
    <Image 
      src="https://i.postimg.cc/nL2S7w6S/20260728-152016.jpg" 
      alt="شبكة الصفاء الرقمية" 
      fill 
      className="object-cover"
    />
  </div>
);

const availableServices = [
  { id: 'yemen-mobile', name: 'يمن موبايل', icon: PhoneCall, href: '/yemen-mobile' },
  { id: 'yemen-4g', name: 'يمن فورجي', icon: Icon4G, href: '/yemen-4g' },
  { id: 'pay-bills', name: 'تسديد رصيد', icon: Smartphone, href: '/telecom-services' },
  { id: 'digital-cards', name: 'الشبكات', icon: Wifi, href: '/services' },
  { id: 'payments', name: 'المدفوعات', icon: CreditCard, href: '#' },
  { id: 'alwadi', name: 'منظومة الوادي', icon: SatelliteDish, href: '/alwadi' },
  { id: 'alsafaa', name: 'شبكة الصفاء الرقمية', icon: AlsafaaIcon, href: '/alsafaa' },
  { id: 'withdraw', name: 'غذي حسابك', icon: Wallet, href: '/top-up' },
  { id: 'games', name: 'شدات ببجي', icon: Gamepad2, href: '/games' },
  { id: 'favorites', name: 'المفضلة', icon: Heart, href: '/favorites' },
  { id: 'statement', name: 'سجل العمليات', icon: History, href: '/transactions' },
  { id: 'support', name: 'الدعم الفني', icon: MessageCircleQuestion, href: '/support' },
];

type UserProfile = {
  balance?: number;
};

export function BalanceCard() {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [leftAction, setLeftAction] = useState(availableServices.find(s => s.id === 'payments') || availableServices[4]);
  const [rightAction, setRightAction] = useState(availableServices.find(s => s.id === 'pay-bills') || availableServices[2]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPaymentHubOpen, setIsPaymentHubOpen] = useState(false);
  const [editingSide, setEditingSide] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    setIsBalanceVisible(document.documentElement.classList.contains('dark'));

    const savedLeftId = localStorage.getItem('balance_card_left_id');
    const savedRightId = localStorage.getItem('balance_card_right_id');
    
    if (savedLeftId) {
        const service = availableServices.find(s => s.id === savedLeftId);
        if (service) setLeftAction(service);
    }
    if (savedRightId) {
        const service = availableServices.find(s => s.id === savedRightId);
        if (service) setRightAction(service);
    }
  }, []);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, "users", user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const balance = userProfile?.balance ?? 0;
  const isLoading = isUserLoading || isProfileLoading;

  const handleLongPress = (side: 'left' | 'right') => {
    setEditingSide(side);
    setIsConfigOpen(true);
  };

  const handleActionClick = (service: any) => {
    if (service.id === 'payments') {
        setIsPaymentHubOpen(true);
    } else {
        router.push(service.href);
    }
  };

  const selectService = (service: typeof availableServices[0]) => {
    if (editingSide === 'left') {
      setLeftAction(service);
      localStorage.setItem('balance_card_left_id', service.id);
    } else {
      setRightAction(service);
      localStorage.setItem('balance_card_right_id', service.id);
    }
    setIsConfigOpen(false);
  };

  const ActionButton = ({ service, side }: { service: typeof availableServices[0], side: 'left' | 'right' }) => {
    const Icon = service.icon as React.ComponentType<{ size?: number, style?: any }>;
    let timer: any;
    const startTimer = () => {
      timer = setTimeout(() => handleLongPress(side), 600);
    };
    const clearTimer = () => clearTimeout(timer);

    return (
      <button
        onMouseDown={startTimer}
        onMouseUp={clearTimer}
        onMouseLeave={clearTimer}
        onTouchStart={startTimer}
        onTouchEnd={clearTimer}
        onClick={() => handleActionClick(service)}
        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white/20 hover:bg-white/30 transition-colors rounded-xl text-white text-[10px] font-bold border border-white/10 backdrop-blur-sm"
      >
        <Icon size={12} />
        <span>{service.name}</span>
      </button>
    );
  };

  const previewCardClass = "w-[28vw] min-w-[112px] max-w-[136px] h-[186px] rounded-[26px] border border-white/10 bg-[#18181d] shadow-[0_18px_45px_rgba(0,0,0,0.38)] opacity-55 scale-[0.92] blur-[0.1px]";

  const renderPreview = (side: 'left' | 'right') => (
    <Card className={previewCardClass}>
      <CardContent className="h-full p-4 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10" />
          <div className="w-10 h-4 rounded-full bg-white/10" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-3 w-16 bg-white/10 rounded-full ml-auto" />
          <div className="h-8 w-20 bg-white/10 rounded-2xl ml-auto" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-8 w-20 rounded-full bg-black/30 border border-white/10" />
          <div className="w-8 h-8 rounded-full border border-white/10" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-in fade-in-0 zoom-in-95 duration-500 px-4">
      <div className="relative flex items-center justify-center">
        <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 -rotate-[10deg] z-0">
          {renderPreview('left')}
        </div>

        <Card className="w-full max-w-[330px] h-[225px] overflow-hidden border-none shadow-[0_18px_50px_rgba(0,72,173,0.35)] rounded-[28px] bg-[#0048ad] text-white">
          <CardContent className="h-full p-5 flex flex-col justify-between relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_82%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.08),transparent_18%)]" />
            
            <div className="relative z-10 flex items-start justify-between w-full flex-row-reverse">
              <button
                type="button"
                onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white backdrop-blur-md border border-white/10"
              >
                {isBalanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>

              <div className="text-left flex flex-col items-start">
                <div className="text-[12px] font-bold text-white/80 mb-1">الرصيد الحالي</div>
                <div className="flex items-baseline justify-start gap-1.5 w-full" dir="ltr">
                  <span className="text-[13px] font-black text-white/90">ريال يمني</span>
                  <div className="text-[28px] font-black leading-none tracking-tight">
                    {isLoading ? <Skeleton className="h-8 w-24 bg-white/20" /> : isBalanceVisible ? balance.toLocaleString('en-US') : '•••••'}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-end justify-between gap-3 w-full mt-auto pt-4">
              <ActionButton service={rightAction} side="right" />
              <ActionButton service={leftAction} side="left" />
            </div>
          </CardContent>
        </Card>

        <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 rotate-[10deg] z-0">
          {renderPreview('right')}
        </div>
      </div>

      {/* نافذة اختيار الاختصارات المفضل */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center font-black">اختيار اختصار مفضل</DialogTitle>
            <DialogDescription className="text-center">
              اختر الخدمة التي تريد وضعها في {editingSide === 'left' ? 'الجهة اليمنى' : 'الجهة اليسرى'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4 overflow-y-auto max-h-[60vh] no-scrollbar">
            {availableServices.map((service) => {
              const ServiceIcon = service.icon;
              return (
                <Button
                  key={service.id}
                  variant="outline"
                  className="flex flex-col h-24 gap-2 rounded-2xl border-primary/10 hover:bg-primary/5 hover:border-primary/30"
                  onClick={() => selectService(service)}
                >
                  <ServiceIcon size={16} />
                  <span className="text-[10px] font-bold">{service.name}</span>
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="w-full rounded-2xl">إلغاء</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة مركز المدفوعات (Pop-up) مع خلفيات بيضاء للشعارات */}
      <Dialog open={isPaymentHubOpen} onOpenChange={setIsPaymentHubOpen}>
        <DialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl bg-[#F8FAFC] dark:bg-slate-950 outline-none [&>button]:hidden">
            <div className="bg-mesh-gradient p-8 text-center text-white relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
                <DialogHeader>
                    <div className="bg-white/20 p-4 rounded-[28px] w-16 h-16 mx-auto mb-4 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                        <CreditCard className="h-8 w-8 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-black text-white drop-shadow-md">المدفوعات</DialogTitle>
                    <DialogDescription className="text-xs text-white/70 font-bold mt-1 uppercase tracking-widest">اختر الخدمة المطلوبة</DialogDescription>
                </DialogHeader>
            </div>
            
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
                <Link href="/alwadi" prefetch={true} onClick={() => setIsPaymentHubOpen(false)} className="block w-full group">
                    <div className="w-full h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 shadow-sm group-hover:border-primary/20 group-hover:bg-primary/5 transition-all flex items-center justify-between px-6 text-right" dir="rtl">
                        <div className="flex items-center gap-4">
                            <div className="p-0.5 bg-white rounded-xl transition-colors overflow-hidden border border-muted w-10 h-10 shrink-0">
                                <div className="relative w-full h-full rounded-[10px] overflow-hidden">
                                  <Image src="https://i.postimg.cc/wjKrdNX2/images-(5).jpg" alt="الوادي" fill className="object-cover" />
                                </div>
                            </div>
                            <span className="font-black text-foreground">منظومة الوادي</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                            <LucideChevronLeft className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </Link>

                <Link href="/alsafaa" prefetch={true} onClick={() => setIsPaymentHubOpen(false)} className="block w-full group">
                    <div className="w-full h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-500/5 shadow-sm group-hover:border-orange-500/20 group-hover:bg-orange-500/5 transition-all flex items-center justify-between px-6 text-right" dir="rtl">
                        <div className="flex items-center gap-4">
                            <div className="p-0.5 bg-white rounded-xl transition-colors overflow-hidden border border-muted w-10 h-10 shrink-0">
                                <div className="relative w-full h-full rounded-[10px] overflow-hidden">
                                  <Image src="https://i.postimg.cc/nL2S7w6S/20260728-152016.jpg" alt="الصفاء" fill className="object-cover" />
                                </div>
                            </div>
                            <span className="font-black text-foreground">شبكة الصفاء الرقمية</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                            <LucideChevronLeft className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </Link>

                <Link href="/electricity" prefetch={true} onClick={() => setIsPaymentHubOpen(false)} className="block w-full group">
                    <div className="w-full h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-yellow-500/5 shadow-sm group-hover:border-yellow-500/20 group-hover:bg-yellow-500/5 transition-all flex items-center justify-between px-6 text-right" dir="rtl">
                        <div className="flex items-center gap-4">
                            <div className="p-0.5 bg-white rounded-xl transition-colors overflow-hidden border border-muted w-10 h-10 shrink-0">
                                <div className="relative w-full h-full rounded-[10px] overflow-hidden">
                                  <Image src="https://i.postimg.cc/3RbLf0J5/images-(6).jpg" alt="الكهرباء" fill className="object-cover" />
                                </div>
                            </div>
                            <span className="font-black text-foreground">سداد الكهرباء</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                            <LucideChevronLeft className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </Link>

                <Link href="/water" prefetch={true} onClick={() => setIsPaymentHubOpen(false)} className="block w-full group">
                    <div className="w-full h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/5 shadow-sm group-hover:border-blue-500/20 group-hover:bg-blue-500/5 transition-all flex items-center justify-between px-6 text-right" dir="rtl">
                        <div className="flex items-center gap-4">
                            <div className="p-0.5 bg-white rounded-xl transition-colors overflow-hidden border border-muted w-10 h-10 shrink-0">
                                <div className="relative w-full h-full rounded-[10px] overflow-hidden">
                                  <Image src="https://i.postimg.cc/FzMTNtL3/images-(7).jpg" alt="المياه" fill className="object-cover" />
                                </div>
                            </div>
                            <span className="font-black text-foreground">سداد المياه</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                            <LucideChevronLeft className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </Link>

                <div className="pt-4">
                    <DialogClose asChild>
                        <Button variant="ghost" className="w-full rounded-2xl font-black text-muted-foreground">إغلاق</Button>
                    </DialogClose>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
