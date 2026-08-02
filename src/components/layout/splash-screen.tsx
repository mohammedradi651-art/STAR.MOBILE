'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * شاشة الترحيب الملكية (Luxury Splash Screen)
 * تم تحديث الألوان لتكون بيضاء نقية مع شريط انتظار نحيف.
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
      }, 1800); 
      return () => clearTimeout(timer);
    }
  }, [isAppReady, onComplete]);

  const Lottie = LottieComponent;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-white transition-all duration-700 ease-in-out",
        isExiting ? "opacity-0 scale-110 pointer-events-none" : "opacity-100"
      )}
      style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}
    >
      <div className="relative flex flex-col items-center justify-center w-full max-w-sm animate-in fade-in zoom-in-95 duration-1000">
        
        {/* الشعار المتحرك في المنتصف */}
        <div className="relative w-44 h-44 flex items-center justify-center mb-10">
            {Lottie && animationData && (
                <Lottie 
                    animationData={animationData} 
                    loop={true} 
                    style={{ width: '100%', height: '100%' }} 
                />
            )}
        </div>

        {/* شريط الانتظار النحيف والأنيق في الأسفل */}
        <div className="w-40 h-[2px] bg-slate-100 rounded-full overflow-hidden relative shadow-sm">
            <div className="absolute top-0 left-0 h-full bg-[#0048ad] rounded-full animate-progress-line shadow-[0_0_10px_rgba(0,72,173,0.5)]" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress-line {
            0% { width: 0%; left: 0%; }
            50% { width: 70%; left: 15%; }
            100% { width: 0%; left: 100%; }
        }
        .animate-progress-line {
            animation: progress-line 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
