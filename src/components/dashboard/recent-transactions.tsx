'use client';

import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronLeft, 
  CreditCard,
  Wallet,
  Wifi,
  SatelliteDish,
  ShoppingBag,
  Smartphone,
  Undo2,
  TrendingUp,
  Send,
  Banknote,
  Tag,
  Calendar,
  Clock,
  Activity,
  User as UserIcon,
  Copy,
  FileText,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import { TransactionDetailsModal, extractRecipientPhone } from '@/components/layout/transaction-details-modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isTelecomService, getReadinessDetails } from '@/lib/telecom-order';

type Transaction = {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  notes?: string;
  subscriberName?: string;
  cardNumber?: string;
  recipientPhoneNumber?: string;
  paymentMethodName?: string;
  recipientName?: string;
  accountNumber?: string;
  status?: string;
  readiness?: string;
};

const getTransactionIcon = (type?: string) => {
    if (!type || typeof type !== 'string') return '/icons/rsed.png';
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

export function RecentTransactions() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  const historyDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, `users/${user.uid}/transactions`, 'history') : null),
    [user, firestore]
  );
  const { data: historyData, isLoading } = useDoc<any>(historyDocRef);

  const transactions: Transaction[] = React.useMemo(() => {
    if (!historyData) return [];
    const arr = Array.isArray(historyData.list) && historyData.list.length > 0
      ? historyData.list
      : (Array.isArray(historyData.transactions) ? historyData.transactions : []);

    return arr.map((item: any) => {
      const id = String(item.id || item.transid || item.operationId || '');
      const t = String(item.transactionType || item.t || item.operationType || item.notes || 'عملية مالية');
      const a = Number(item.amount ?? item.a ?? 0) || 0;
      const d = item.transactionDate || item.d || item.createdAt || item.date || new Date().toISOString();
      const s = String(item.status || item.s || 'success');
      const r = String(item.readiness || item.r || (s === 'completed' || s === 'جاهز' ? 'جاهز' : (s === 'pending' ? 'قيد الانتظار' : 'غير جاهز')));
      const ph = String(item.recipientPhoneNumber || item.ph || item.phone || item.mobile || item.targetPhone || '');
      const notes = String(item.notes || item.note || '');

      return {
        ...item,
        id,
        transactionType: t,
        amount: a,
        transactionDate: d,
        status: s,
        readiness: r,
        recipientPhoneNumber: ph,
        notes,
      } as Transaction;
    }).sort((a, b) => {
      const timeA = new Date(a.transactionDate || 0).getTime();
      const timeB = new Date(b.transactionDate || 0).getTime();
      return timeB - timeA;
    }).slice(0, 2);
  }, [historyData]);

  // تحديث تلقائي صامت بمجرد تحميل القائمة إذا وُجدت أي عملية معلقة (دون تدخل العميل ودون قراءات متكررة)
  React.useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    const pendingTx = transactions.find(
      (tx) => isTelecomService(tx.transactionType) && (tx.status === 'pending' || tx.readiness === 'قيد الانتظار')
    );
    if (pendingTx) {
      handleSyncStatus(pendingTx.id);
    }
  }, [transactions]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
        title: "تم النسخ",
        description: `تم نسخ ${label} بنجاح.`,
    });
  };

  return (
    <div className="px-4 pt-2 pb-10">
        <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-lg font-bold text-primary">آخر العمليات</h3>
            <Link href="/transactions" className="flex items-center text-sm text-primary font-bold">
                <span>الكل</span>
                <ChevronLeft className="h-4 w-4"/>
            </Link>
        </div>
        
        <div className="space-y-3">
            {isLoading ? (
                [1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-3xl" />)
            ) : transactions && transactions.length > 0 ? (
                transactions.map((tx) => {
                    const txType = tx.transactionType || '';
                    const isCredit = txType.includes('تغذية') || 
                                   txType.includes('استلام') || 
                                   txType.includes('أرباح') || 
                                   txType.includes('استرجاع') || 
                                   txType.includes('إيداع');
                    
                    const iconSrc = getTransactionIcon(txType);
                    const phone = extractRecipientPhone(tx);
                    
                    return (
                        <Card 
                            key={tx.id} 
                            onClick={() => {
                                setSelectedTx(tx);
                                setIsDialogOpen(true);
                                if (isTelecomService(txType) && (tx.status === 'pending' || tx.readiness === 'قيد الانتظار')) {
                                    handleSyncStatus(tx.id);
                                }
                            }}
                            className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-card cursor-pointer hover:bg-muted/30 transition-all active:scale-[0.98]"
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="p-1 bg-muted/30 rounded-xl border border-border/50 shrink-0">
                                    <div className="relative h-8 w-8">
                                        <Image src={iconSrc} alt="Tx Icon" fill className="object-contain" priority />
                                    </div>
                                </div>

                                <div className="flex-1 text-right mx-4 overflow-hidden">
                                    <p className="font-bold text-primary text-sm truncate">
                                        {txType.replace(/\s*\(?api\)?/gi, '').replace(/\s*-\s*api/gi, '').trim() || 'عملية مالية'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] text-primary/70 font-semibold">
                                            {tx.transactionDate ? format(parseISO(tx.transactionDate), 'd MMMM', { locale: ar }) : 'منذ فترة'}
                                        </p>
                                        {phone && (
                                            <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                                {phone}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-left shrink-0">
                                    <p className={`font-bold text-base ${isCredit ? 'text-green-600' : 'text-destructive'}`}>
                                        {tx.amount.toLocaleString('en-US')} ر.ي
                                    </p>
                                    {(isTelecomService(tx.transactionType) || tx.transactionType.includes('شراء كرت') || tx.status) ? (() => {
                                        const readiness = getReadinessDetails(tx);
                                        return (
                                            <p className={cn("text-[10px] font-black mt-0.5", readiness.colorClass)}>
                                                {readiness.text}
                                            </p>
                                        );
                                    })() : (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">ناجحة</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })
            ) : (
                <div className="text-center py-10 bg-muted/10 rounded-3xl">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
                    <p className="mt-2 text-xs text-muted-foreground">لا توجد عمليات بعد</p>
                </div>
            )}
        </div>

        <TransactionDetailsModal
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          transaction={selectedTx}
          onSyncStatus={handleSyncStatus}
          isSyncing={isSyncing}
        />
    </div>
  );
}
