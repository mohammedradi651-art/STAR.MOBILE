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

// إصدار التطبيق المحدث لتطهير الكاش وتفعيل الواجهة الجديدة
const APP_VERSION = '1.6.1';

type UserProfile = {
  isPinEnabled?: boolean;
  pinCode?: string;
};

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [showSplash, setShowSplash] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(false);

  // نظام تطهير الكاش القوي عند تغيير النسخة
  useEffect(() => {
    const savedVersion = localStorage.getItem('star_app_version');
    if (savedVersion !== APP_VERSION) {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('star_app_version', APP_VERSION);
      window.location.reload();
    }
  }, []);

  // تسجيل Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=' + APP_VERSION).catch(() => {});
    }
  }, []);

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
    // التحقق مما إذا كانت شاشة البداية قد ظهرت بالفعل في هذه الجلسة
    const hasSeenSplash = sessionStorage.getItem(`has_seen_splash_${APP_VERSION}`);
    if (hasSeenSplash) setShowSplash(false);
    
    if (sessionStorage.getItem('is_pin_verified')) setIsPinVerified(true);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem(`has_seen_splash_${APP_VERSION}`, 'true');
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
        "flex-1 flex flex-col relative overflow-hidden transition-opacity duration-500",
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
        <title>ستار موبايل</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/logo.jpeg" />
        <link rel="manifest" href={`/manifest.json?v=${APP_VERSION}`} />
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
