
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

/**
 * مكون المنبثق الترحيبي/الترويجي.
 * يظهر فور فتح التطبيق مباشرة وبدون أي تأخير.
 */
export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // تحديد تاريخ الانتهاء: 1 مارس 2025
    const expiryDate = new Date('2025-03-01T23:59:59').getTime();
    const now = new Date().getTime();
    
    // إذا انتهت المدة، لا تظهر المنبثق
    if (now > expiryDate) {
        return;
    }

    // استخدام مفتاح تخزين لضمان الظهور للمستخدمين الجدد
    const isDismissed = localStorage.getItem('welcome_promo_final_trigger');
    if (!isDismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // حفظ حالة الإغلاق
    localStorage.setItem('welcome_promo_final_trigger', 'true');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[85vw] sm:max-w-[320px] p-6 overflow-hidden rounded-[40px] border-none bg-white shadow-2xl flex flex-col items-center z-[9999] outline-none [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>مرحباً بك في شبكات</DialogTitle>
          <DialogDescription>عرض ترحيبي لأحدث خدماتنا</DialogDescription>
        </DialogHeader>
        <div className="relative w-full flex flex-col items-center animate-in zoom-in-95 duration-500">
          {/* حاوية الصورة */}
          <div className="relative w-full aspect-[3/4] rounded-[32px] overflow-hidden border-2 border-muted bg-card mb-6">
            <Image 
              src="https://i.postimg.cc/SNtjK4ZZ/IMG-20260224-WA0012.jpg" 
              alt="Welcome Promo" 
              fill 
              className="object-cover"
              priority
              unoptimized
            />
          </div>
          
          {/* زر الإغلاق السفلي بتدرج التطبيق */}
          <Button 
              onClick={handleClose}
              className="w-full h-12 rounded-full bg-mesh-gradient text-white font-black text-base shadow-lg active:scale-95 transition-all border-none"
          >
              إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
