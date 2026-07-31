'use client';

import React, { useMemo, useState } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Tag, Phone, CreditCard, Calendar, Wallet, TrendingUp } from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


type RenewalRequest = {
  id: string;
  userName: string;
  userPhoneNumber: string;
  packageTitle: string;
  packagePrice: number;
  subscriberName: string;
  cardNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  requestTimestamp: string;
};

const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
  <div className="flex justify-between items-center text-xs py-2 border-b last:border-b-0">
      <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" /> {label}:</span>
      <span className="font-semibold">{typeof value === 'number' ? `${value.toLocaleString('en-US')} ريال` : value}</span>
  </div>
);

const StatusBadge = ({ status }: { status: RenewalRequest['status'] }) => {
    const statusStyles = {
      pending: 'bg-yellow-400/20 text-yellow-600 border-yellow-400/30',
      approved: 'bg-green-400/20 text-green-600 border-green-400/30',
      rejected: 'bg-red-400/20 text-red-600 border-red-400/30',
    };
    const statusText = {
      pending: 'قيد الانتظار',
      approved: 'مقبول',
      rejected: 'مرفوض',
    };
  
    return <Badge className={statusStyles[status]}>{statusText[status]}</Badge>;
};

export default function AlwadiReportsPage() {
  const firestore = useFirestore();
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'renewalRequests'),
        orderBy('requestTimestamp', 'desc')
    ) : null),
    [firestore]
  );
  const { data: allRequests, isLoading } = useCollection<RenewalRequest>(requestsQuery);

  const filteredRequests = useMemo(() => {
    if (!allRequests) return [];
    if (filter === 'all') return allRequests;
    return allRequests.filter(req => req.status === filter);
  }, [allRequests, filter]);
  
  const { monthlyData, totalAmount, totalProfit } = useMemo(() => {
    if (!allRequests) { 
      return { monthlyData: {}, totalAmount: 0, totalProfit: 0 };
    }

    const data: { [key: string]: RenewalRequest[] } = {};
    let total = 0;

    filteredRequests.forEach(req => {
        const monthKey = format(parseISO(req.requestTimestamp), 'yyyy-MM');
        if (!data[monthKey]) {
          data[monthKey] = [];
        }
        data[monthKey].push(req);
    });

    allRequests.forEach(req => {
        if (req.status === 'approved') {
            total += req.packagePrice;
        }
    });

    return {
        monthlyData: data,
        totalAmount: total,
        totalProfit: total * 0.05
    };
  }, [allRequests, filteredRequests]);

  const sortedMonths = Object.keys(monthlyData).sort().reverse();
  
  React.useEffect(() => {
    if (sortedMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(sortedMonths[0]);
    }
  }, [sortedMonths, selectedMonth]);
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    if (!allRequests || allRequests.length === 0) {
        return <p className="text-center text-muted-foreground mt-10">لا توجد طلبات لعرضها.</p>;
    }
    
    const monthRequests = selectedMonth ? monthlyData[selectedMonth] : [];
    const monthTotal = monthRequests
      ?.filter(req => req.status === 'approved')
      .reduce((sum, req) => sum + req.packagePrice, 0) || 0;

    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي المبالغ (المقبولة)</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary dark:text-primary-foreground">{totalAmount.toLocaleString('en-US')}</div>
                    <p className="text-xs text-muted-foreground">ريال يمني</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي الربح (5%)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{totalProfit.toLocaleString('en-US')}</div>
                    <p className="text-xs text-muted-foreground">ريال يمني</p>
                </CardContent>
            </Card>
        </div>
        
        <Tabs defaultValue="all" onValueChange={(value) => setFilter(value as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="approved">المقبولة</TabsTrigger>
                <TabsTrigger value="rejected">المرفوضة</TabsTrigger>
            </TabsList>
        </Tabs>

         {sortedMonths.length > 0 && selectedMonth && (
          <div className='space-y-4'>
            <Select onValueChange={setSelectedMonth} value={selectedMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر شهراً" />
              </SelectTrigger>
              <SelectContent>
                {sortedMonths.map(monthKey => (
                   <SelectItem key={monthKey} value={monthKey}>
                    {format(parseISO(`${monthKey}-01`), 'MMMM yyyy', { locale: ar })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Card>
                <CardHeader>
                    <CardTitle className='text-base flex justify-between items-center'>
                       <span>طلبات شهر {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: ar })}</span>
                       <span className='text-sm font-bold text-primary dark:text-primary-foreground'>{monthTotal.toLocaleString('en-US')} ريال</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {monthRequests && monthRequests.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {monthRequests.map(request => (
                                <AccordionItem value={request.id} key={request.id}>
                                    <AccordionTrigger className="p-3 bg-muted/30 rounded-t-lg text-sm [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b">
                                        <div className="flex justify-between items-center flex-1 me-4">
                                            <h4 className="font-bold">{request.userName}</h4>
                                            <StatusBadge status={request.status} />
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-3 bg-muted/30 border-t-0 rounded-b-lg">
                                       <div className="space-y-1">
                                            <InfoRow icon={Tag} label="الباقة" value={request.packageTitle} />
                                            <InfoRow icon={CreditCard} label="رقم الكرت" value={request.cardNumber} />
                                            <InfoRow icon={Calendar} label="التاريخ" value={format(parseISO(request.requestTimestamp), 'd/M/y, h:mm a', { locale: ar })} />
                                            <InfoRow icon={Wallet} label="المبلغ" value={request.packagePrice} />
                                       </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : <p className="text-center text-muted-foreground py-4">لا توجد طلبات لهذا الشهر.</p>}
                </CardContent>
            </Card>
          </div>
         )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="تقارير منظومة الوادي" />
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
