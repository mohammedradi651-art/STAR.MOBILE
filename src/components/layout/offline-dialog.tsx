'use client';

import React from 'react';
import { WifiOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface OfflineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionName?: string;
}

export function OfflineDialog({ open, onOpenChange, sectionName }: OfflineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[32px] max-w-[360px] sm:max-w-[400px] text-center p-6 sm:p-8 border-none shadow-2xl bg-white dark:bg-slate-900 outline-none z-50">
        <DialogHeader className="items-center text-center">
          <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-inner">
            <WifiOff className="w-10 h-10 text-red-600 dark:text-red-400 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-black text-foreground text-center">
            عذراً.. لا يوجد إنترنت
          </DialogTitle>
          <DialogDescription className="text-sm font-bold text-muted-foreground mt-2 leading-relaxed text-center">
            {sectionName ? (
              <>
                قسم <span className="text-red-500 font-black">"{sectionName}"</span> يحتاج إلى اتصال نشط بالإنترنت للعمل. يمكنك حالياً استخدام قسم <span className="text-primary font-black">"الشبكات"</span> و<span className="text-primary font-black">"المفضلة"</span> فقط بدون إنترنت.
              </>
            ) : (
              'هذا القسم يحتاج إلى اتصال نشط بالإنترنت للعمل. يمكنك حالياً استخدام قسم "الشبكات" و"المفضلة" فقط بدون إنترنت.'
            )}
          </DialogDescription>
        </DialogHeader>
        <Button 
          onClick={() => onOpenChange(false)} 
          className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black mt-6 border-none shadow-lg active:scale-95 transition-all text-sm"
        >
          حسناً
        </Button>
      </DialogContent>
    </Dialog>
  );
}
