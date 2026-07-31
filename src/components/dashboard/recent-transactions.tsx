
'use client';

import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
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
  User as UserIcon,
  Copy,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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
};

const getTransactionIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('استرجاع')) return Undo2;
    if (t.includes('تغذية') || t.includes('إيداع') || t.includes('استلام')) return Wallet;
    if (t.includes('تحويل')) return Send;
    if (t.includes('سحب')) return Banknote;
    if (t.includes('شراء كرت')) return Wifi;
    if (t.includes('سداد') || t.includes('رصيد') || t.includes('باقة')) return Smartphone;
    if (t.includes('تجديد')) return SatelliteDish;
    if (t.includes('متجر') || t.includes('منتج')) return ShoppingBag;
    if (t.includes('أرباح')) return TrendingUp;
    return CreditCard;
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

  const transactionsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, 'users', user.uid, 'transactions'),
            orderBy('transactionDate', 'desc'),
            limit(2)
          )
        : null,
    [user, firestore]
  );

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
        title: "تم النسخ",
        description: `تم نسخ ${label} بنجاح.`,
    });
  };

  return (
    <div className="px-4 pt-2 pb-10 animate-in fade-in-0 duration-500">
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
                    const isCredit = tx.transactionType.includes('تغذية') || 
                                   tx.transactionType.includes('استلام') || 
                                   tx.transactionType.includes('أرباح') || 
                                   tx.transactionType.includes('استرجاع') || 
                                   tx.transactionType.includes('إيداع');
                    
                    const Icon = getTransactionIcon(tx.transactionType);
                    
                    return (
                        <Dialog key={tx.id} open={isDialogOpen && selectedTx?.id === tx.id} onOpenChange={(open) => {
                            if (open) {
                                setSelectedTx(tx);
                                setIsDialogOpen(true);
                            } else {
                                setIsDialogOpen(false);
                                setSelectedTx(null);
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-card cursor-pointer hover:bg-muted/30 transition-all active:scale-[0.98]">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="p-2.5 bg-muted/30 rounded-xl border border-border/50 shrink-0">
                                            <Icon className="h-4 w-4" style={{ stroke: 'url(#icon-gradient)' }} />
                                        </div>

                                        <div className="flex-1 text-right mx-4 overflow-hidden">
                                            <p className="font-bold text-primary text-sm truncate">{tx.transactionType}</p>
                                            <p className="text-[10px] text-primary/70 font-semibold mt-0.5">
                                                {tx.transactionDate ? format(parseISO(tx.transactionDate), 'd MMMM', { locale: ar }) : 'منذ فترة'}
                                            </p>
                                        </div>

                                        <div className="text-left shrink-0">
                                            <p className={`font-bold text-base ${isCredit ? 'text-green-600' : 'text-destructive'}`}>
                                                {tx.amount.toLocaleString('en-US')} ر.ي
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">ناجحة</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </DialogTrigger>
                            {selectedTx && (
                                <DialogContent className="rounded-[32px] max-w-[90vw] sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-center font-black">تفاصيل العملية</DialogTitle>
                                        <DialogDescription className="text-center">
                                            الرقم المرجعي: {generateNumericId(selectedTx.id)}
                                        </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4 text-sm">
                                        <div className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="text-muted-foreground flex items-center gap-2"><Tag className="h-4 w-4 text-primary"/> نوع العملية:</span>
                                            <span className="font-bold">{selectedTx.transactionType}</span>
                                        </div>
                                        
                                        {selectedTx.recipientPhoneNumber && (
                                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                                <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary"/> رقم الجوال:</span>
                                                <span className="font-mono font-bold tracking-wider">{selectedTx.recipientPhoneNumber}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="text-muted-foreground flex items-center gap-2"><Banknote className="h-4 w-4 text-primary"/> المبلغ:</span>
                                            <span className={`font-black text-lg ${isCredit ? 'text-green-600' : 'text-destructive'}`}>
                                                {selectedTx.amount.toLocaleString('en-US')} ريال
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4 text-primary"/> التاريخ:</span>
                                            <span className="font-bold">
                                                {selectedTx.transactionDate ? format(parseISO(selectedTx.transactionDate), 'eeee, d MMMM yyyy', { locale: ar }) : '...'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary"/> الوقت:</span>
                                            <span className="font-bold">
                                                {selectedTx.transactionDate ? format(parseISO(selectedTx.transactionDate), 'h:mm:ss a', { locale: ar }) : '...'}
                                            </span>
                                        </div>

                                        {selectedTx.subscriberName && (
                                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                                <span className="text-muted-foreground flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary"/> اسم المشترك:</span>
                                                <span className="font-bold">{selectedTx.subscriberName}</span>
                                            </div>
                                        )}

                                        {selectedTx.cardNumber && (
                                            <div className="pt-4 mt-2 bg-muted/30 p-4 rounded-2xl">
                                                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary"><CreditCard className="w-4 h-4"/> تفاصيل الكرت المستلم</h4>
                                                <div className="flex justify-between items-center bg-background p-3 rounded-xl border">
                                                    <span className="text-xs text-muted-foreground">رقم الكرت:</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono font-black text-lg tracking-widest">{selectedTx.cardNumber}</span>
                                                        <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" onClick={() => handleCopy(selectedTx.cardNumber!, 'رقم الكرت')}>
                                                            <Copy className="h-4 w-4"/>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedTx.notes && (
                                            <div className="pt-2">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">ملاحظات إضافية</p>
                                                <p className="text-xs font-bold bg-muted/50 p-3 rounded-xl border border-border/50">{selectedTx.notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button className="w-full rounded-2xl h-12 font-black">إغلاق</Button>
                                        </DialogClose>
                                    </DialogFooter>
                                </DialogContent>
                            )}
                        </Dialog>
                    );
                })
            ) : (
                <div className="text-center py-10 bg-muted/10 rounded-3xl">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
                    <p className="mt-2 text-xs text-muted-foreground">لا توجد عمليات بعد</p>
                </div>
            )}
        </div>
    </div>
  );
}
