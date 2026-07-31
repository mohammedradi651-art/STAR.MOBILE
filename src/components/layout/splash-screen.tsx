'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * شاشة الترحيب (Splash Screen)
 * تظهر عند فتح التطبيق وتنتظر حتى يصبح التطبيق جاهزاً بالكامل (isAppReady).
 * تم ضبط الوقت الأدنى ليكون 5 ثوانٍ لتعزيز الهوية البصرية.
 */
export function SplashScreen({ 
  onComplete, 
  isAppReady 
}: { 
  onComplete: () => void; 
  isAppReady: boolean;
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // ضمان بقاء الشاشة لمدة 5 ثوانٍ على الأقل للهوية البصرية (بناءً على طلب العميل)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 5000); 
    return () => clearTimeout(timer);
  }, []);

  // الاختفاء فقط عندما يكون التطبيق جاهزاً بالكامل ومر الوقت الأدنى (5 ثوانٍ)
  useEffect(() => {
    if (isAppReady && minTimeElapsed) {
      setIsExiting(true);
      const exitTimer = setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 1000); // وقت التلاشي لضمان انتقال سلس
      return () => clearTimeout(exitTimer);
    }
  }, [isAppReady, minTimeElapsed, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-mesh-gradient transition-all duration-1000 ease-in-out",
        isExiting ? "opacity-0 scale-110 pointer-events-none" : "opacity-100 scale-100"
      )}
    >
      {/* عناصر زخرفية في الخلفية */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-5%] left-[-10%] w-[250px] h-[250px] bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative flex flex-col items-center text-center space-y-8 px-6 max-w-sm w-full animate-in fade-in zoom-in duration-1000">
        
        {/* الشعار */}
        <div className="relative w-32 h-32 mb-4">
            <div className="absolute inset-0 bg-white/20 rounded-[45px] blur-2xl animate-pulse" />
            <div className="relative w-full h-full overflow-hidden rounded-[40px] border-4 border-white/30 shadow-2xl bg-white">
                <Image 
                    src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                    alt="Star Mobile Logo" 
                    fill
                    className="object-cover"
                    priority
                />
            </div>
        </div>

        {/* النصوص الترحيبية */}
        <div className="space-y-3">
            <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">أهلاً بك في ستار موبايل</h1>
            <p className="text-white/80 text-sm font-bold tracking-wide">استمتع براحة الدفع في أي وقت</p>
        </div>

        {/* شريط الإحصائيات */}
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-6 shadow-2xl flex justify-around items-center">
            <div className="flex flex-col items-center space-y-1">
                <div className="bg-white/20 p-2 rounded-xl mb-1">
                    <Users className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-black text-lg">+10.000</span>
                <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest">عميل</span>
            </div>
            
            <div className="h-12 w-[1px] bg-white/10" />

            <div className="flex flex-col items-center space-y-1">
                <div className="bg-white/20 p-2 rounded-xl mb-1">
                    <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-black text-lg">24/7</span>
                <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest">دعم متواصل</span>
            </div>
        </div>

        {/* مؤشر التحميل السفلي */}
        <div className="pt-12 flex flex-col items-center space-y-4">
            <div className="bg-white p-4 rounded-3xl shadow-xl shadow-black/10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" strokeWidth={3} />
            </div>
            <div className="flex flex-col items-center">
                <p className="text-white font-black text-xs tracking-[0.2em] animate-pulse">جاري التحضير...</p>
                <div className="mt-2 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
