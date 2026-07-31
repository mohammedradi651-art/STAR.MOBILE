
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
  Zap,
  Globe,
  ChevronLeft as LucideChevronLeft,
  Droplets
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
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
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Service = {
  name: string;
  icon: any;
  href?: string;
  isTrigger?: boolean;
  id?: string;
};

const ServiceItem = ({
  name,
  icon: Icon,
  index,
  href,
  isTrigger,
  onClick,
}: Service & { index: number, onClick?: () => void }) => {
  const content = (
    <div 
      className="group flex flex-col items-center justify-center aspect-[1.6/1] rounded-[22px] border border-border/15 bg-white text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.05)] dark:bg-[#1b1b1f] dark:text-white dark:shadow-[0_10px_25px_rgba(0,0,0,0.28)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 active:scale-95 animate-in fade-in-0 zoom-in-95"
      style={{
        animationDelay: `${100 + index * 50}ms`,
        animationFillMode: 'backwards',
      }}
      onClick={isTrigger ? onClick : undefined}
    >
      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-muted/20 dark:bg-white/5 overflow-hidden">
        {typeof Icon === 'function' ? (
             <Icon 
             className="h-5 w-5 transition-transform group-hover:scale-110" 
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
    </div>
  );

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

  const services: Service[] = [
    { name: 'تسديد رصيد', icon: Smartphone, href: '/telecom-services' },
    { name: 'الشبكات', icon: Wifi, href: '/services' },
    { id: 'payments', name: 'المدفوعات', icon: CreditCard, isTrigger: true, onClick: () => setIsPaymentHubOpen(true) },
    { name: 'تحويل لمشترك', icon: ArrowLeftRight, href: '/transfer' },
    { name: 'غذي حسابك', icon: Wallet, href: '/top-up' },
    { name: 'معرض الألعاب', icon: Gamepad2, href: '/games' },
    { name: 'المفضلة', icon: Heart, href: '/favorites' },
    { name: 'سجل العمليات', icon: History, href: '/transactions' },
    { name: 'متجر ستار ميديا', icon: ShoppingBag, href: '/store' },
  ];

  return (
    <div className="relative bg-transparent mt-[-10px] pt-1 pb-2 space-y-3 px-4">
      <div className="grid grid-cols-3 gap-2.5">
        {services.map((service, index) => (
          <ServiceItem 
            key={service.name} 
            {...service} 
            index={index} 
          />
        ))}
      </div>

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

      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
