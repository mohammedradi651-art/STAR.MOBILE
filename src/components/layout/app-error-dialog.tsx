
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { errorEmitter } from '@/firebase/error-emitter';
import { X } from 'lucide-react';

/**
 * منبثق الأخطاء العالمي المطوّر - يتميز بتصميم عصري وأنيق
 * يستمع للأحداث 'custom-error' من باعث الأخطاء العالمي.
 */
export function AppErrorDialog() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (message: string) => {
      setErrorMessage(message);
    };

    errorEmitter.on('custom-error', handleError);
    return () => errorEmitter.off('custom-error', handleError);
  }, []);

  const handleClose = () => {
    setErrorMessage(null);
  };

  return (
    <Dialog open={!!errorMessage} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[85vw] sm:max-w-[320px] p-0 overflow-hidden rounded-[40px] border-none shadow-2xl flex flex-col items-center z-[10000] outline-none [&>button]:hidden bg-card animate-in fade-in-0 zoom-in-50 duration-500">
        <DialogHeader className="sr-only">
          <DialogTitle>خطأ في العملية</DialogTitle>
          <DialogDescription>تنبيه بوجود خطأ يحتاج إلى انتباه المستخدم</DialogDescription>
        </DialogHeader>
        <div className="w-full flex flex-col items-center">
          {/* رأس المنبثق مع أيقونة الخطأ */}
          <div className="w-full bg-destructive/10 py-10 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-destructive/20 via-transparent to-transparent opacity-50" />
            <div className="relative w-20 h-20 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-xl border-4 border-destructive/20 animate-bounce duration-1000">
              <X className="h-12 w-12 text-destructive stroke-[3.5px]" />
            </div>
          </div>

          {/* نص الخطأ في المنتصف */}
          <div className="p-8 pt-6 w-full text-center space-y-4">
            <div className="bg-muted/50 p-5 rounded-[28px] border-2 border-dashed border-destructive/10">
                <p className="text-sm font-bold text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {errorMessage}
                </p>
            </div>
          </div>
          
          {/* شريط الإغلاق السفلي (موافق) */}
          <div className="w-full p-6 pt-0">
            <Button 
              onClick={handleClose}
              className="w-full h-12 rounded-2xl bg-mesh-gradient text-white font-black text-base shadow-lg shadow-primary/20 active:scale-95 transition-all border-none mx-auto block"
              size="sm"
            >
              موافق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
