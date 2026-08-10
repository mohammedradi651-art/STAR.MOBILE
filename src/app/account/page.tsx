'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Droplets,
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Building2
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
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useCollection, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

type BankNotif = {
    id: string;
    bank: string;
    account?: string;
    reference?: string;
    amount: number;
    status: 'unpaid' | 'paid';
    timestamp: string;
    senderName: string;
};

const managementLinks = [
  { title: 'إدارة المستخدمين', icon: Users, href: '/users' },
  { title: 'إدارة الإيداعات', icon: Building2, href: '/omqy-management' },
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
};

type AppSettings = {
    appLink: string;
    supportPhoneNumber: string;
};

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex flex-col justify-center items-center z-[100] bg-mesh-gradient">
    <div className="relative w-28 h-28 overflow-hidden rounded-[32px] border-4 border-white/30 shadow-2xl bg-white">
        <Image src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" alt="Logo" fill className="object-cover" priority />
    </div>
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

  // جلب آخر الإيداعات الواردة للمدير
  const bankQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'bankNotifications'), orderBy('timestamp', 'desc'), limit(5)) : null),
    [firestore]
  );
  const { data: bankNotifs } = useCollection<BankNotif>(bankQuery);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setActiveTheme(savedTheme);
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);
  
  const handleThemeChange = (theme: 'light' | 'dark') => {
    setActiveTheme(theme);
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleDeleteBankNotif = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'bankNotifications', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "تم الإلغاء", description: "تم حذف إشعار الإيداع بنجاح." });
  };

  const handleLogout = () => {
    if (auth) {
        auth.signOut();
        router.push('/');
    }
  };

  if (isUserLoading || !user) return <LoadingSpinner />;

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
                <div className="flex items-center justify-start gap-2"><Phone className="h-3.5 w-3.5 opacity-70" /><span className="font-bold text-white/90">{userProfile?.phoneNumber || '...'}</span></div>
                <div className="flex items-center justify-start gap-2"><MapPin className="h-3.5 w-3.5 opacity-70" /><span className="font-bold text-white/90">{userProfile?.location || '...'}</span></div>
              </div>
            </div>
            <div className="h-16 w-16 rounded-full border-2 border-white/30 bg-white flex items-center justify-center shrink-0 shadow-xl overflow-hidden">
                <UserRound className="h-10 w-10 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* إشعارات الإيداعات للمدير */}
        {isUserAdmin && bankNotifs && bankNotifs.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5" /> آخر الإيداعات الواردة
                    </h3>
                    <Link href="/omqy-management" className="text-[10px] font-black text-primary hover:underline">عرض الكل</Link>
                </div>
                <div className="space-y-2">
                    {bankNotifs.map(notif => (
                        <Card key={notif.id} className="rounded-2xl border-none shadow-sm overflow-hidden bg-card group">
                            <CardContent className="p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                    <div className={cn(
                                        "p-2 rounded-xl shrink-0 bg-muted text-muted-foreground",
                                        notif.status === 'unpaid' && "bg-green-500/10 text-green-600"
                                    )}>
                                        {notif.bank === 'alomqy' ? <Zap className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                    </div>
                                    <div className="text-right flex-1 truncate">
                                        <p className="text-[11px] font-black text-foreground truncate">{notif.senderName}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground">{notif.bank === 'alomqy' ? `حساب: ${notif.account}` : `مرجع: ${notif.reference}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-left">
                                        <p className={cn("text-xs font-black", notif.status === 'unpaid' ? "text-green-600" : "text-muted-foreground")}>
                                            {notif.amount.toLocaleString()} ر.ي
                                        </p>
                                        <div className="flex items-center gap-1 opacity-40">
                                            <Clock className="w-2.5 h-2.5" />
                                            <span className="text-[8px] font-bold">{format(parseISO(notif.timestamp), 'h:mm a', { locale: ar })}</span>
                                        </div>
                                    </div>
                                    {notif.status === 'unpaid' && (
                                        <button onClick={() => handleDeleteBankNotif(notif.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive transition-colors opacity-0 group-hover:opacity-100">
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )}
        
        <div>
            <h3 className="text-xs font-black text-muted-foreground text-center mb-3 uppercase tracking-widest">الوضع المفضل</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleThemeChange('light')} className={cn('flex flex-col items-center justify-center gap-2 p-4 rounded-2xl cursor-pointer transition-all w-full border-2 bg-card', activeTheme === 'light' ? 'border-primary text-primary shadow-md scale-[1.02]' : 'border-transparent text-muted-foreground hover:bg-muted/50')}>
                <Sun className="h-5 w-5" /><span className="text-xs font-bold">فاتح</span>
              </button>
              <button onClick={() => handleThemeChange('dark')} className={cn('flex flex-col items-center justify-center gap-2 p-4 rounded-2xl cursor-pointer transition-all w-full border-2 bg-card', activeTheme === 'dark' ? 'border-primary text-primary shadow-md scale-[1.02]' : 'border-transparent text-muted-foreground hover:bg-muted/50')}>
                <Moon className="h-5 w-5" /><span className="text-xs font-bold">داكن</span>
              </button>
            </div>
        </div>

        <div>
            <div className="flex items-center justify-center gap-2 mb-3"><Settings className="h-4 w-4 text-primary" /><h3 className="text-xs font-black text-primary uppercase tracking-widest">إعدادات الحساب</h3></div>
            <Card className="bg-card rounded-3xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {userAppSettingsLinks.map((link, index) => {
                        const Icon = link.icon;
                        return (
                            <div key={link.id} onClick={() => { if(link.href) router.push(link.href); else if(link.action === 'developer') setIsDevDialogOpen(true); }} className={cn("group flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-muted/30", index < userAppSettingsLinks.length - 1 && 'border-b border-muted')}>
                                <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-primary" /><span className="text-sm font-bold text-foreground">{link.title}</span></div>
                                <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1" />
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>

        {isUserAdmin && (
            <div>
              <div className="flex items-center justify-center gap-2 mb-3"><LayoutGrid className="h-4 w-4 text-primary" /><h3 className="text-xs font-black text-primary uppercase tracking-widest">لوحة التحكم</h3></div>
              <Card className="bg-card rounded-3xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {managementLinks.map((link, index) => (
                        <Link href={link.href} key={link.title} className={cn("group flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-muted/30", index < managementLinks.length - 1 && 'border-b border-muted')}>
                            <div className="flex items-center gap-3"><link.icon className="h-5 w-5 text-primary" /><span className="text-sm font-bold text-foreground">{link.title}</span></div>
                            <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1" />
                        </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
        )}

        <div className="pt-4 pb-8 text-center"><Button variant="ghost" onClick={handleLogout} className="text-destructive font-black gap-2"><LogOut className="h-5 w-5" /> تسجيل الخروج</Button></div>
      </div>
    </div>
    <Toaster />
    </>
  );
}
