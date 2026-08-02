'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * شاشة الترحيب المحسنة (Splash Screen)
 * تم تبسيطها لتكون سريعة جداً ولا تستهلك موارد المعالج.
 */
export function SplashScreen({ 
  onComplete, 
  isAppReady 
}: { 
  onComplete: () => void; 
  isAppReady: boolean;
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // إذا كان التطبيق جاهزاً، نخرج فوراً بعد تأخير بسيط للهوية
    if (isAppReady) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 400);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAppReady, onComplete]);

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-mesh-gradient transition-all duration-500",
        isExiting ? "opacity-0 scale-105 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="relative flex flex-col items-center text-center space-y-6 px-6 max-w-sm w-full">
        
        {/* الشعار - تحميل فوري */}
        <div className="relative w-24 h-24 mb-2">
            <div className="absolute inset-0 bg-white/10 rounded-[35px] blur-xl animate-pulse" />
            <div className="relative w-full h-full overflow-hidden rounded-[30px] border-4 border-white/20 shadow-2xl bg-white">
                <Image 
                    src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                    alt="Star Mobile Logo" 
                    fill
                    className="object-cover"
                    priority
                />
            </div>
        </div>

        <div className="space-y-1">
            <h1 className="text-2xl font-black text-white drop-shadow-md">ستار موبايل</h1>
            <p className="text-white/60 text-xs font-bold tracking-widest uppercase">السرعة والأمان</p>
        </div>

        {/* مؤشر تحميل بسيط وسريع بخلاف Lottie */}
        <div className="pt-8">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
