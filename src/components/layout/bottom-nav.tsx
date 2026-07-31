'use client';

import { Home, Users, User, Heart, Smartphone, History, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// تعريف العناصر حسب الدور - المركز دائماً للمفضلة مع أيقونة القلب
const userNavItems = [
  { id: 'home', name: 'الرئيسية', icon: Home, href: '/login', position: 'side' },
  { id: 'services', name: 'السداد', icon: Smartphone, href: '/telecom-services', position: 'side' },
  { id: 'favorites', name: 'المفضلة', icon: Heart, href: '/favorites', position: 'center' },
  { id: 'reports', name: 'العمليات', icon: History, href: '/transactions', position: 'side' },
  { id: 'profile', name: 'حسابي', icon: User, href: '/account', position: 'side' },
];

const adminNavItems = [
  { id: 'home', name: 'الرئيسية', icon: Home, href: '/login', position: 'side' },
  { id: 'users', name: 'الإدارة', icon: Users, href: '/users', position: 'side' },
  { id: 'favorites', name: 'المفضلة', icon: Heart, href: '/favorites', position: 'center' },
  { id: 'req', name: 'تحويل', icon: TrendingUp, href: '/card-sales-reports', position: 'side' },
  { id: 'profile', name: 'الملف', icon: User, href: '/account', position: 'side' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';
  const navItems = isUserAdmin ? adminNavItems : userNavItems;

  const getActiveState = (href: string) => {
    if (href === '/login') return pathname === '/login';
    if (href === '/renewal-requests') return pathname.startsWith('/renewal-requests') || pathname.startsWith('/withdrawal-requests') || pathname.startsWith('/bill-payment-requests') || pathname.startsWith('/store-orders');
    if (href === '/card-sales-reports') return pathname.startsWith('/card-sales-reports');
    return pathname.startsWith(href);
  };

  // جلب عدد الطلبات المعلقة للمدير فقط
  const renewalRequestsQuery = useMemoFirebase(
    () => firestore && isUserAdmin ? query(collection(firestore, 'renewalRequests'), where('status', '==', 'pending')) : null,
    [firestore, isUserAdmin]
  );
  const withdrawalRequestsQuery = useMemoFirebase(
    () => firestore && isUserAdmin ? query(collection(firestore, 'withdrawalRequests'), where('status', '==', 'pending')) : null,
    [firestore, isUserAdmin]
  );
  const { data: renewalRequests } = useCollection<any>(renewalRequestsQuery);
  const { data: withdrawalRequests } = useCollection<any>(withdrawalRequestsQuery);
  const totalPending = (renewalRequests?.length || 0) + (withdrawalRequests?.length || 0);

  if (isUserLoading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 px-4 pointer-events-none">
        <div className="w-full max-w-[470px] h-[78px] bg-background/90 dark:bg-[#111114]/90 backdrop-blur-2xl rounded-[36px] border border-border/20 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] flex items-center justify-around px-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-9 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const sideItemsStart = navItems.slice(0, 2);
  const centerItem = navItems[2];
  const sideItemsEnd = navItems.slice(3, 5);

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = getActiveState(item.href);
    const isRequests = item.id === 'req';
    // لا نحتاج لعرض الإشعار الأحمر على اختصار التحويل الجديد
    const showBadge = false;

    return (
      <Link
        href={item.href}
        className={cn(
          "flex flex-col items-center justify-center transition-all duration-300 relative group flex-1",
                 isActive ? "text-[#0048ad]" : "text-muted-foreground/55 hover:text-foreground"
        )}
      >
        <div className="relative">
          <item.icon className={cn("h-5 w-5 transition-transform duration-300", isActive ? "scale-110 stroke-[2.5px]" : "group-hover:scale-110")} />
          {showBadge && (
            <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white text-[8px] font-black border-2 border-background shadow-sm">
              {totalPending > 9 ? '+9' : totalPending}
            </span>
          )}
        </div>
        <span className={cn(
          "text-[10px] font-bold mt-1 transition-all duration-300",
          isActive ? "opacity-100" : "opacity-70"
        )}>
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-4 px-4">
      <div className="w-full max-w-[470px] relative pointer-events-auto select-none">
        <div className="relative h-[96px] flex items-end pb-3 px-2">
          <div className="absolute bottom-0 left-0 right-0 h-[76px] rounded-[36px] bg-background/90 dark:bg-[#111114]/92 backdrop-blur-2xl border border-border/20 shadow-[0_-14px_40px_rgba(0,0,0,0.12)]" />

          <div className="relative z-10 flex flex-1 justify-around items-center h-14 pr-1">
            {sideItemsStart.map(item => <NavItem key={item.id} item={item} />)}
          </div>

          <div className="relative z-20 w-20 flex justify-center h-20 -translate-y-5">
            <Link href={centerItem.href} className="group relative">
                <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center shadow-[0_14px_28px_rgba(0,0,0,0.28)] transition-all duration-500 active:scale-90 relative overflow-hidden",
                    "bg-[#0048ad]"
                )}>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <centerItem.icon className={cn(
                        "h-7 w-7 text-white transition-transform duration-500",
                        pathname.startsWith(centerItem.href) ? "scale-110 fill-white" : "group-hover:scale-110"
                    )} />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-black/15 blur-md rounded-full" />
            </Link>
          </div>

          <div className="relative z-10 flex flex-1 justify-around items-center h-14 pl-1">
            {sideItemsEnd.map(item => <NavItem key={item.id} item={item} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
