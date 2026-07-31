'use client';

import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

/**
 * مؤشر تحميل عالمي فخم يستخدم شعار التطبيق المتحرك.
 * تم زيادة قوة الضبابية (Blur) والتعتيم لإعطاء مظهر ملكي عالي الجودة.
 */
export const ProcessingOverlay = ({ message }: { message?: string }) => {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // جلب ملف الـ Lottie للشعار المتحرك
    fetch('/TH.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Lottie load error:", err));

    // منع التفاعل مع الصفحة أثناء الظهور لضمان تجربة مستخدم سلسة
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      document.body.style.overflow = originalStyle;
      document.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center animate-in fade-in-0 pointer-events-auto backdrop-blur-[40px] bg-black/75">
      <div className="relative w-28 h-28 flex items-center justify-center overflow-hidden animate-in zoom-in-95 duration-500">
          {animationData && (
            <Lottie 
                animationData={animationData} 
                loop={true} 
                style={{ width: '100%', height: '100%' }} 
            />
          )}
      </div>
    </div>
  );
};
