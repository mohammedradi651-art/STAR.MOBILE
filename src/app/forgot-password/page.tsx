'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { Lock, Send, LogIn } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

type AppSettings = {
  supportPhoneNumber: string;
};

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'appSettings', 'global') : null),
    [firestore]
  );
  const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsDocRef);
  
  const handleRequestReset = () => {
    if (!appSettings?.supportPhoneNumber) {
        toast({
            variant: 'destructive',
            title: 'خطأ',
            description: 'رقم الدعم الفني غير محدد. يرجى المحاولة لاحقاً.'
        });
        return;
    }
    const phoneNumber = appSettings.supportPhoneNumber;
    const message = encodeURIComponent('مرحباً، لقد نسيت كلمة المرور وأرغب في إعادة تعيينها.');
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <SimpleHeader title="نسيت كلمة المرور" />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6 -mt-16">
            <div className="p-4 bg-primary/10 rounded-full">
                <Lock className="h-12 w-12 text-primary dark:text-primary-foreground" />
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold">نسيت كلمة المرور؟</h1>
                <p className="text-muted-foreground px-4">
                  لاعادة تعيين كلمة المرور يرجى التواصل مع الدعم الفني عبر واتساب.
                </p>
            </div>
            
            <div className='w-full max-w-sm'>
              {isLoading ? (
                  <Skeleton className="h-10 w-full" />
              ) : (
                <div className="bg-muted p-3 rounded-lg font-mono text-lg tracking-widest text-center text-muted-foreground">
                  {appSettings?.supportPhoneNumber || '...'}
                </div>
              )}
            </div>

            <div className="w-full max-w-sm space-y-3 pt-4">
                <Button onClick={handleRequestReset} className="w-full" disabled={isLoading}>
                    <Send className="ml-2 h-4 w-4" />
                    إرسال طلب إعادة تعيين
                </Button>
            </div>

        </div>
      </div>
      <Toaster />
    </>
  );
}
