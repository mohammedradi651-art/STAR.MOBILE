'use client';

import React, { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  SatelliteDish, 
  User as UserIcon, 
  CreditCard, 
  Trash2, 
  Calendar, 
  Clock, 
  Activity,
  Archive, 
  Undo2, 
  Wifi, 
  Smartphone,
  ShoppingBag,
  Send,
  Wallet,
  TrendingUp,
  Banknote,
  Search,
  Filter,
  Tag,
  Copy,
  RefreshCw
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { isTelecomService, getReadinessDetails } from '@/lib/telecom-order';
import { TransactionDetailsModal, extractRecipientPhone } from '@/components/layout/transaction-details-modal';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

type Transaction = {
  id: string;
  transactionDate: any;
  amount: number;
  transactionType: string;
  notes?: string;
  subscriberName?: string;
  cardNumber?: string;
  cardPassword?: string;
  paymentMethodName?: string;
  recipientName?: string;
  accountNumber?: string;
  recipientPhoneNumber?: string;
  status?: string;
  readiness?: string;
};

const getTransactionIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('تغذية') || t.includes('إيداع') || t.includes('استلام')) return '/icons/tadia.png';
    if (t.includes('تحويل')) return '/icons/tahwel.png';
    if (t.includes('شراء كرت')) return '/icons/shbkat.png';
    if (t.includes('سداد') || t.includes('رصيد') || t.includes('باقة')) return '/icons/rsed.png';
    if (t.includes('تجديد') || t.includes('مدفوعات') || t.includes('كهرباء') || t.includes('مياه')) return '/icons/mddfwt.png';
    if (t.includes('متجر') || t.includes('منتج')) return '/icons/slaa.png';
    if (t.includes('ألعاب') || t.includes('شدات')) return '/icons/alab.png';
    if (t.includes('سحب')) return '/icons/tahwel.png';
    return '/icons/rsed.png';
};

const generateNumericId = (id: string): string => {
    if (!id) return '000000';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        const char = id.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    const hashStr = Math.abs(hash).toString();
    if (hashStr.length >= 6) return hashStr.slice(0, 6);
    return ("000000" + hashStr).slice(-6);
};

