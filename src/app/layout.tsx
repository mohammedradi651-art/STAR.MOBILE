'use client';

import './globals.css';
import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider, useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { WelcomeModal } from '@/components/dashboard/welcome-modal';
import { AppErrorDialog } from '@/components/layout/app-error-dialog';
import { SplashScreen } from '@/components/layout/splash-screen';
import { PinOverlay } from '@/components/layout/pin-overlay';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type UserProfile = {
  isPinEnabled?: boolean;
  pinCode?: string;
};

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isNavVisible, setIsNavVisible] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);

  // Register Service Worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
          },
          (err) => {
            console.log('Service Worker registration failed:', err);
          }
        );
      });
    }
  }, []);

  // منع التكبير بالأصابع عبر JavaScript كخيار إضافي للمتصفحات التي تتجاهل meta tags
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    // منع التكبير عند النقر المزدوج (Double-tap to zoom)
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', handleTouchEnd, false);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Fetch user profile for PIN check
  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    const topLevelPages = [
      '/login', 
      '/renewal-requests', 
      '/users', 
      '/account', 
      '/store-orders', 
      '/bill-payment-requests', 
      '/withdrawal-requests',
      '/favorites'
    ];
    setIsNavVisible(topLevelPages.includes(pathname));
  }, [pathname]);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('has_seen_splash_v4');
    if (hasSeenSplash) {
      setShowSplash(false);
    }
    const isVerified = sessionStorage.getItem('is_pin_verified');
    if (isVerified) {
        setIsPinVerified(true);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem('has_seen_splash_v4', 'true');
  };

  const handlePinVerified = () => {
    setIsPinVerified(true);
    sessionStorage.setItem('is_pin_verified', 'true');
  };

  const shouldShowPinLock = user && userProfile?.isPinEnabled && userProfile?.pinCode && !isPinVerified && !showSplash;

  return (
    <div className="mx-auto max-w-[450px] bg-card h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden">
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
      
      <div className={cn(
        "flex-1 flex flex-col relative overflow-hidden transition-opacity duration-1000",
        showSplash ? "opacity-0 invisible" : "opacity-100 visible"
      )}>
        <WelcomeModal />
        <AppErrorDialog />
        <main className="flex-1 flex flex-col min-h-0 relative">
          {children}
        </main>
        {isNavVisible && <BottomNav />}
      </div>
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
        <title>ستار موبايل - Star Mobile</title>
        <meta name="description" content="تطبيق ستار موبايل لخدمات الاتصالات والإنترنت" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no" />
        <link rel="icon" type="image/jpeg" href="/logo.jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpeg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap" rel="stylesheet" />
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