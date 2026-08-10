'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Trash2, 
    Bell, 
    CheckCircle2, 
    Zap, 
    Clock, 
    Filter, 
    Search, 
    AlertCircle,
    XCircle,
    User
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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

export const dynamic = 'force-dynamic';

type AlOmqyNotif = {
    id: string;
    account: string;
    amount: number;
    status: 'unpaid' | 'paid';
    timestamp: string;
    senderName: string;
    rawMessage?: string;
    paidTo?: string;
    paidAt?: string;
};

export default function OmqyManagementPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

    const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    const omqyQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, 'alomqyNotifications'), orderBy('timestamp', 'desc')) : null),
        [firestore]
    );
    const { data: notifications, isLoading } = useCollection<AlOmqyNotif>(omqyQuery);

    const filteredNotifs = notifications?.filter(n => {
        const matchesSearch = n.senderName.includes(searchTerm) || n.account.includes(searchTerm) || String(n.amount).includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDelete = (id: string) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'alomqyNotifications', id);
        deleteDocumentNonBlocking(docRef);
        toast({ title: "تم الإلغاء", description: "تم حذف إشعار الإيداع بنجاح." });
    };

    if (!isUserAdmin) {
        return <div className="p-10 text-center font-bold">عذراً، هذه الصفحة مخصصة لمدير النظام فقط.</div>;
    }

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="إدارة إيداعات العمقي" />
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6 pb-20">
                
                {/* الإحصائيات السريعة */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="rounded-3xl border-none shadow-sm bg-green-500/10">
                        <CardContent className="p-4 text-center">
                            <p className="text-[10px] font-black text-green-600 uppercase mb-1">بانتظار التأكيد</p>
                            <h3 className="text-xl font-black text-green-600">
                                {notifications?.filter(n => n.status === 'unpaid').length || 0}
                            </h3>
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-none shadow-sm bg-blue-500/10">
                        <CardContent className="p-4 text-center">
                            <p className="text-[10px] font-black text-blue-600 uppercase mb-1">تمت معالجتها</p>
                            <h3 className="text-xl font-black text-blue-600">
                                {notifications?.filter(n => n.status === 'paid').length || 0}
                            </h3>
                        </CardContent>
                    </Card>
                </div>

                {/* أدوات البحث والفلترة */}
                <Card className="rounded-[32px] border-none shadow-sm bg-white dark:bg-slate-900 p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="بحث بالاسم أو الحساب..." 
                            className="h-11 pr-10 rounded-2xl bg-muted/20 border-none text-sm font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setStatusFilter('all')}
                            className={cn(
                                "flex-1 h-9 rounded-xl text-[10px] font-black transition-all",
                                statusFilter === 'all' ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                            )}
                        >الكل</button>
                        <button 
                            onClick={() => setStatusFilter('unpaid')}
                            className={cn(
                                "flex-1 h-9 rounded-xl text-[10px] font-black transition-all",
                                statusFilter === 'unpaid' ? "bg-green-600 text-white shadow-md" : "bg-muted text-muted-foreground"
                            )}
                        >غير مدفوع</button>
                        <button 
                            onClick={() => setStatusFilter('paid')}
                            className={cn(
                                "flex-1 h-9 rounded-xl text-[10px] font-black transition-all",
                                statusFilter === 'paid' ? "bg-blue-600 text-white shadow-md" : "bg-muted text-muted-foreground"
                            )}
                        >مدفوع</button>
                    </div>
                </Card>

                {/* قائمة الإشعارات */}
                <div className="space-y-3">
                    {isLoading ? (
                        [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-[28px]" />)
                    ) : filteredNotifs?.length === 0 ? (
                        <div className="text-center py-20 opacity-30">
                            <Bell className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-black text-sm uppercase">لا توجد إشعارات حالياً</p>
                        </div>
                    ) : (
                        filteredNotifs?.map(notif => (
                            <Card key={notif.id} className={cn(
                                "rounded-[28px] border-none shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2",
                                notif.status === 'unpaid' ? "bg-white dark:bg-slate-900 border-r-4 border-green-500" : "bg-muted/40 grayscale"
                            )}>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2.5 rounded-2xl shrink-0 shadow-inner",
                                                notif.status === 'unpaid' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                                            )}>
                                                {notif.status === 'unpaid' ? <Zap className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                            </div>
                                            <div className="text-right">
                                                <h4 className="font-black text-sm text-foreground">{notif.senderName}</h4>
                                                <p className="text-[10px] font-bold text-muted-foreground">رقم الحساب: <span className="font-mono tracking-wider">{notif.account}</span></p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className={cn("text-lg font-black", notif.status === 'unpaid' ? "text-green-600" : "text-muted-foreground")}>
                                                {notif.amount.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                                            </p>
                                            <div className="flex items-center justify-end gap-1.5 opacity-40">
                                                <Clock className="w-2.5 h-2.5" />
                                                <span className="text-[9px] font-bold">{format(parseISO(notif.timestamp), 'Pp', { locale: ar })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {notif.status === 'paid' && (
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-xl flex items-center justify-between px-3 border border-blue-100/50">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3 h-3 text-blue-600" />
                                                <span className="text-[9px] font-bold text-blue-600">دُفع بواسطة العميل</span>
                                            </div>
                                            <span className="text-[9px] font-black text-blue-600/50">{format(parseISO(notif.paidAt!), 'h:mm a', { locale: ar })}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted-foreground/10">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 rounded-xl text-destructive hover:bg-destructive/10 text-[10px] font-black">
                                                    <XCircle className="w-3.5 h-3.5 ml-1.5" />
                                                    {notif.status === 'paid' ? 'حذف من الأرشيف' : 'إلغاء الإيداع'}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[32px]">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-center font-black">هل أنت متأكد؟</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-center">
                                                        سيتم حذف هذا الإشعار نهائياً من سجلات النظام. لن يتمكن العميل من مطابقة هذا المبلغ إذا حذفته.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                                                    <AlertDialogAction onClick={() => handleDelete(notif.id)} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold">تأكيد الحذف</AlertDialogAction>
                                                    <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-bold">إلغاء</AlertDialogCancel>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
            <Toaster />
        </div>
    );
}
