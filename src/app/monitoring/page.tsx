'use client';

import React, { useState, useMemo } from 'react';
import { collectionGroup, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Search, 
    Filter, 
    Smartphone, 
    Wifi, 
    SatelliteDish, 
    Wallet, 
    Undo2, 
    Send, 
    CreditCard,
    ShoppingBag,
    Gamepad2,
    TrendingUp,
    FileText,
    Clock,
    User,
    Calendar,
    ArrowUpRight,
    Zap,
    Banknote,
    LayoutGrid
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type Transaction = {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  notes?: string;
  recipientPhoneNumber?: string;
  subscriberName?: string;
  cardNumber?: string;
};

const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('استرجاع')) return Undo2;
    if (t.includes('تغذية') || t.includes('إيداع') || t.includes('استلام')) return Wallet;
    if (t.includes('تحويل')) return Send;
    if (t.includes('سحب')) return Banknote;
    if (t.includes('شراء كرت')) return Wifi;
    if (t.includes('سداد') || t.includes('رصيد') || t.includes('باقة')) return Smartphone;
    if (t.includes('تجديد')) return SatelliteDish;
    if (t.includes('متجر') || t.includes('منتج')) return ShoppingBag;
    if (t.includes('ألعاب') || t.includes('شدات')) return Gamepad2;
    if (t.includes('أرباح')) return TrendingUp;
    return FileText;
};

