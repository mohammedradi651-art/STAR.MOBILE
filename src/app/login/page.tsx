
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
import { Skeleton } from '@/components/ui/skeleton';

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
      <Carousel
        plugins={[plugin.current]}
        className="w-full"
        opts={{
          loop: true,
          direction: 'rtl'
        }}
      >
        <CarouselContent>
          {banners.map((src, index) => (
            <CarouselItem key={index}>
              <div className="relative w-full h-[140px] flex items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                <Image 
                  src={src} 
                  alt={`بانر ${index + 1}`} 
                  fill 
                  className="object-contain" 
                  priority={index === 0}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

const OwnerDashboard = () => (
  <div className="space-y-4">
    <PWAInstallPrompt />
    <DashboardHero />
    <div className="grid grid-cols-2 gap-3 px-4">
      <Link href="/my-network" className="block">
        <Card className="rounded-[24px] border-border/20 shadow-sm bg-card/80 backdrop-blur-sm cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98]">
          <CardContent className="p-4 text-center font-bold text-primary">إدارة شبكتي</CardContent>
        </Card>
      </Link>
      <Link href="/my-network/withdraw" className="block">
        <Card className="rounded-[24px] border-border/20 shadow-sm bg-card/80 backdrop-blur-sm cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98]">
          <CardContent className="p-4 text-center font-bold text-primary">سحب الأرباح</CardContent>
        </Card>
      </Link>
    </div>
    <ServiceGrid />
    <RecentTransactions />
  </div>
);

const UserDashboard = () => (
  <div className="space-y-4">
    <PWAInstallPrompt />
    <DashboardHero />
    <ServiceGrid />
    <RecentTransactions />
  </div>
);

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router, mounted]);

  if (!mounted || isUserLoading) {
    return (
      <div className="flex flex-col h-full bg-background animate-pulse p-4 space-y-6">
        <div className="h-16 w-full bg-muted rounded-2xl" />
        <div className="h-48 w-full bg-muted rounded-[28px]" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-muted rounded-2xl" />
          <div className="h-20 bg-muted rounded-2xl" />
          <div className="h-20 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-36 no-scrollbar">
        <div className={cn("space-y-4")}>
          <BalanceCard />
          {userProfile?.accountType === 'network-owner' ? <OwnerDashboard /> : <UserDashboard />}
        </div>
      </div>
    </div>
  );
}
