'use client';
import { Bell, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  timestamp: string;
};

type UserProfile = {
  lastNotificationRead?: string;
  displayName?: string;
  photoURL?: string;
};

const Header = () => {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [greeting, setGreeting] = useState('أهلاً');
  const [isDark, setIsDark] = useState(false);
  
  // PWA Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'صباح الخير' : 'مساء الخير');

    const savedTheme = localStorage.getItem('theme') || 'light';
    setIsDark(savedTheme === 'dark');

    // Detect PWA Install Capability
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Hide if already installed or running as standalone app
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstallable(false);
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
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const globalNotificationsQuery = useMemoFirebase(
    () => (firestore) ? query(collection(firestore, 'notifications'), orderBy('timestamp', 'desc'), limit(20)) : null,
    [firestore]
  );
  const { data: globalNotifications } = useCollection<Notification>(globalNotificationsQuery);

  const personalNotificationsQuery = useMemoFirebase(
    () => (firestore && user) ? query(collection(firestore, 'users', user.uid, 'notifications'), orderBy('timestamp', 'desc'), limit(20)) : null,
    [firestore, user]
  );
  const { data: personalNotifications } = useCollection<Notification>(personalNotificationsQuery);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (userProfile) {
      const lastReadTime = userProfile.lastNotificationRead ? new Date(userProfile.lastNotificationRead).getTime() : 0;
      const allNotifs = [...(globalNotifications || []), ...(personalNotifications || [])];
      const count = allNotifs.filter(n => new Date(n.timestamp).getTime() > lastReadTime).length;
      setUnreadCount(count);
    }
  }, [globalNotifications, personalNotifications, userProfile]);

  const handleNotificationClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (userDocRef) {
      const allNotifs = [...(globalNotifications || []), ...(personalNotifications || [])];
      if (allNotifs.length > 0) {
        const latestTs = allNotifs.reduce((latest, current) => new Date(current.timestamp).getTime() > new Date(latest).getTime() ? current.timestamp : latest, allNotifs[0].timestamp);
        updateDoc(userDocRef, { lastNotificationRead: latestTs });
      } else {
        updateDoc(userDocRef, { lastNotificationRead: new Date().toISOString() });
      }
    }
    router.push('/notifications');
  };

  const getFirstAndLastName = (name?: string) => {
    if (!name) return 'مستخدم شبكات';
    const parts = name.trim().split(/\s+/);
    return parts[0];
  };

  const displayName = getFirstAndLastName(user?.displayName || userProfile?.displayName);

  return (
    <header className="px-4 pt-4 pb-2 text-foreground relative">
      <div className="flex items-start justify-between gap-3 flex-row-reverse">
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleNotificationClick} className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
            isDark ? "border-white/5 bg-white/5 text-white" : "border-black/5 bg-white text-foreground"
          )}>
            <Bell className="h-5 w-5 text-primary" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white text-[8px] font-black border-2 border-background">{unreadCount > 9 ? '+9' : unreadCount}</span>}
          </button>
          
          {isInstallable && (
            <button 
              onClick={handleInstallClick} 
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border transition-all active:scale-90",
                isDark ? "border-white/5 bg-white/5 text-white" : "border-black/5 bg-white text-foreground"
              )}
              title="تثبيت التطبيق"
            >
              <Download className="h-5 w-5 text-primary animate-pulse" />
            </button>
          )}
        </div>

        <div className="text-right pt-1 ml-auto">
          {isUserLoading ? (
            <div className="space-y-2 text-right">
              <Skeleton className="h-6 w-24 ml-auto" />
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
          ) : (
            <>
              <h1 className="font-black text-[22px] leading-none tracking-tight">{greeting}</h1>
              <p className="mt-1 text-[13px] font-bold text-muted-foreground">{displayName}</p>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export { Header };
