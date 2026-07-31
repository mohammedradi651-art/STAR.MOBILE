
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  LayoutGrid,
  Phone,
  User,
  MapPin,
  Users,
  Wifi,
  CreditCard,
  BarChart3,
  Wallet,
  Megaphone,
  Send,
  Settings,
  Lock,
  Share2,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  SatelliteDish,
  ShoppingBag,
  PackageCheck,
  ListChecks,
  Banknote,
  Code,
  UserRound,
  ShieldCheck,
  TrendingUp,
  Zap,
  Droplets
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SimpleHeader } from '@/components/layout/simple-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

const managementLinks = [
  { title: 'إدارة المستخدمين', icon: Users, href: '/users' },
  { title: 'إدارة الشبكات', icon: Wifi, href: '/networks-management' },
  { title: 'إدارة المتجر', icon: ShoppingBag, href: '/store-management' },
  { title: 'طلبات المتجر', icon: PackageCheck, href: '/store-orders' },
  { title: 'طلبات الكهرباء', icon: Zap, href: '/electricity-requests' },
  { title: 'طلبات المياه', icon: Droplets, href: '/water-requests' },
  { title: 'تحويل أرباح الكروت', icon: TrendingUp, href: '/card-sales-reports' },
  { title: 'طلبات التجديد', icon: ListChecks, href: '/renewal-requests' },
  { title: 'طلبات السداد', icon: CreditCard, href: '/bill-payment-requests' },
  { title: 'طلبات السحب', icon: Banknote, href: '/withdrawal-requests' },
  { title: 'إدارة منظومة الوادي', icon: SatelliteDish, href: '/alwadi-management' },
  { title: 'تقارير منظومة الوادي', icon: BarChart3, href: '/alwadi-reports' },
  { title: 'إدارة طرق الدفع', icon: Wallet, href: '/payment-management' },
  { title: 'إدارة الإعلانات', icon: Megaphone, href: '/ads-management' },
  { title: 'إرسال إشعارات', icon: Send, href: '/send-notifications' },
  { title: 'إعدادات التطبيق', icon: Settings, href: '/app-settings' },
];

const userAppSettingsLinks = [
    { id: 'change-password', title: 'تغيير كلمة المرور', icon: Lock, href: '/change-password' },
    { id: 'share-app', title: 'شارك التطبيق', icon: Share2, action: 'share' },
    { id: 'help-center', title: 'مركز المساعدة', icon: HelpCircle, action: 'help' },
    { id: 'privacy-policy', title: 'سياسة الخصوصية', icon: ShieldCheck, href: '/privacy-policy' },
    { id: 'app-developer', title: 'مطور التطبيق', icon: Code, action: 'developer' },
];


type UserProfile = {
  displayName?: string;
  location?: string;
  phoneNumber?: string;
  balance?: number;
  photoURL?: string;
};

type AppSettings = {
    appLink: string;
    supportPhoneNumber: string;
};

const CustomLoader = () => (
  <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
    <div className="relative w-28 h-28 overflow-hidden rounded-[32px] border-4 border-white/30 shadow-2xl bg-white">
        <Image 
            src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
            alt="Star Mobile Logo" 
            fill
            className="object-cover"
            priority
        />
    </div>
    <div className="mt-8">
        <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex flex-col justify-center items-center z-[100] bg-mesh-gradient">
    <CustomLoader />
  </div>
);

