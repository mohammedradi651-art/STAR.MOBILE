'use client';

import React, { useState, useEffect } from 'react';

let cachedLottieComponent: any = null;
let cachedAnimationData: any = null;
let preloadPromise: Promise<{ Lottie: any; animationData: any }> | null = null;

/**
 * Preloads lottie-react and /TH.json once in memory so ProcessingOverlay
 * renders the animated logo immediately on frame 1 without network or import delay.
 */
export function preloadProcessingAssets() {
  if (cachedLottieComponent && cachedAnimationData) {
    return Promise.resolve({
      Lottie: cachedLottieComponent,
      animationData: cachedAnimationData,
    });
  }

  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import('lottie-react'),
      fetch('/TH.json').then((res) => res.json()),
    ])
      .then(([lottieMod, animData]) => {
        cachedLottieComponent = lottieMod.default;
        cachedAnimationData = animData;
        return {
          Lottie: cachedLottieComponent,
          animationData: cachedAnimationData,
        };
      })
      .catch((err) => {
        console.error('Lottie load error:', err);
        preloadPromise = null;
        return { Lottie: null, animationData: null };
      });
  }

  return preloadPromise;
}

// Start preloading automatically on the client as soon as any page imports ProcessingOverlay
if (typeof window !== 'undefined') {
  preloadProcessingAssets();
}

/**
 * مؤشر تحميل عالمي فخم يستخدم التحميل المسبق للذاكرة لضمان الظهور الفوري.
 */
export const ProcessingOverlay = ({ message }: { message?: string }) => {
  const [LottieComponent, setLottieComponent] = useState<any>(() => cachedLottieComponent);
  const [animationData, setAnimationData] = useState<any>(() => cachedAnimationData);

  useEffect(() => {
    if (!cachedLottieComponent || !cachedAnimationData) {
      let active = true;
      preloadProcessingAssets().then(({ Lottie, animationData: data }) => {
        if (!active) return;
        if (Lottie) setLottieComponent(() => Lottie);
        if (data) setAnimationData(data);
      });
      return () => {
        active = false;
      };
    }
  }, []);

  useEffect(() => {
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
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center animate-in fade-in-0 duration-75 pointer-events-auto backdrop-blur-sm bg-black/60">
      <div className="relative w-28 h-28 flex items-center justify-center overflow-hidden animate-in zoom-in-95 duration-75">
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
