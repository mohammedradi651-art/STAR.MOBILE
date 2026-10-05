'use client';

import { Home, Users, User, Heart, Smartphone, History, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import React, { useState, useEffect } from 'react';
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
  { id: 'req', name: 'الطلبات', icon: ClipboardList, href: '/admin-requests', position: 'side' },
  { id: 'profile', name: 'الملف', icon: User, href: '/account', position: 'side' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isUserAdmin = mounted && (user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2');
  const navItems = isUserAdmin ? adminNavItems : userNavItems;

  const getActiveState = (href: string) => {
    if (href === '/login') return pathname === '/login' || pathname === '/';
    if (href === '/admin-requests') return pathname.startsWith('/admin-requests');
    return pathname.startsWith(href);
  };

  const sideItemsStart = navItems.slice(0, 2);
  const centerItem = navItems[2];
  const sideItemsEnd = navItems.slice(3, 5);

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = getActiveState(item.href);

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