export default function TransactionsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [appliedFrom, setAppliedFrom] = useState<string>('');
  const [appliedTo, setAppliedTo] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number>(50);

  const transactionsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, 'users', user.uid, 'transactions'),
            orderBy('transactionDate', 'desc'),
            limit(displayLimit)
          )
        : null,
    [user, firestore, displayLimit]
  );

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const safeFormatDate = (dateInput: any, formatStr: string) => {
    if (!dateInput) return '...';
    try {
        let date;
        if (typeof dateInput === 'string') {
            date = parseISO(dateInput);
        } else if (dateInput?.seconds) {
            date = new Date(dateInput.seconds * 1000);
        } else if (dateInput instanceof Date) {
            date = dateInput;
        } else {
            date = new Date(dateInput);
        }
        
        if (!isValid(date)) return '...';
        return format(date, formatStr, { locale: ar });
    } catch (e) {
        return '...';
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!appliedFrom && !appliedTo) return transactions;

    try {
        const start = appliedFrom ? startOfDay(parseISO(appliedFrom)) : new Date(0);
        const end = appliedTo ? endOfDay(parseISO(appliedTo)) : new Date();
        
        if (!isValid(start) || !isValid(end)) return transactions;

        return transactions.filter(tx => {
          let txDate;
          if (typeof tx.transactionDate === 'string') {
              txDate = parseISO(tx.transactionDate);
          } else if (tx.transactionDate?.seconds) {
              txDate = new Date(tx.transactionDate.seconds * 1000);
          } else {
              txDate = new Date(tx.transactionDate);
          }
          if (!isValid(txDate)) return false;
          return isWithinInterval(txDate, { start, end });
        });
    } catch (e) {
        return transactions;
    }
  }, [transactions, appliedFrom, appliedTo]);

  const handleFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    toast({ title: "تم تطبيق الفلترة" });
  };

  const handleResetFilter = () => {
    setFromDate('');
    setToDate('');
    setAppliedFrom('');
    setAppliedTo('');
  };

  const handleDeleteAll = () => {
    if (!firestore || !user || !transactions || transactions.length === 0) return;
    const batch = writeBatch(firestore);
    transactions.forEach(tx => batch.delete(doc(firestore, `users/${user.uid}/transactions`, tx.id)));
    batch.commit().then(() => toast({ title: 'نجاح', description: 'تمت الأرشفة بنجاح.' }));
  };
  
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncStatus = async (transid: string) => {
    if (!transid || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/payment/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transid })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: data.status === 'success' ? 'عملية جاهزة' : data.status === 'failed' ? 'عملية فاشلة' : 'تحديث الحالة',
          description: data.message
        });
        if (selectedTx && selectedTx.id === transid) {
          setSelectedTx(prev => prev ? {
            ...prev,
            status: data.status || prev.status,
            readiness: data.readiness || prev.readiness,
            notes: data.reason ? `${prev.notes || ''}\nالسبب من المزود: ${data.reason}` : prev.notes
          } : null);
        }
      } else {
        toast({ variant: 'destructive', title: 'تنبيه', description: data.message || 'تعذر التحديث حالياً' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // تحديث تلقائي صامت بمجرد تحميل القائمة إذا وُجدت أي عملية معلقة
  React.useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    const pendingTx = transactions.find(
      (tx) => isTelecomService(tx.transactionType) && (tx.status === 'pending' || tx.readiness === 'قيد الانتظار')
    );
    if (pendingTx) {
      handleSyncStatus(pendingTx.id);
    }
  }, [transactions]);

  const handleCardClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsDialogOpen(true);
    if (isTelecomService(tx.transactionType) && (tx.status === 'pending' || tx.readiness === 'قيد الانتظار')) {
      handleSyncStatus(tx.id);
    }
  };

  if (isUserLoading) return null;

  return (
    <>
      <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
        <SimpleHeader title="كشف الحساب" />
        <div className="flex-1 overflow-y-auto pb-36 no-scrollbar">
            <div className="px-4 space-y-4">
                <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                            <Filter className="w-4 h-4" />
                            تحديد فترة كشف الحساب
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground pr-1">من تاريخ</Label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl h-10 text-xs bg-background" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground pr-1">إلى تاريخ</Label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl h-10 text-xs bg-background" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold" onClick={handleResetFilter}>إعادة تعيين</Button>
                            <Button size="sm" className="rounded-xl text-xs font-bold" onClick={handleFilter}>فلترة</Button>
                        </div>
                    </CardContent>
                </Card>

                {transactions && transactions.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive flex items-center gap-2 text-xs">
                                <Archive className="h-3.5 w-3.5" />
                                أرشفة جميع العمليات السابقة
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الأرشفة</AlertDialogTitle>
                                <AlertDialogDescription>سيتم إخفاؤها نهائياً من سجلك الحالي.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row gap-2">
                                <AlertDialogCancel className="flex-1 rounded-2xl">إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90 flex-1 rounded-2xl">أرشفة الكل</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}

                <div className="space-y-1">
                    {isLoading ? (
                        [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl mb-3" />)
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-20 opacity-30">
                            <FileText className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-bold">لا توجد عمليات</p>
                        </div>
                    ) : (
                        filteredTransactions.map(tx => {
                            const isCredit = tx.transactionType.includes('تغذية') || tx.transactionType.includes('إيداع') || tx.transactionType.includes('استلام') || tx.transactionType.includes('أرباح') || tx.transactionType.includes('استرجاع');
                            const iconSrc = getTransactionIcon(tx.transactionType);
                            
                            return (
                                <Card key={tx.id} className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors border-none shadow-sm rounded-2xl bg-card mb-3" onClick={() => handleCardClick(tx)}>
                                    <CardContent className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 bg-muted/50 rounded-xl">
                                                <div className="relative h-8 w-8">
                                                    <Image src={iconSrc} alt="Tx Icon" fill className="object-contain" priority />
                                                </div>
                                            </div>
                                            <div className='text-right'>
                                                <p className="font-bold text-sm text-foreground">
                                                    {tx.transactionType.replace(/\s*\(?api\)?/gi, '').replace(/\s*-\s*api/gi, '').trim()}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-muted-foreground">{safeFormatDate(tx.transactionDate, 'd MMMM yyyy')}</p>
                                                    {(() => {
                                                        const p = extractRecipientPhone(tx);
                                                        if (!p) return null;
                                                        return (
                                                            <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                                                {p}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className={cn("font-black text-sm", isCredit ? 'text-green-600' : 'text-destructive')}>{tx.amount.toLocaleString()} ر.ي</p>
                                            {(isTelecomService(tx.transactionType) || tx.transactionType.includes('شراء كرت') || tx.status) && (() => {
                                                const readiness = getReadinessDetails(tx);
                                                return (
                                                    <span className={cn("text-[10px] font-black block mt-0.5", readiness.colorClass)}>
                                                        {readiness.text}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>

                {transactions && transactions.length >= displayLimit && (
                    <div className="pt-2 pb-6 text-center">
                        <Button
                            variant="outline"
                            onClick={() => setDisplayLimit(prev => prev + 50)}
                            className="w-full h-11 rounded-2xl font-bold border-dashed text-primary hover:text-primary hover:bg-primary/5 shadow-sm"
                        >
                            عرض المزيد من العمليات (+50)
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </div>
      
      <TransactionDetailsModal
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          transaction={selectedTx}
          onSyncStatus={handleSyncStatus}
          isSyncing={isSyncing}
      />
      <Toaster />
    </>
  );
}
