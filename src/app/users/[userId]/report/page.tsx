'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Phone, 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  FileText, 
  SatelliteDish, 
  Undo2, 
  CreditCard, 
  Smartphone,
  ShoppingBag,
  Send,
  TrendingUp,
  Wifi
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

type UserProfile = {
  displayName: string;
  phoneNumber?: string;
  balance?: number;
};

type Transaction = {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  notes?: string;
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


function UserReportPage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();

  // Fetch user profile
  const userDocRef = useMemoFirebase(
    () => (firestore && userId ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userDocRef);

  // Fetch user transactions
  const transactionsQuery = useMemoFirebase(
    () => (firestore && userId ? query(collection(firestore, 'users', userId, 'transactions'), orderBy('transactionDate', 'desc')) : null),
    [firestore, userId]
  );
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const isLoading = isLoadingProfile || isLoadingTransactions;

  const renderTransactionList = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      );
    }
    if (!transactions || transactions.length === 0) {
      return (
        <div className="text-center py-10">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">لا توجد عمليات لهذا المستخدم.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {transactions.map((tx) => (
          <Card key={tx.id} className="overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  {getTransactionIcon(tx.transactionType)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tx.transactionType}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(parseISO(tx.transactionDate), 'd MMMM yyyy, h:mm a', { locale: ar })}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className={`font-bold text-sm ${tx.transactionType.includes('تغذية') || tx.transactionType.includes('استلام') || tx.transactionType.includes('أرباح') || tx.transactionType.includes('استرجاع') || tx.transactionType.includes('إيداع') ? 'text-green-600' : 'text-destructive'}`}>
                  {tx.amount.toLocaleString('en-US')} ريال
                </p>
                {tx.notes && (
                  <p className="text-xs text-muted-foreground truncate max-w-[120px]" title={tx.notes}>
                    {tx.notes}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title={userProfile ? `تقرير: ${userProfile.displayName}` : 'تحميل التقرير...'} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">معلومات العميل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingProfile ? (
              <>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
              </>
            ) : userProfile ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-2"><User className="h-4 w-4"/>الاسم:</span>
                  <span className="font-semibold">{userProfile.displayName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4"/>الرقم:</span>
                  <span className="font-semibold">{userProfile.phoneNumber || 'غير متوفر'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4"/>الرصيد الحالي:</span>
                  <span className="font-bold text-lg text-primary">{(userProfile.balance ?? 0).toLocaleString('en-US')} ريال</span>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">لم يتم العثور على المستخدم.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">سجل العمليات</CardTitle>
          </CardHeader>
          <CardContent>
            {renderTransactionList()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default UserReportPage;