export default function AccountPage() {
  const [activeTheme, setActiveTheme] = useState('light');
  const [isDevDialogOpen, setIsDevDialogOpen] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'appSettings', 'global') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);
  
  const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setActiveTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleThemeChange = (theme: 'light' | 'dark') => {
    setActiveTheme(theme);
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  const handleShare = async () => {
    if (!appSettings?.appLink) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'رابط التطبيق غير محدد في الإعدادات.',
      });
      return;
    }
  
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'تطبيق ستار موبايل',
                text: 'حمل تطبيق ستار موبايل الآن واستمتع بخدماتنا المتميزة!',
                url: appSettings.appLink,
            });
        } catch (error) {
            window.open(appSettings.appLink, '_blank', 'noopener,noreferrer');
        }
    } else {
        window.open(appSettings.appLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAction = (item: any) => {
    if (item.href) {
        router.push(item.href);
        return;
    }

    switch (item.action) {
        case 'share':
            handleShare();
            break;
        case 'help':
            const helpCenterUrl = appSettings?.supportPhoneNumber 
                ? `https://api.whatsapp.com/send?phone=${appSettings.supportPhoneNumber}`
                : '#';
            window.open(helpCenterUrl, '_blank');
            break;
        case 'developer':
            setIsDevDialogOpen(true);
            break;
    }
  }

  const handleLogout = () => {
    if (auth) {
        auth.signOut();
        router.push('/');
    }
  };

  if (isUserLoading || !user) {
    return <LoadingSpinner />;
  }

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="حسابي" />
      <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-6 no-scrollbar">
        <Card className="overflow-hidden rounded-[28px] shadow-lg bg-mesh-gradient text-white border-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex-grow text-right">
              <h2 className="text-lg font-black text-white">{userProfile?.displayName || 'مستخدم جديد'}</h2>
              <div className="text-xs text-white/80 mt-1.5 space-y-1.5">
                <div className="flex items-center justify-start gap-2">
                  <Phone className="h-3.5 w-3.5 opacity-70" />
                  <span className="font-bold text-white/90">{userProfile?.phoneNumber || '...'}</span>
                </div>
                <div className="flex items-center justify-start gap-2">
                  <MapPin className="h-3.5 w-3.5 opacity-70" />
                  <span className="font-bold text-white/90">{userProfile?.location ? `حضرموت - ${userProfile.location}` : '...'}</span>
                </div>
              </div>
            </div>
            <div className="h-16 w-16 rounded-full border-2 border-white/30 bg-white flex items-center justify-center shrink-0 shadow-xl overflow-hidden">
                <UserRound className="h-10 w-10 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <div>
            <h3 className="text-xs font-black text-muted-foreground text-center mb-3 uppercase tracking-widest">الوضع المفضل</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl cursor-pointer transition-all w-full border-2 bg-card',
                  activeTheme === 'light'
                    ? 'border-primary text-primary shadow-md scale-[1.02]'
                    : 'border-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                <span className="h-5 w-5"><Suspense fallback={<Sun className="h-5 w-5" />}><Sun className="h-5 w-5" /></Suspense></span>
                <span className="text-xs font-bold">فاتح</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl cursor-pointer transition-all w-full border-2 bg-card',
                  activeTheme === 'dark'
                    ? 'border-primary text-primary shadow-md scale-[1.02]'
                    : 'border-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                <span className="h-5 w-5"><Moon className="h-5 w-5" /></span>
                <span className="text-xs font-bold">داكن</span>
              </button>
            </div>
        </div>

        <div>
            <div className="flex items-center justify-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">إعدادات الحساب</h3>
            </div>
            <Card className="bg-card rounded-3xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {userAppSettingsLinks.map((link, index) => {
                        const Icon = link.icon;
                        return (
                            <div
                                key={link.id}
                                onClick={() => handleAction(link)}
                                className={`group flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-muted/30 ${
                                    index < userAppSettingsLinks.length - 1 ? 'border-b border-muted' : ''
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={cn("h-5 w-5", "text-primary")} />
                                    <span className="text-sm font-bold text-foreground">
                                        {link.title}
                                    </span>
                                </div>
                                <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1" />
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>

        {isUserAdmin && (
          <>
            <div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">
                  لوحة التحكم
                </h3>
              </div>

              <Card className="bg-card rounded-3xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {managementLinks.map((link, index) => {
                    const Icon = link.icon;
                    return (
                        <a
                        href={link.href}
                        key={link.title}
                        className={`group flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-muted/30 ${
                            index < managementLinks.length - 1 ? 'border-b border-muted' : ''
                        }`}
                        >
                        <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="text-sm font-bold text-foreground">{link.title}</span>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1" />
                        </a>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="pt-4 pb-8">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Card className="bg-card cursor-pointer rounded-2xl border-none shadow-sm hover:bg-destructive/5 transition-colors">
                  <CardContent className="p-0">
                      <div className="group flex items-center justify-center p-4 w-full">
                        <div className="flex items-center gap-3 text-destructive">
                            <LogOut className="h-5 w-5" />
                            <span className="text-sm font-black uppercase tracking-widest">تسجيل الخروج</span>
                        </div>
                      </div>
                  </CardContent>
              </Card>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[32px]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-center font-black">هل أنت متأكد؟</AlertDialogTitle>
                <AlertDialogDescription className="text-center">
                  سيؤدي هذا الإجراء إلى تسجيل خروجك من التطبيق.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="grid grid-cols-2 gap-3 pt-4">
                <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold">
                  تأكيد الخروج
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

      </div>
    </div>

    {/* Developer Dialog */}
    <Dialog open={isDevDialogOpen} onOpenChange={setIsDevDialogOpen}>
        <DialogContent className="rounded-[40px] max-sm overflow-hidden p-0 border-none shadow-2xl [&>button]:hidden">
            <div className="bg-mesh-gradient h-32 relative">
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 border-4 border-background rounded-[32px] overflow-hidden shadow-xl">
                    <Image 
                        src="https://i.postimg.cc/zfV1rDTs/file-000000004c3071fd88d2020b27f37402.png" 
                        alt="Developer" 
                        width={100} 
                        height={100} 
                        className="object-cover"
                        data-ai-hint="developer portrait"
                    />
                </div>
            </div>
            <div className="pt-16 pb-8 px-6 text-center space-y-4">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-primary">محمد راضي باشادي</DialogTitle>
                    <DialogDescription className="text-foreground/80 font-bold text-base leading-relaxed pt-2">
                        مطور برمجيات شغوف ببناء حلول رقمية مبتكرة تسهل حياة المستخدمين. متخصص في تقنيات الويب وتطبيقات المحافظ الرقمية.
                    </DialogDescription>
                </DialogHeader>
                <div className="bg-muted/50 p-4 rounded-2xl border border-primary/5">
                    <p className="text-xs text-muted-foreground font-bold">تم تطوير هذا التطبيق لتقديم أفضل تجربة سداد وخدمات إلكترونية في اليمن.</p>
                </div>
                <Button className="w-full rounded-2xl h-12 font-black" onClick={() => setIsDevDialogOpen(false)}>إغلاق</Button>
            </div>
        </DialogContent>
    </Dialog>

    <Toaster />
    </>
  );
}
