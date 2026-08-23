'use client';

import {
  Wallet,
  SatelliteDish,
  History,
  Wifi,
  Smartphone,
  Heart,
  Gamepad2,
  ArrowLeftRight,
  ShoppingBag,
  CreditCard,
  ChevronLeft as LucideChevronLeft,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import Image from 'next/image';

type Service = {
  name: string;
  icon: any;
  href?: string;
  isTrigger?: boolean;
  id?: string;
  requiresInternet?: boolean;
};

const ServiceItem = ({
  name,
  icon: Icon,
  index,
  href,
  isTrigger,
  onClick,
  isOffline,
  requiresInternet
}: Service & { index: number, onClick?: () => void, isOffline: boolean }) => {
  
  const isDisabled = isOffline && requiresInternet;

  const content = (
    <div 
      className={cn(
        "group flex flex-col items-center justify-center aspect-[1.6/1] rounded-[22px] border transition-all duration-300 active:scale-95 animate-in fade-in-0 zoom-in-95",
        isDisabled 
          ? "border-red-500/20 bg-red-500/5 text-red-700 opacity-60 grayscale-[0.5]" 
          : "border-border/15 bg-white text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.05)] dark:bg-[#1b1b1f] dark:text-white dark:shadow-[0_10px_25px_rgba(0,0,0,0.28)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      )}
      style={{
        animationDelay: `${100 + index * 50}ms`,
        animationFillMode: 'backwards',
      }}
      onClick={isDisabled ? onClick : (isTrigger ? onClick : undefined)}
    >
      <div className={cn(
          "mb-1.5 flex h-8 w-8 items-center justify-center rounded-2xl overflow-hidden",
          isDisabled ? "bg-red-500/10" : "bg-muted/20 dark:bg-white/5"
      )}>
        {typeof Icon === 'function' ? (
             <Icon 
             className={cn("h-5 w-5 transition-transform group-hover:scale-110", isDisabled && "text-red-600")} 
               style={{ 
                   strokeWidth: 2,
                   stroke: 'currentColor'
               }}
             />
        ) : (
            <Icon size={20} className="transition-transform group-hover:scale-110" />
        )}
      </div>
      <span className="text-[11px] font-bold text-center px-1 leading-tight">{name}</span>
      {isDisabled && <WifiOff className="absolute top-2 right-2 w-2.5 h-2.5 text-red-400" />}
    </div>
  );

  if (isDisabled) {
    return <div className="w-full cursor-pointer">{content}</div>;
  }

  if (isTrigger) {
    return <div className="w-full cursor-pointer">{content}</div>;
  }

  return (
    <Link href={href || '#'} className="w-full" prefetch={true}>
      {content}
    </Link>
  );
};

export function ServiceGrid() {
  const [isPaymentHubOpen, setIsPaymentHubOpen] = useState(false);
  const [isOfflineAlertOpen, setIsOfflineAlertOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
        window.removeEventListener('online', handleStatus);
        window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const services: Service[] = [
    { name: 'تسديد رصيد', icon: Smartphone, href: '/telecom-services', requiresInternet: true },
    { name: 'الشبكات', icon: Wifi, href: '/services', requiresInternet: false },
    { id: 'payments', name: 'المدفوعات', icon: CreditCard, isTrigger: true, onClick: () => setIsPaymentHubOpen(true), requiresInternet: true },
    { name: 'تحويل لمشترك', icon: ArrowLeftRight, href: '/transfer', requiresInternet: true },
    { name: 'غذي حسابك', icon: Wallet, href: '/top-up', requiresInternet: true },
    { name: 'معرض الألعاب', icon: Gamepad2, href: '/games', requiresInternet: true },
    { name: 'المفضلة', icon: Heart, href: '/favorites', requiresInternet: false },
    { name: 'سجل العمليات', icon: History, href: '/transactions', requiresInternet: true },
    { name: 'متجر ستار ميديا', icon: ShoppingBag, href: '/store', requiresInternet: true },
  ];

  return (
    <div className="relative bg-transparent mt-[-10px] pt-1 pb-2 space-y-3 px-4">
      <div className="grid grid-cols-3 gap-2.5">
        {services.map((service, index) => (
          <ServiceItem 
            key={service.name} 
            {...service} 
            index={index} 
            isOffline={isOffline}
            onClick={() => {
                if (isOffline && service.requiresInternet) {
                    setIsOfflineAlertOpen(true);
                } else if (service.isTrigger && service.onClick) {
                    service.onClick();
                }
            }}
          />
        ))}
      </div>

      {/* تنبيه انقطاع الإنترنت */}
      <Dialog open={isOfflineAlertOpen} onOpenChange={setIsOfflineAlertOpen}>
          <DialogContent className="rounded-[32px] max-sm text-center p-8 border-none shadow-2xl bg-white dark:bg-slate-900 outline-none">
              <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <WifiOff className="w-10 h-10 text-red-600 animate-pulse" />
              </div>
              <DialogTitle className="text-xl font-black text-foreground">عذراً.. لا يوجد إنترنت</DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground mt-2 leading-relaxed">
                  هذا القسم يحتاج إلى اتصال نشط بالإنترنت للعمل. يمكنك حالياً استخدام قسم "الشبكات" فقط.
              </DialogDescription>
              <Button onClick={() => setIsOfflineAlertOpen(false)} className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black mt-6 border-none shadow-lg">حسناً</Button>
          </DialogContent>
      </Dialog>

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

                {/* باقي خدمات الدفع تفتح فقط بالنت */}
                {['alsafaa', 'electricity', 'water'].map((s) => (
                    <div key={s} onClick={() => { if(isOffline) setIsOfflineAlertOpen(true); else window.location.href = `/${s}` }} className="w-full h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 shadow-sm hover:border-primary/20 transition-all flex items-center justify-between px-6 text-right cursor-pointer" dir="rtl">
                         <div className="flex items-center gap-4">
                            <div className="p-0.5 bg-white rounded-xl transition-colors overflow-hidden border border-muted w-10 h-10 shrink-0 opacity-50">
                                <div className="relative w-full h-full rounded-[10px] overflow-hidden">
                                  <Image src={`https://i.postimg.cc/${s === 'alsafaa' ? 'nL2S7w6S/20260728-152016.jpg' : s === 'electricity' ? '3RbLf0J5/images-(6).jpg' : 'FzMTNtL3/images-(7).jpg'}`} alt={s} fill className="object-cover" />
                                </div>
                            </div>
                            <span className="font-black text-foreground/60">{s === 'alsafaa' ? 'شبكة الصفاء' : s === 'electricity' ? 'سداد الكهرباء' : 'سداد المياه'}</span>
                        </div>
                        <WifiOff className="w-4 h-4 text-red-400 opacity-40" />
                    </div>
                ))}

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
