'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Trash2, 
    Bell, 
    CheckCircle2, 
    Zap, 
    Clock, 
    Search, 
    XCircle,
    User,
    Building2,
    CreditCard
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const dynamic = 'force-dynamic';

type BankNotif = {
    id: string;
    bank: 'alomqy' | 'kuraimi';
    account?: string;
    reference?: string;
    amount: number;
    status: 'unpaid' | 'paid';
    timestamp: string;
    senderName: string;
    paidTo?: string;
    paidAt?: string;
};

export default function DepositManagementPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

    const bankQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, 'bankNotifications'), orderBy('timestamp', 'desc')) : null),
        [firestore]
    );
    const { data: notifications, isLoading } = useCollection<BankNotif>(bankQuery);

    const filterNotifs = (bank: string) => {
        return notifications?.filter(n => {
            const isBank = n.bank === bank;
            const matchesSearch = (n.senderName || '').includes(searchTerm) || 
                                 (n.account || '').includes(searchTerm) || 
                                 (n.reference || '').includes(searchTerm) ||
                                 String(n.amount).includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
            return isBank && matchesSearch && matchesStatus;
        }) || [];
    };

    const handleDelete = (id: string) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'bankNotifications', id);
        deleteDocumentNonBlocking(docRef);
        toast({ title: "تم الحذف", description: "تم حذف إشعار الإيداع بنجاح." });
    };

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="إدارة الإيداعات البنكية" />
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6 pb-20">
                
                {/* أدوات البحث والفلترة */}
                <Card className="rounded-[32px] border-none shadow-sm bg-white dark:bg-slate-900 p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="بحث بالاسم، الحساب أو المرجع..." 
                            className="h-11 pr-10 rounded-2xl bg-muted/20 border-none text-sm font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'unpaid', 'paid'].map((s) => (
                            <button 
                                key={s}
                                onClick={() => setStatusFilter(s as any)}
                                className={cn(
                                    "flex-1 h-9 rounded-xl text-[10px] font-black transition-all",
                                    statusFilter === s ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                                )}
                            >
                                {s === 'all' ? 'الكل' : s === 'unpaid' ? 'غير مدفوع' : 'مدفوع'}
                            </button>
                        ))}
                    </div>
                </Card>

                <Tabs defaultValue="alomqy" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-2xl h-12 p-1 mb-6">
                        <TabsTrigger value="alomqy" className="rounded-xl font-black text-xs">شركة العمقي</TabsTrigger>
                        <TabsTrigger value="kuraimi" className="rounded-xl font-black text-xs">بنك الكريمي</TabsTrigger>
                    </TabsList>

                    {['alomqy', 'kuraimi'].map(bank => (
                        <TabsContent key={bank} value={bank} className="space-y-3 mt-0">
                            {isLoading ? (
                                [1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-[28px]" />)
                            ) : filterNotifs(bank).length === 0 ? (
                                <div className="text-center py-20 opacity-30">
                                    <Building2 className="h-16 w-16 mx-auto mb-4" />
                                    <p className="font-black text-sm uppercase">لا توجد إشعارات حالياً</p>
                                </div>
                            ) : (
                                filterNotifs(bank).map(notif => (
                                    <Card key={notif.id} className={cn(
                                        "rounded-[28px] border-none shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2",
                                        notif.status === 'unpaid' ? "bg-white dark:bg-slate-900 border-r-4 border-green-500" : "bg-muted/40 grayscale"
                                    )}>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "p-2.5 rounded-2xl shrink-0",
                                                        notif.status === 'unpaid' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {notif.status === 'unpaid' ? <Zap className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                                    </div>
                                                    <div className="text-right">
                                                        <h4 className="font-black text-sm text-foreground">{notif.senderName}</h4>
                                                        <p className="text-[10px] font-bold text-muted-foreground">
                                                            {bank === 'alomqy' ? `الحساب: ${notif.account}` : `المرجع: ${notif.reference}`}
                                                        </p>
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

                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted-foreground/10">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 rounded-xl text-destructive hover:bg-destructive/10 text-[10px] font-black">
                                                            <Trash2 className="w-3.5 h-3.5 ml-1.5" />
                                                            حذف
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[32px]">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-center font-black">تأكيد الحذف</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-center">سيتم حذف هذا الإشعار نهائياً من سجلات النظام.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6">
                                                            <AlertDialogAction onClick={() => handleDelete(notif.id)} className="w-full rounded-2xl h-12 bg-destructive font-bold">تأكيد الحذف</AlertDialogAction>
                                                            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-black">إلغاء</AlertDialogCancel>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
            <Toaster />
        </div>
    );
}
