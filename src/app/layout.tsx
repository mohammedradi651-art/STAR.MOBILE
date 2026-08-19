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
import { Button } from '@/components/ui/button';

const APP_VERSION = '1.8.0';

type UserProfile = {
  isPinEnabled?: boolean;
  pinCode?: string;
};

// المسارات المدعومة للعمل بدون إنترنت
const OFFLINE_SUPPORTED_ROUTES = ['/login', '/services', '/favorites', '/account'];

// أيقونة WifiOff كـ SVG مباشر لتجنب أخطاء الاستيراد في layout.tsx
const WifiOffIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="64" 
    height="64" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="text-primary animate-pulse"
  >
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

function OfflinePlaceholder() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-background space-y-6 animate-in fade-in duration-700">
      <div className="bg-primary/10 p-8 rounded-[40px] shadow-inner">
        <WifiOffIcon />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-black text-foreground">عذراً، لا يوجد اتصال</h2>
        <p className="text-sm font-bold text-muted-foreground leading-relaxed px-4">
          هذا القسم يحتاج إلى اتصال نشط بالإنترنت للوصول إلى البيانات المباشرة.
        </p>
      </div>
      <Button 
        onClick={() => router.push('/services')}
        className="rounded-2xl h-12 px-10 font-black bg-mesh-gradient shadow-lg active:scale-95 transition-transform"
      >
        اذهب للشبكات (يعمل أوفلاين)
      </Button>
    </div>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [showSplash, setShowSplash] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // مراقبة حالة الاتصال بالإنترنت
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const savedVersion = localStorage.getItem('star_app_version');
    if (savedVersion !== APP_VERSION) {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('star_app_version', APP_VERSION);
      window.location.reload();
    }
  }, []);

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
    const hasSeenSplash = sessionStorage.getItem(`has_seen_splash_${APP_VERSION}`);
    if (hasSeenSplash) setShowSplash(false);
    if (sessionStorage.getItem('is_pin_verified')) setIsPinVerified(true);
  }, []);

  const shouldShowPinLock = user && userProfile?.isPinEnabled && userProfile?.pinCode && !isPinVerified && !showSplash;
  
  // منطق حجب الصفحات التي لا تعمل بدون إنترنت
  const isCurrentRouteRestricted = !isOnline && !OFFLINE_SUPPORTED_ROUTES.some(route => pathname.startsWith(route)) && pathname !== '/';

  return (
    <div className="mx-auto max-w-[450px] bg-white h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden">
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} isAppReady={!isUserLoading} />}

      {shouldShowPinLock && <PinOverlay userPin={userProfile.pinCode!} onVerified={() => { setIsPinVerified(true); sessionStorage.setItem('is_pin_verified', 'true'); }} />}
      
      {!showSplash && (
        <div className="flex-1 flex flex-col relative overflow-hidden animate-in fade-in duration-500">
          <WelcomeModal />
          <AppErrorDialog />
          <main className="flex-1 flex flex-col min-h-0 relative">
            {isCurrentRouteRestricted ? <OfflinePlaceholder /> : children}
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
