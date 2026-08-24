'use client';

import React, { useState, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  CreditCard,
  WifiOff
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const paymentServices = [
  {
    name: 'منظومة الوادي',
    logo: 'https://i.postimg.cc/wjKrdNX2/images-(5).jpg',
    href: '/alwadi',
    description: 'تجديد اشتراكات منظومة الوادي مباشرة',
    color: '#0048ad',
    accent: 'bg-primary/5'
  },
  {
    name: 'شبكة الصفاء الرقمية',
    logo: 'https://i.postimg.cc/nL2S7w6S/20260728-152016.jpg',
    href: '/alsafaa',
    description: 'استعلام عن اشتراك شبكة الصفاء',
    color: '#0048ad',
    accent: 'bg-primary/5'
  },
  {
    name: 'سداد الكهرباء',
    logo: 'https://i.postimg.cc/3RbLf0J5/images-(6).jpg',
    href: '/electricity',
    description: 'سداد فواتير الكهرباء وادي حضرموت',
    color: '#ea580c',
    accent: 'bg-orange-500/5'
  },
  {
    name: 'سداد المياه',
    logo: 'https://i.postimg.cc/FzMTNtL3/images-(7).jpg',
    href: '/water',
    description: 'سداد فواتير المياه والصرف الصحي',
    color: '#2563eb',
    accent: 'bg-blue-500/5'
  },
];

export default function PaymentServicesPage() {
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

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
      <SimpleHeader title="المدفوعات" />
      
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="bg-mesh-gradient pt-6 pb-10 px-6 rounded-b-[40px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-3">
                <div className="bg-white/20 p-3 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <CreditCard className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">المدفوعات</h2>
                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">الخدمات العامة والمنظومات</p>
                </div>
            </div>
        </div>

        {/* Services List */}
        <div className="px-4 mt-6 pb-10 space-y-3">
          {paymentServices.map((service, index) => (
            <div key={service.name} className="block">
              <Link 
                href={isOffline ? '#' : service.href} 
                className={cn(
                    "block cursor-pointer border-none shadow-md rounded-[28px] overflow-hidden group hover:shadow-lg transition-all active:scale-[0.98] animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                    isOffline ? "bg-red-500/5 grayscale-[0.5] opacity-70 border-red-500/20 border" : "bg-card"
                )}
                style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className={cn("p-0.5 rounded-[18px] shrink-0 border border-muted/50 shadow-inner", service.accent)}>
                        <div className="relative h-14 w-14 overflow-hidden rounded-[16px] shadow-sm">
                            <Image
                                src={service.logo}
                                alt={`${service.name} logo`}
                                fill
                                className="object-cover transition-transform group-hover:scale-110 duration-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 text-right overflow-hidden">
                        <h4 className={cn("font-black text-base transition-colors mb-0.5", isOffline ? "text-red-700" : "text-foreground group-hover:text-primary")}>
                            {service.name}
                        </h4>
                        <p className={cn("text-[10px] font-bold leading-relaxed line-clamp-1 opacity-80", isOffline ? "text-red-600/60" : "text-muted-foreground")}>
                            {service.description}
                        </p>
                    </div>

                    <div className="p-2 bg-muted/50 rounded-xl group-hover:bg-primary/10 transition-colors">
                        {isOffline ? <WifiOff className="h-4 w-4 text-red-500" /> : <ChevronLeft className="h-4 w-4 text-primary" />}
                    </div>
                </CardContent>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}