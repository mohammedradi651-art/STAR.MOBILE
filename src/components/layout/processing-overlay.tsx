'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * مؤشر تحميل عالمي فخم يستخدم نظام التحميل اليدوي لتجنب أخطاء الموديلات.
 */
export const ProcessingOverlay = ({ message }: { message?: string }) => {
  const [LottieComponent, setLottieComponent] = useState<any>(null);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // تحميل الأصول ديناميكياً
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

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      document.body.style.overflow = originalStyle;
      document.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  const Lottie = LottieComponent;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center animate-in fade-in-0 pointer-events-auto backdrop-blur-[40px] bg-black/75">
      <div className="relative w-28 h-28 flex items-center justify-center overflow-hidden animate-in zoom-in-95 duration-500">
          {Lottie && animationData && (
            <Lottie 
                animationData={animationData} 
                loop={true} 
                style={{ width: '100%', height: '100%' }} 
            />
          )}
      </div>
      {message && (
          <p className="mt-4 text-white/80 font-black text-sm animate-pulse tracking-widest">{message}</p>
      )}
    </div>
  );
};
