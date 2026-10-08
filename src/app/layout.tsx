'use client';

import './globals.css';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider, useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { WelcomeModal } from '@/components/dashboard/welcome-modal';
import { AppErrorDialog } from '@/components/layout/app-error-dialog';
import { PinOverlay } from '@/components/layout/pin-overlay';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const APP_VERSION = '2.0.0';

type UserProfile = {
  isPinEnabled?: boolean;
  pinCode?: string;
};

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // فحص إصدار التطبيق ومسح التخزين المؤقت القديم تلقائياً لكل مستخدم قديم
    try {
      const savedVersion = localStorage.getItem('star_app_version');
      if (savedVersion !== APP_VERSION) {
        localStorage.setItem('star_app_version', APP_VERSION);

        // 1. مسح كافة سجلات CacheStorage القديمة في متصفح المستخدم
        if (typeof window !== 'undefined' && 'caches' in window) {
          caches.keys().then((keys) => {
            return Promise.all(keys.map((k) => caches.delete(k)));
          }).catch(() => {});
        }

        // 2. إشعار الـ Service Worker بحذف الكاشات وتفعيل النسخة الجديدة فوراً
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'PURGE_AND_UPDATE' });
        }
      }
    } catch (e) {}
  }, []);

  // Global PWA Install Prompt Listener & Service Worker Auto-Update
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=' + APP_VERSION, {
        updateViaCache: 'none'
      }).then((registration) => {
        // فحص التحديثات فوراً في الخلفية
        registration.update().catch(() => {});

        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (installing) {
            installing.onstatechange = () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                // إخبار السيرفيس وركر الجديد بالتفعيل الفوري
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            };
          }
        };
      }).catch(() => {});

      // عند تفعيل السيرفيس وركر الجديد، يتم تحديث الصفحة تلقائياً لتظهر كل التعديلات فوراً
      let isRefreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) {
          isRefreshing = true;
          window.location.reload();
        }
      });
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const isNavVisiblePage = [
    '/login', 
    '/users', 
    '/account', 
    '/admin-requests', 
    '/favorites',
    '/transactions'
  ].includes(pathname) || (isMounted && pathname === '/' && Boolean(user));

  useEffect(() => {
    if (sessionStorage.getItem('is_pin_verified')) setIsPinVerified(true);
  }, []);

  const handlePinVerified = () => {
    setIsPinVerified(true);
    sessionStorage.setItem('is_pin_verified', 'true');
  };

  const shouldShowPinLock = isMounted && Boolean(user && userProfile?.isPinEnabled && userProfile?.pinCode && !isPinVerified);

  return (
    <div className="mx-auto max-w-[450px] bg-white h-[100dvh] flex flex-col shadow-2xl relative overflow-hidden">
      {shouldShowPinLock && userProfile?.pinCode && (
        <PinOverlay 
            userPin={userProfile.pinCode} 
            onVerified={handlePinVerified} 
        />
      )}
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <WelcomeModal />
        <AppErrorDialog />
        <main className="flex-1 flex flex-col min-h-0 relative">
          {children}
        </main>
        {isNavVisiblePage && <BottomNav />}
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
        <title>ستار موبايل | خدمات السداد الإلكتروني</title>
<meta
  name="description"
  content="ستار موبايل لخدمات السداد الإلكتروني وشحن الاتصالات والإنترنت في اليمن."
/>
<meta
  name="keywords"
  content="ستار موبايل, Star Mobile, السداد الإلكتروني, شحن رصيد, اليمن"
/>

        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/logo.jpg" />
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