export default function MonitoringPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    // استخدام Collection Group لجلب كافة العمليات من جميع المستخدمين
    // تأكد من وجود Index في Firebase Console إذا كنت تستخدم الـ orderBy
    const allTransactionsQuery = useMemoFirebase(
        () => {
            if (!firestore || !isUserAdmin) return null;
            return query(
                collectionGroup(firestore, 'transactions'), 
                orderBy('transactionDate', 'desc'), 
                limit(100)
            );
        },
        [firestore, isUserAdmin]
    );
    const { data: allTransactions, isLoading } = useCollection<Transaction>(allTransactionsQuery);

    const filteredTransactions = useMemo(() => {
        if (!allTransactions) return [];
        return allTransactions.filter(tx => {
            const matchesSearch = (tx.transactionType.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (tx.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (tx.recipientPhoneNumber || '').includes(searchTerm));
            
            if (filterType === 'all') return matchesSearch;
            if (filterType === 'sdad') return matchesSearch && (tx.transactionType.includes('سداد') || tx.transactionType.includes('باقة'));
            if (filterType === 'cards') return matchesSearch && tx.transactionType.includes('شراء كرت');
            if (filterType === 'deposit') return matchesSearch && (tx.transactionType.includes('تغذية') || tx.transactionType.includes('إيداع'));
            
            return matchesSearch;
        });
    }, [allTransactions, searchTerm, filterType]);

    const stats = useMemo(() => {
        if (!allTransactions) return { totalSdad: 0, totalDeposit: 0, totalCards: 0, count: 0 };
        return allTransactions.reduce((acc, tx) => {
            const dateStr = tx.transactionDate;
            if (!dateStr) return acc;
            
            try {
                const date = parseISO(dateStr);
                if (isToday(date)) {
                    if (tx.transactionType.includes('سداد') || tx.transactionType.includes('باقة')) acc.totalSdad += tx.amount;
                    if (tx.transactionType.includes('تغذية') || tx.transactionType.includes('إيداع')) acc.totalDeposit += tx.amount;
                    if (tx.transactionType.includes('شراء كرت')) acc.totalCards += tx.amount;
                    acc.count++;
                }
            } catch (e) {}
            return acc;
        }, { totalSdad: 0, totalDeposit: 0, totalCards: 0, count: 0 });
    }, [allTransactions]);

    if (!isUserAdmin) return <div className="p-10 text-center font-bold">عذراً، هذه الصفحة للمدير فقط.</div>;

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="مراقبة العمليات" />
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6 pb-24">
                
                {/* إحصائيات اليوم الفخمة */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="rounded-[28px] border-none shadow-sm bg-mesh-gradient text-white p-4 space-y-1">
                        <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">إجمالي سداد اليوم</p>
                        <h2 className="text-xl font-black">{stats.totalSdad.toLocaleString()} <span className="text-[10px]">ر.ي</span></h2>
                    </Card>
                    <Card className="rounded-[28px] border-none shadow-sm bg-green-600 text-white p-4 space-y-1">
                        <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">إجمالي التغذية</p>
                        <h2 className="text-xl font-black">{stats.totalDeposit.toLocaleString()} <span className="text-[10px]">ر.ي</span></h2>
                    </Card>
                    <Card className="rounded-[28px] border-none shadow-sm bg-orange-500 text-white p-4 space-y-1 col-span-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">مبيعات الكروت اليوم</p>
                                <h2 className="text-xl font-black">{stats.totalCards.toLocaleString()} <span className="text-[10px]">ر.ي</span></h2>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">
                                {stats.count} عملية اليوم
                            </div>
                        </div>
                    </Card>
                </div>

                {/* أدوات البحث والفلترة */}
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="بحث بالرقم، الخدمة، أو الملاحظة..." 
                            className="h-12 pr-11 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {[
                            { id: 'all', label: 'الكل', icon: LayoutGrid },
                            { id: 'sdad', label: 'السداد', icon: Smartphone },
                            { id: 'cards', label: 'الكروت', icon: Wifi },
                            { id: 'deposit', label: 'الشحن', icon: Wallet },
                        ].map((btn) => (
                            <button 
                                key={btn.id}
                                onClick={() => setFilterType(btn.id)}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black transition-all shrink-0 border-2",
                                    filterType === btn.id 
                                        ? "bg-primary border-primary text-white shadow-md" 
                                        : "bg-white dark:bg-slate-900 border-transparent text-muted-foreground shadow-sm"
                                )}
                            >
                                <btn.icon className="w-3.5 h-3.5" />
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* قائمة العمليات المباشرة */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">آخر التحركات في النظام</h3>
                    
                    {isLoading ? (
                        [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-[24px]" />)
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-20 opacity-30">
                            <Zap className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-black text-sm uppercase">لا توجد عمليات مطابقة</p>
                        </div>
                    ) : (
                        filteredTransactions.map((tx, idx) => {
                            const Icon = getIcon(tx.transactionType);
                            const isCredit = tx.transactionType.includes('تغذية') || tx.transactionType.includes('إيداع') || tx.transactionType.includes('استلام');
                            
                            return (
                                <Card 
                                    key={tx.id} 
                                    className="rounded-[24px] border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 group cursor-pointer active:scale-[0.98] transition-all"
                                    onClick={() => setSelectedTx(tx)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn(
                                                "p-3 rounded-2xl shrink-0",
                                                isCredit ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                                            )}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="text-right overflow-hidden">
                                                <h4 className="font-black text-sm text-foreground truncate">{tx.transactionType}</h4>
                                                <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {tx.transactionDate ? format(parseISO(tx.transactionDate), 'h:mm a - d MMM', { locale: ar }) : '...'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-left shrink-0">
                                            <p className={cn(
                                                "font-black text-sm",
                                                isCredit ? "text-green-600" : "text-destructive"
                                            )}>
                                                {tx.amount.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                                            </p>
                                            {tx.recipientPhoneNumber && (
                                                <p className="text-[9px] font-bold font-mono text-muted-foreground mt-0.5">{tx.recipientPhoneNumber}</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </div>

            {/* تفاصيل العملية المنبثقة */}
            <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
                <DialogContent className="rounded-[32px] max-sm p-6 outline-none">
                    <DialogHeader>
                        <DialogTitle className="text-center font-black">تفاصيل العملية</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <div className="space-y-4 py-4 text-sm" dir="rtl">
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Tag className="w-4 h-4" /> النوع:</span>
                                <span className="font-black">{selectedTx.transactionType}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Banknote className="w-4 h-4" /> المبلغ:</span>
                                <span className="font-black text-primary text-base">{selectedTx.amount.toLocaleString()} ر.ي</span>
                            </div>
                            {selectedTx.recipientPhoneNumber && (
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-4 h-4" /> المستهدف:</span>
                                    <span className="font-mono font-black">{selectedTx.recipientPhoneNumber}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> التاريخ:</span>
                                <span className="font-bold">{selectedTx.transactionDate ? format(parseISO(selectedTx.transactionDate), 'Pp', { locale: ar }) : '...'}</span>
                            </div>
                            {selectedTx.notes && (
                                <div className="pt-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">ملاحظات:</p>
                                    <p className="bg-muted/50 p-3 rounded-xl text-xs font-bold leading-relaxed">{selectedTx.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button className="w-full h-12 rounded-2xl font-black">إغلاق</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}