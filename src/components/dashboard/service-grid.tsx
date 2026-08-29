'use client';

import {
  Wallet,
  History,
  Wifi,
  Smartphone,
  Heart,
  Gamepad2,
  ArrowLeftRight,
  ShoppingBag,
  CreditCard,
  WifiOff
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
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import Image from 'next/image';

type Service = {
  name: string;
  icon: any;
  href: string;
  requiresInternet?: boolean;
};

const ServiceItem = ({
  name,
  icon: Icon,
  index,
  href,
  isOffline,
  requiresInternet,
  onClick
}: Service & { index: number, isOffline: boolean, onClick?: () => void }) => {
  
  const isDisabled = isOffline && requiresInternet;

  const content = (
    <div 
      className={cn(
        "group flex flex-col items-center justify-center aspect-[1.6/1] rounded-[22px] border transition-all duration-300 active:scale-95 animate-in fade-in-0 zoom-in-95 relative",
        isDisabled 
          ? "border-red-500/40 bg-red-500/5 text-red-600 grayscale-[0.3]" 
          : "border-border/15 bg-white text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.05)] dark:bg-[#1b1b1f] dark:text-white dark:shadow-[0_10px_25px_rgba(0,0,0,0.28)]"
      )}
      style={{
        animationDelay: `${100 + index * 50}ms`,
        animationFillMode: 'backwards',
      }}
      onClick={isDisabled ? onClick : undefined}
    >
      <div className={cn(
          "mb-1 flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden",
          isDisabled ? "bg-red-500/10" : ""
      )}>
        {typeof Icon === 'string' ? (
             <div className="relative w-full h-full p-[14px]">
                <Image 
                    src={Icon} 
                    alt={name} 
                    fill 
                    className={cn("object-contain transition-transform group-hover:scale-110", isDisabled && "grayscale")} 
                />
             </div>
        ) : typeof Icon === 'function' ? (
             <Icon 
             className={cn("h-4 w-4 transition-transform", isDisabled ? "text-red-500" : "text-primary")} 
               style={{ strokeWidth: 2.5 }}
             />
        ) : (
            <Icon size={16} className="transition-transform group-hover:scale-110" />
        )}
      </div>
      <span className={cn("text-[11px] font-black text-center px-1 leading-tight", isDisabled && "text-red-700")}>{name}</span>
      {isDisabled && <WifiOff className="absolute top-2 right-2 w-2.5 h-2.5 text-red-500 opacity-60" />}
    </div>
  );

  if (isDisabled) {
    return <div className="w-full cursor-pointer">{content}</div>;
  }

  return (
    <Link href={href} className="w-full" prefetch={true}>
      {content}
    </Link>
  );
};

export function ServiceGrid() {
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
    { name: 'تسديد رصيد', icon: '/icons/rsed.png', href: '/telecom-services', requiresInternet: true },
    { name: 'الشبكات', icon: '/icons/shbkat.png', href: '/services', requiresInternet: false },
    { name: 'المدفوعات', icon: '/icons/mddfwt.png', href: '/payment-services', requiresInternet: true },
    { name: 'تحويل لمشترك', icon: '/icons/tahwel.png', href: '/transfer', requiresInternet: true },
    { name: 'غذي حسابك', icon: '/icons/tadia.png', href: '/top-up', requiresInternet: true },
    { name: 'معرض الألعاب', icon: '/icons/alab.png', href: '/games', requiresInternet: true },
    { name: 'المفضلة', icon: '/icons/mfdaa.png', href: '/favorites', requiresInternet: false },
    { name: 'سجل العمليات', icon: '/icons/rassed.png', href: '/transactions', requiresInternet: true },
    { name: 'متجر ستار ميديا', icon: '/icons/slaa.png', href: '/store', requiresInternet: true },
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
                }
            }}
          />
        ))}
      </div>

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
    </div>
  );
}
