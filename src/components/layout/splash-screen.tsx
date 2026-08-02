'use client';

import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { cn } from '@/lib/utils';

/**
 * شاشة الترحيب الملكية (Luxury Splash Screen)
 * تعرض الشعار المتحرك "لحاله" مع خلفية بيضاء متدرجة وشريط انتظار نحيف.
 */
export function SplashScreen({ 
  onComplete, 
  isAppReady 
}: { 
  onComplete: () => void; 
  isAppReady: boolean;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // جلب ملف الـ Lottie للشعار المتحرك
    fetch('/TH.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Lottie load error:", err));

    // التوجيه للخروج بمجرد جاهزية التطبيق
    if (isAppReady) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 500); // وقت الأنيميشن النهائي للخروج
      }, 2000); // مدة بقاء الشعار للاستمتاع بالفخامة
      return () => clearTimeout(timer);
    }
  }, [isAppReady, onComplete]);

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-gradient-to-b from-white via-white to-slate-50 transition-all duration-700 ease-in-out",
        isExiting ? "opacity-0 scale-110 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="relative flex flex-col items-center justify-center w-full max-w-sm animate-in fade-in zoom-in-95 duration-1000">
        
        {/* الشعار المتحرك - يظهر بنقاء بدون دوائر أو نصوص */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-8">
            {animationData && (
                <Lottie 
                    animationData={animationData} 
                    loop={true} 
                    style={{ width: '100%', height: '100%' }} 
                />
            )}
        </div>

        {/* شريط الانتظار النحيف والأنيق (Waiting Strip) */}
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
