"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Smartphone, ArrowLeftRight, SatelliteDish, Wifi, History, Wallet, MessageCircleQuestion, Heart, Gamepad2, Globe, PhoneCall, Zap, CreditCard, Droplets, ChevronLeft as LucideChevronLeft, WifiOff } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
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
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";

const Icon4G = ({ size }: { size?: number }) => (
  <span className="font-black leading-none" style={{ fontSize: size ? `${size * 0.8}px` : "10px" }}>
    4G
  </span>
);

const AlsafaaIcon = ({ className, size, style }: { className?: string; size?: number; style?: React.CSSProperties }) => (
  <div className={cn("relative overflow-hidden rounded-xl", className)} style={{ width: size, height: size, ...style }}>
    <Image src="https://i.postimg.cc/nL2S7w6S/20260728-152016.jpg" alt="شبكة الصفاء الرقمية" fill className="object-cover" />
  </div>
);

const availableServices = [
  { id: "yemen-mobile", name: "يمن موبايل", icon: PhoneCall, href: "/yemen-mobile", requiresInternet: true },
  { id: "yemen-4g", name: "يمن فورجي", icon: Icon4G, href: "/yemen-4g", requiresInternet: true },
  { id: "pay-bills", name: "تسديد رصيد", icon: Smartphone, href: "/telecom-services", requiresInternet: true },
  { id: "digital-cards", name: "الشبكات", icon: Wifi, href: "/services", requiresInternet: false },
  { id: "payments", name: "المدفوعات", icon: CreditCard, href: "/payment-services", requiresInternet: true },
  { id: "alwadi", name: "منظومة الوادي", icon: SatelliteDish, href: "/alwadi", requiresInternet: true },
  { id: "alsafaa", name: "شبكة الصفاء الرقمية", icon: AlsafaaIcon, href: "/alsafaa", requiresInternet: true },
  { id: "withdraw", name: "غذي حسابك", icon: Wallet, href: "/top-up", requiresInternet: true },
  { id: "games", name: "شدات ببجي", icon: Gamepad2, href: "/games", requiresInternet: true },
  { id: "favorites", name: "المفضلة", icon: Heart, href: "/favorites", requiresInternet: false },
  { id: "statement", name: "سجل العمليات", icon: History, href: "/transactions", requiresInternet: true },
  { id: "support", name: "الدعم الفني", icon: MessageCircleQuestion, href: "/support", requiresInternet: true },
];

type UserProfile = {
  balance?: number;
};

export function BalanceCard() {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [leftAction, setLeftAction] = useState(availableServices.find((s) => s.id === "payments") || availableServices[4]);
  const [rightAction, setRightAction] = useState(availableServices.find((s) => s.id === "pay-bills") || availableServices[2]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingSide, setEditingSide] = useState<"left" | "right" | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);

    setIsBalanceVisible(document.documentElement.classList.contains("dark"));

    const savedLeftId = localStorage.getItem("balance_card_left_id");
    const savedRightId = localStorage.getItem("balance_card_right_id");

    if (savedLeftId) {
      const service = availableServices.find((s) => s.id === savedLeftId);
      if (service) setLeftAction(service);
    }
    if (savedRightId) {
      const service = availableServices.find((s) => s.id === savedRightId);
      if (service) setRightAction(service);
    }

    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const userDocRef = useMemoFirebase(() => (user && firestore ? doc(firestore, "users", user.uid) : null), [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const balance = userProfile?.balance ?? 0;
  const isLoading = isUserLoading || isProfileLoading;

  const handleLongPress = (side: "left" | "right") => {
    setEditingSide(side);
    setIsConfigOpen(true);
  };

  const handleActionClick = (service: any) => {
    if (isOffline && service.requiresInternet) {
      return;
    }
    router.push(service.href);
  };

  const selectService = (service: (typeof availableServices)[0]) => {
    if (editingSide === "left") {
      setLeftAction(service);
      localStorage.setItem("balance_card_left_id", service.id);
    } else {
      setRightAction(service);
      localStorage.setItem("balance_card_right_id", service.id);
    }
    setIsConfigOpen(false);
  };

  const ActionButton = ({ service, side }: { service: (typeof availableServices)[0]; side: "left" | "right" }) => {
    const Icon = service.icon as React.ComponentType<{ size?: number; style?: any }>;
    const isDisabled = isOffline && service.requiresInternet;

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
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-2 px-3 transition-all rounded-xl text-white text-[10px] font-bold border backdrop-blur-sm",
          isDisabled ? "bg-red-500/20 border-red-500/30 text-red-200" : "bg-white/20 hover:bg-white/30 border-white/10"
        )}
      >
        <Icon size={12} className={cn(isDisabled && "text-red-400")} />
        <span>{service.name}</span>
        {isDisabled && <WifiOff className="w-2 h-2 ml-1 text-red-400 opacity-50" />}
      </button>
    );
  };

  const renderPreview = (side: "left" | "right") => (
    <Card className="w-[28vw] min-w-[112px] max-w-[136px] h-[186px] rounded-[26px] border border-white/10 bg-[#18181d] shadow-[0_18px_45px_rgba(0,0,0,0.38)] opacity-55 scale-[0.92] blur-[0.1px]">
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
        <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 -rotate-[10deg] z-0">{renderPreview("left")}</div>

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
                    {isLoading ? <Skeleton className="h-8 w-24 bg-white/20" /> : isBalanceVisible ? balance.toLocaleString("en-US") : "•••••"}
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

        <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 rotate-[10deg] z-0">{renderPreview("right")}</div>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-center font-black">اختيار اختصار مفضل</DialogTitle>
            <DialogDescription className="text-center">
              اختر الخدمة التي تريد وضعها في {editingSide === "left" ? "الجهة اليمنى" : "الجهة اليسرى"}
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
              <Button variant="ghost" className="w-full rounded-2xl font-black">
                إلغاء
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}