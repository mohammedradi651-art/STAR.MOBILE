
'use client';

import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * مكون متطور لتثبيت التطبيق (PWA)
 * يظهر بأسلوب فخم يتناسب مع هوية ستار موبايل
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // لا تظهر إذا أغلقها المستخدم في هذه الجلسة
      const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // إخفاء إذا كان التطبيق مثبتاً بالفعل
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="px-4 mb-4 animate-in slide-in-from-top-4 duration-1000 ease-out">
      <Card className="relative overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900 rounded-[28px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <CardContent className="p-4 flex items-center justify-between gap-3 relative z-10">
          <button 
            onClick={handleDismiss}
            className="absolute -top-1 -left-1 p-2 text-muted-foreground/40 hover:text-destructive transition-colors"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-3">
            <div className="bg-mesh-gradient p-3 rounded-[20px] shadow-lg shadow-primary/20 animate-swing">
              <Download size={20} className="text-white" />
            </div>
            <div className="text-right">
              <h4 className="text-[13px] font-black text-primary flex items-center gap-1.5">
                تثبيت ستار موبايل
                <Monitor size={10} className="opacity-50" />
              </h4>
              <p className="text-[10px] font-bold text-muted-foreground leading-tight mt-0.5">
                للوصول السريع من سطح المكتب أو الشاشة الرئيسية
              </p>
            </div>
          </div>

          <Button 
            onClick={handleInstallClick}
            className="h-10 px-6 rounded-2xl bg-[#0048ad] text-white font-black text-xs shadow-md active:scale-95 transition-all"
          >
            تثبيت الآن
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
