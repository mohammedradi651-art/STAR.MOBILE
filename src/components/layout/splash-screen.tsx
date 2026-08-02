'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * شاشة الترحيب الملكية (Luxury Splash Screen)
 * تم استبدال next/dynamic بنظام تحميل يدوي لتجنب أخطاء Turbopack.
 */
export function SplashScreen({ 
  onComplete, 
  isAppReady 
}: { 
  onComplete: () => void; 
  isAppReady: boolean;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [LottieComponent, setLottieComponent] = useState<any>(null);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // تحميل المكتبة والبيانات في جهة المتصفح فقط وبشكل مستقل
    const loadAssets = async () => {
        try {
            const [lottieMod, animRes] = await Promise.all([
                import('lottie-react'),
                fetch('/TH.json')
            ]);
            setLottieComponent(() => lottieMod.default);
            setAnimationData(await animRes.json());
        } catch (err) {
            console.error("Lottie load error:", err);
        }
    };

    loadAssets();

    // التوجيه للخروج بمجرد جاهزية التطبيق
    if (isAppReady) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 500); 
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [isAppReady, onComplete]);

  const Lottie = LottieComponent;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-gradient-to-b from-white via-white to-slate-50 transition-all duration-700 ease-in-out",
        isExiting ? "opacity-0 scale-110 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="relative flex flex-col items-center justify-center w-full max-w-sm animate-in fade-in zoom-in-95 duration-1000">
        
        {/* الشعار المتحرك */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-8">
            {Lottie && animationData && (
                <Lottie 
                    animationData={animationData} 
                    loop={true} 
                    style={{ width: '100%', height: '100%' }} 
                />
            )}
        </div>

        {/* شريط الانتظار النحيف والأنيق */}
        <div className="w-32 h-[3px] bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
            <div className="absolute top-0 left-0 h-full bg-[#0048ad] rounded-full animate-progress-line shadow-[0_0_8px_rgba(0,72,173,0.4)]" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress-line {
            0% { width: 0%; left: 0%; }
            50% { width: 60%; left: 20%; }
            100% { width: 0%; left: 100%; }
        }
        .animate-progress-line {
            animation: progress-line 1.8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
