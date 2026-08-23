'use client';

import './globals.css';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider, useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { WelcomeModal } from '@/components/dashboard/welcome-modal';
import { AppErrorDialog } from '@/components/layout/app-error-dialog';
import { SplashScreen } from '@/components/layout/splash-screen';
import { PinOverlay } from '@/components/layout/pin-overlay';
import { doc } from 'firebase/firestore';

// نسخة التطبيق المحدثة لضمان التحديث الشامل
const APP_VERSION = '1.9.5';

type UserProfile = {
  isPinEnabled?: boolean;
  pinCode?: string;
};

// أيقونة الأوفلاين كـ SVG لمنع أخطاء الاستيراد
const WifiOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
);

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [showSplash, setShowSplash] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [mounted, setMounted] = useState(false);

  // حماية من تعليق الشاشة البيضاء (Hydration Guard)
  useEffect(() => {
    setMounted(true);
  }, []);

  // تسجيل الـ Service Worker لدعم وضع الـ Offline الحقيقي
  useEffect(() => {
    if ('serviceWorker' in navigator && mounted) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => console.log('Star Mobile SW Registered'),
          (err) => console.log('SW Registration Failed', err)
        );
      });
    }
  }, [mounted]);

  // تطهير الكاش عند تغيير النسخة
  useEffect(() => {
    if (!mounted) return;
    const savedVersion = localStorage.getItem('star_app_version_final');
    if (savedVersion !== APP_VERSION) {
      localStorage.setItem('star_app_version_final', APP_VERSION);
      // تحديث صامت في الخلفية للمتصفح
    }
  }, [mounted]);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const isNavVisiblePage = [
    '/login', 
    '/renewal-requests', 
    '/users', 
    '/account', 
    '/store-orders', 
    '/bill-payment-requests', 
    '/withdrawal-requests',
    '/favorites'
  ].includes(pathname);

  useEffect(() => {
    if (!mounted) return;
    const hasSeenSplash = sessionStorage.getItem(`has_seen_splash_${APP_VERSION}`);
    if (hasSeenSplash) setShowSplash(false);
    if (sessionStorage.getItem('is_pin_verified')) setIsPinVerified(true);
  }, [mounted]);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem(`has_seen_splash_${APP_VERSION}`, 'true');
  };

  const handlePinVerified = () => {
    setIsPinVerified(true);
    sessionStorage.setItem('is_pin_verified', 'true');
  };

  const shouldShowPinLock = user && userProfile?.isPinEnabled && userProfile?.pinCode && !isPinVerified && !showSplash;

  if (!mounted) return null; // منع الرندر الأولي لمنع الشاشة البيضاء

  return (
    <div className="mx-auto max-w-[450px] bg-white h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden">
      {showSplash && (
        <SplashScreen 
          onComplete={handleSplashComplete} 
          isAppReady={!isUserLoading} 
        />
      )}

      {shouldShowPinLock && (
        <PinOverlay 
            userPin={userProfile.pinCode!} 
            onVerified={handlePinVerified} 
        />
      )}
      
      {!showSplash && (
        <div className="flex-1 flex flex-col relative overflow-hidden animate-in fade-in duration-500">
          <WelcomeModal />
          <AppErrorDialog />
          <main className="flex-1 flex flex-col min-h-0 relative">
            {children}
          </main>
          {isNavVisiblePage && <BottomNav />}
        </div>
      )}
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>ستار موبايل</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0048ad" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/logo.jpeg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-background">
        <FirebaseProvider>
          <ThemeProvider>
            <AppContent>
              {children}
            </AppContent>
          </ThemeProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
