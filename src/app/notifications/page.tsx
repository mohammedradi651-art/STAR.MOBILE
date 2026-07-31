'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, Trash2, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  isGlobal?: boolean;
};

export default function NotificationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);

  // 1. جلب الإشعارات الشخصية
  const personalNotificationsQuery = useMemoFirebase(
    () => user && firestore
        ? query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, user]
  );
  const { data: personalNotifications, isLoading: isLoadingPersonal } = useCollection<Notification>(personalNotificationsQuery);
  
  // 2. جلب الإشعارات العامة
  const globalNotificationsQuery = useMemoFirebase(
    () => firestore
        ? query(
            collection(firestore, 'notifications'),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore]
  );
  const { data: globalNotifications, isLoading: isLoadingGlobal } = useCollection<Notification>(globalNotificationsQuery);

  // 3. دمج وترتيب الإشعارات
  const allNotifications = React.useMemo(() => {
    const combined = [
      ...(personalNotifications || []).map(n => ({ ...n, isGlobal: false })),
      ...(globalNotifications || []).map(n => ({ ...n, isGlobal: true }))
    ];
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [personalNotifications, globalNotifications]);

  const groupedNotifications = React.useMemo(() => {
    if (!allNotifications) return {};
    
    return allNotifications.reduce((acc, notification) => {
      const monthKey = format(parseISO(notification.timestamp), 'yyyy-MM');
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(notification);
      return acc;
    }, {} as Record<string, Notification[]>);
  }, [allNotifications]);

  const sortedMonths = React.useMemo(() => {
    return Object.keys(groupedNotifications).sort().reverse();
  }, [groupedNotifications]);

  const handleDeleteMonth = () => {
    if (!monthToDelete || !user || !firestore) return;

    const userNotificationsPath = `users/${user.uid}/notifications`;
    const notificationsToDelete = (personalNotifications || []).filter(
        n => format(parseISO(n.timestamp), 'yyyy-MM') === monthToDelete
    );

    if (notificationsToDelete.length === 0) {
        toast({ title: "تنبيه", description: "لا توجد إشعارات شخصية في هذا الشهر لحذفها." });
        setMonthToDelete(null);
        return;
    }

    const batch = writeBatch(firestore);
    notificationsToDelete.forEach(notification => {
        const docRef = doc(firestore, userNotificationsPath, notification.id);
        batch.delete(docRef);
    });

    batch.commit().then(() => {
        toast({ title: "تم الحذف", description: `تم حذف إشعارات الشهر المختار بنجاح.` });
    }).catch(serverError => {
        const contextualError = new FirestorePermissionError({ path: userNotificationsPath, operation: 'delete' });
        errorEmitter.emit('permission-error', contextualError);
    }).finally(() => {
        setMonthToDelete(null);
    });
  };

  const isLoading = isLoadingPersonal || isLoadingGlobal;

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
      <SimpleHeader title="الإشعارات" />
      
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        
        {/* هيرو الاشعارات الفخم */}
        <div className="bg-mesh-gradient pt-6 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="bg-white/20 p-4 rounded-[28px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <Bell className="h-10 w-10 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white tracking-tight">مركز التنبيهات</h2>
                    <div className="flex items-center justify-center gap-2">
                        {/* تم حذف اللمبة الخضراء بناء على طلب المستخدم */}
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">آخر المستجدات والرسائل</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 space-y-8">
            {isLoading ? (
                <div className="space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-3">
                            <Skeleton className="h-4 w-24 rounded-full mx-2" />
                            <Card className="rounded-[32px] p-4"><Skeleton className="h-20 w-full rounded-2xl" /></Card>
                        </div>
                    ))}
                </div>
            ) : allNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 animate-in fade-in zoom-in-95 duration-700">
                    <div className="bg-muted/30 p-8 rounded-[40px] mb-6">
                        <BellOff className="h-16 w-16 text-muted-foreground opacity-20" />
                    </div>
                    <h3 className="text-lg font-black text-foreground/80">لا توجد إشعارات حالياً</h3>
                    <p className="mt-2 text-sm text-muted-foreground font-bold px-10">سنقوم بإشعارك هنا فور وجود أي تحديثات جديدة أو رسائل من الإدارة.</p>
                </div>
            ) : (
                sortedMonths.map(monthKey => (
                    <div key={monthKey} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary opacity-60" />
                                <h3 className="text-sm font-black text-primary uppercase tracking-tight">
                                    {format(parseISO(`${monthKey}-01`), 'MMMM yyyy', { locale: ar })}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setMonthToDelete(monthKey)}
                                className="p-2 hover:bg-destructive/10 rounded-xl transition-colors group"
                                title="أرشفة هذا الشهر"
                            >
                                <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {groupedNotifications[monthKey].map((notif, index) => (
                                <Card 
                                    key={notif.id} 
                                    className={cn(
                                        "border-none shadow-sm rounded-[28px] overflow-hidden group hover:shadow-md transition-all active:scale-[0.98]",
                                        notif.isGlobal ? "bg-white dark:bg-slate-900" : "bg-primary/5 dark:bg-primary/10"
                                    )}
                                >
                                    <CardContent className="p-5 flex items-start gap-4">
                                        <div className={cn(
                                            "p-3 rounded-[20px] shrink-0 shadow-sm animate-in zoom-in-90",
                                            notif.isGlobal ? "bg-primary/10 text-primary" : "bg-mesh-gradient text-white"
                                        )}>
                                            <Bell className="h-5 w-5" />
                                        </div>

                                        <div className="flex-1 text-right space-y-1.5 overflow-hidden">
                                            <div className="flex justify-between items-center gap-2">
                                                <h4 className="font-black text-[15px] text-foreground leading-tight truncate">
                                                    {notif.title}
                                                </h4>
                                                <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 bg-muted/50 px-2 py-0.5 rounded-full">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    <span className="text-[9px] font-bold">
                                                        {format(parseISO(notif.timestamp), 'h:mm a', { locale: ar })}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm font-bold text-foreground/70 leading-relaxed">
                                                {notif.body}
                                            </p>
                                            <div className="pt-1 flex items-center justify-start gap-1">
                                                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">
                                                    {format(parseISO(notif.timestamp), 'd MMMM', { locale: ar })}
                                                </span >
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      <AlertDialog open={!!monthToDelete} onOpenChange={(open) => !open && setMonthToDelete(null)}>
        <AlertDialogContent className="rounded-[40px] max-sm p-8 border-none shadow-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-center font-black text-xl">تأكيد الأرشفة</AlertDialogTitle>
                <AlertDialogDescription className="text-center font-bold pt-2">
                    هل أنت متأكد من رغبتك في أرشفة (حذف) إشعارات شهر {monthToDelete && format(parseISO(`${monthToDelete}-01`), 'MMMM yyyy', { locale: ar })}؟
                    <br/><span className="text-[10px] text-destructive mt-2 block">ملاحظة: الإشعارات العامة لن تتأثر.</span>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-8 sm:space-x-0">
                <AlertDialogAction onClick={handleDeleteMonth} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold shadow-lg">حذف الكل</AlertDialogAction>
                <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-bold">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
