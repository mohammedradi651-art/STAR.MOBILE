'use client';

import React, { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  FileText, 
  SatelliteDish, 
  User as UserIcon, 
  CreditCard, 
  Trash2, 
  Calendar, 
  Clock, 
  Archive, 
  Undo2, 
  Wifi, 
  Building, 
  Copy, 
  Smartphone,
  ShoppingBag,
  Send,
  Wallet,
  TrendingUp,
  Banknote,
  Search,
  Filter,
  Tag
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const dynamic = 'force-dynamic';

type Transaction = {
  id: string;
  transactionDate: string;
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
};

const getTransactionIcon = (type: string) => {
    if (type.includes('استرجاع')) {
        return <Undo2 className="h-6 w-6 text-orange-500" />;
    }
    if (type.includes('تغذية') || type.includes('إيداع') || type.includes('استلام')) {
        return <Wallet className="h-6 w-6 text-green-500" />;
    }
    if (type.includes('تحويل')) {
        return <Send className="h-6 w-6 text-blue-500" />;
    }
    if (type.includes('سحب')) {
        return <ArrowUpFromLine className="h-6 w-6 text-destructive" />;
    }
    if (type.includes('شراء كرت')) {
        return <Wifi className="h-6 w-6 text-primary" />;
    }
    if (type.includes('سداد') || type.includes('باقة')) {
        return <Smartphone className="h-6 w-6 text-primary" />;
    }
    if (type.includes('تجديد')) {
        return <SatelliteDish className="h-6 w-6 text-primary" />;
    }
    if (type.includes('متجر') || type.includes('منتج')) {
        return <ShoppingBag className="h-6 w-6 text-pink-500" />;
    }
    if (type.includes('أرباح')) {
        return <TrendingUp className="h-6 w-6 text-green-600" />;
    }
    return <FileText className="h-6 w-6 text-muted-foreground" />;
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


export default function TransactionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteAllAlertOpen, setIsDeleteAllAlertOpen] = useState(false);
  
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [appliedFrom, setAppliedFrom] = useState<string>('');
  const [appliedTo, setAppliedTo] = useState<string>('');

  const transactionsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, 'users', user.uid, 'transactions'),
            orderBy('transactionDate', 'desc')
          )
        : null,
    [user, firestore]
  );

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!appliedFrom && !appliedTo) return transactions;

    try {
        const start = appliedFrom ? startOfDay(parseISO(appliedFrom)) : new Date(0);
        const end = appliedTo ? endOfDay(parseISO(appliedTo)) : new Date();
        
        if (!isValid(start) || !isValid(end)) return transactions;

        return transactions.filter(tx => {
          const txDate = parseISO(tx.transactionDate);
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
    toast({
        title: "تم تطبيق الفلترة",
        description: `عرض العمليات من ${fromDate || 'البداية'} إلى ${toDate || 'اليوم'}`,
    });
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
    const userTransactionsPath = `users/${user.uid}/transactions`;

    transactions.forEach(transaction => {
      const docRef = doc(firestore, userTransactionsPath, transaction.id);
      batch.delete(docRef);
    });

    batch.commit()
      .then(() => {
        toast({
          title: 'نجاح',
          description: 'تمت أرشفة جميع العمليات بنجاح.'
        });
      })
      .catch((serverError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: userTransactionsPath
        });
        errorEmitter.emit('permission-error', contextualError);
      });
      
    setIsDeleteAllAlertOpen(false);
  };
  
  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
        title: "تم النسخ",
        description: `تم نسخ ${label} بنجاح.`,
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="text-left space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!filteredTransactions || filteredTransactions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-64">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">لا توجد عمليات</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            لم يتم العثور على عمليات في هذه الفترة.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredTransactions.map((tx) => (
            <Dialog key={tx.id} onOpenChange={(isOpen) => {
                if (isOpen) {
                    setSelectedTx(tx);
                    setIsDialogOpen(true);
                } else {
                    setSelectedTx(null);
                    setIsDialogOpen(false);
                }
            }}>
                <DialogTrigger asChild>
                    <Card className="overflow-hidden animate-in fade-in-0 cursor-pointer hover:bg-muted/50 transition-colors border-none shadow-sm rounded-2xl bg-card">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted/50 rounded-xl">
                                {getTransactionIcon(tx.transactionType)}
                            </div>
                            <div className='text-right'>
                            <p className="font-bold text-sm text-foreground">{tx.transactionType}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {format(parseISO(tx.transactionDate), 'd MMMM yyyy, h:mm a', { locale: ar })}
                            </p>
                            </div>
                        </div>
                        <div className="text-left">
                            <p className={`font-black text-sm ${tx.transactionType.includes('تغذية') || tx.transactionType.includes('استلام') || tx.transactionType.includes('أرباح') || tx.transactionType.includes('استرجاع') || tx.transactionType.includes('إيداع') ? 'text-green-600' : 'text-destructive'}`}>
                              {tx.amount.toLocaleString('en-US')} ريال
                            </p>
                            {tx.notes && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-[100px] mt-0.5" title={tx.notes}>
                                    {tx.notes}
                                </p>
                            )}
                        </div>
                        </CardContent>
                    </Card>
                </DialogTrigger>
                {isDialogOpen && selectedTx && selectedTx.id === tx.id && (
                    <DialogContent className="rounded-3xl">
                        <DialogHeader>
                        <DialogTitle className="text-center">تفاصيل العملية</DialogTitle>
                        <DialogDescription className="text-center">
                            العملية المرجعية: {generateNumericId(selectedTx.id)}
                        </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4 text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Tag className="h-4 w-4 text-primary"/> نوع العملية:</span>
                                <span className="font-bold">{selectedTx.transactionType}</span>
                            </div>
                             {selectedTx.notes && (selectedTx.transactionType.includes('شراء كرت') || selectedTx.transactionType.includes('تجديد')) && (
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground flex items-center gap-2"><Wifi className="h-4 w-4 text-primary"/> الشبكة:</span>
                                    <span className="font-bold">{selectedTx.notes.replace('شبكة: ', '')}</span>
                                </div>
                            )}
                             {selectedTx.recipientPhoneNumber && (
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary"/> رقم الجوال:</span>
                                    <span className="font-mono font-bold tracking-wider">{selectedTx.recipientPhoneNumber}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Banknote className="h-4 w-4 text-primary"/> المبلغ:</span>
                                <span className={`font-black text-lg ${selectedTx.transactionType.includes('تغذية') || selectedTx.transactionType.includes('استلام') || selectedTx.transactionType.includes('أرباح') || selectedTx.transactionType.includes('استرجاع') || selectedTx.transactionType.includes('إيداع') ? 'text-green-600' : 'text-destructive'}`}>
                                    {selectedTx.amount.toLocaleString('en-US')} ريال
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4 text-primary"/> التاريخ:</span>
                                <span className="font-bold">
                                {format(parseISO(selectedTx.transactionDate), 'eeee, d MMMM yyyy', { locale: ar })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary"/> الوقت:</span>
                                <span className="font-bold">{format(parseISO(selectedTx.transactionDate), 'h:mm:ss a', { locale: ar })}</span>
                            </div>
                             {selectedTx.subscriberName && (
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary"/> اسم المشترك:</span>
                                    <span className="font-bold">{selectedTx.subscriberName}</span>
                                </div>
                            )}
                            
                            {(selectedTx.cardNumber) && (
                                 <div className="pt-4 mt-2 bg-muted/30 p-4 rounded-2xl">
                                     <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary"><CreditCard className="w-4 h-4"/> تفاصيل الكرت المستلم</h4>
                                        <div className="space-y-2">
                                            {selectedTx.cardNumber && 
                                                <div className="flex justify-between items-center bg-background p-3 rounded-xl border">
                                                    <span className="text-xs text-muted-foreground">رقم الكرت:</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono font-black text-lg tracking-widest">{selectedTx.cardNumber}</span>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleCopy(selectedTx.cardNumber!, 'رقم الكرت')}>
                                                            <Copy className="h-4 w-4"/>
                                                        </Button>
                                                    </div>
                                                </div>
                                            }
                                        </div>
                                 </div>
                            )}
                             {selectedTx.transactionType === 'سحب أرباح' && (
                                <div className="pt-4 mt-2 bg-muted/30 p-4 rounded-2xl">
                                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary"><Banknote className="w-4 h-4"/> تفاصيل السحب</h4>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><Building className="h-4 w-4"/> البنك:</span>
                                            <span className="font-bold">{selectedTx.paymentMethodName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><UserIcon className="h-4 w-4"/> المستلم:</span>
                                            <span className="font-bold">{selectedTx.recipientName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2"><CreditCard className="h-4 w-4"/> الحساب:</span>
                                            <span className="font-mono font-bold tracking-wider">{selectedTx.accountNumber}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button className="w-full rounded-2xl h-12 font-bold">إغلاق</Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background">
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
                                <Label htmlFor="fromDate" className="text-[10px] text-muted-foreground pr-1">من تاريخ</Label>
                                <Input 
                                    id="fromDate"
                                    type="date" 
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="rounded-xl h-10 text-xs bg-background cursor-pointer"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="toDate" className="text-[10px] text-muted-foreground pr-1">إلى تاريخ</Label>
                                <Input 
                                    id="toDate"
                                    type="date" 
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="rounded-xl h-10 text-xs bg-background cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl text-xs font-bold" 
                                onClick={handleResetFilter}
                            >
                                إعادة تعيين
                            </Button>
                            <Button 
                                size="sm" 
                                className="rounded-xl text-xs font-bold" 
                                onClick={handleFilter}
                            >
                                <Search className="w-3 h-3 ml-1.5" />
                                فلترة
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {transactions && transactions.length > 0 && !appliedFrom && !appliedTo && (
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
                                <AlertDialogDescription>
                                    هل أنت متأكد من رغبتك في أرشفة جميع العمليات؟ سيتم إخفاؤها نهائياً من سجلك الحالي.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row gap-2">
                                <AlertDialogCancel className="flex-1 rounded-2xl">إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90 flex-1 rounded-2xl">
                                    أرشفة الكل
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}

                <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-bold text-primary">
                        {appliedFrom || appliedTo ? 'نتائج البحث' : 'أحدث العمليات'}
                    </h3>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold">
                        {filteredTransactions.length} عملية
                    </span>
                </div>

                <div className="space-y-1">
                    {renderContent()}
                </div>
            </div>
        </div>
      </div>
      <Toaster />
    </>
  );
}
