'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BalanceCard } from '@/components/dashboard/balance-card';
import { ServiceGrid } from '@/components/dashboard/service-grid';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { Header } from '@/components/layout/header';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Link from 'next/link';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { WifiOff, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type UserProfile = {
  accountType?: 'user' | 'network-owner';
};

const DashboardHero = () => {
  const plugin = useRef(
    Autoplay({ delay: 7000, stopOnInteraction: false })
  );
  const banners = ["/kh.png"];
  return (
    <div className="px-4 mt-2 pb-0"> 
      <Carousel plugins={[plugin.current]} className="w-full" opts={{ loop: true, direction: 'rtl' }}>
        <CarouselContent>
          {banners.map((src, index) => (
            <CarouselItem key={index}>
              <div className="relative w-full h-[140px] flex items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                <Image src={src} alt={`بانر ${index + 1}`} fill className="object-contain" priority={index === 0} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOffline(!navigator.onLine);
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
        window.removeEventListener('online', handleStatus);
        window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    // في وضع الأوفلاين نسمح للمستخدم بالبقاء في الصفحة دون توجيه
    if (mounted && !isUserLoading && !user && !isOffline) {
      router.push('/');
    }
  }, [user, isUserLoading, router, mounted, isOffline]);

  if (!mounted) return null;

  // إذا كنا متصلين ومازال يحمل نُظهر الهيكل المؤقت
  if (isUserLoading && !isOffline) {
    return (
      <div className="flex flex-col h-full bg-background animate-pulse p-4 space-y-6">
        <div className="h-16 w-full bg-muted rounded-2xl" />
        <div className="h-48 w-full bg-muted rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {isOffline && (
          <div className="absolute top-[80px] left-0 right-0 z-[1000] px-4 pointer-events-none animate-in slide-in-from-top-4 duration-700">
              <div className="bg-red-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border-2 border-white/20">
                  <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-1.5 rounded-lg"><WifiOff className="w-4 h-4" /></div>
                      <p className="text-[11px] font-black">وضع الأوفلاين نشط (تعمل الشبكات فقط)</p>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-white/50 animate-pulse" />
              </div>
          </div>
      )}

      <Header />
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36 no-scrollbar">
        <div className={cn("space-y-4", isOffline && "grayscale-[0.2]")}>
          <BalanceCard />
          <PWAInstallPrompt />
          <DashboardHero />
          {userProfile?.accountType === 'network-owner' && (
             <div className="grid grid-cols-2 gap-3 px-4">
                <Link href="/my-network" className="block">
                    <Card className="rounded-[24px] border-none shadow-sm bg-card cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98]">
                    <CardContent className="p-4 text-center font-bold text-primary">إدارة شبكتي</CardContent>
                    </Card>
                </Link>
                <Link href="/my-network/withdraw" className="block">
                    <Card className="rounded-[24px] border-none shadow-sm bg-card cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98]">
                    <CardContent className="p-4 text-center font-bold text-primary">سحب الأرباح</CardContent>
                    </Card>
                </Link>
            </div>
          )}
          <ServiceGrid />
          {!isOffline && <RecentTransactions />}
        </div>
      </div>
    </div>
  );
}
