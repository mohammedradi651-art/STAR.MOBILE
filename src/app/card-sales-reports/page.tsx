
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch, increment, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, User, CreditCard, Calendar, AlertCircle, Banknote, Check, TrendingUp, Loader2, Trash2, Archive, Inbox } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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

type Network = {
  id: string;
  name: string;
  location: string;
  ownerId: string;
};

type SoldCard = {
    id: string;
    cardNumber: string;
    buyerName: string;
    buyerPhoneNumber: string;
    soldTimestamp: string;
    price: number;
    payoutAmount: number;
    commissionAmount: number;
    categoryName: string;
    payoutStatus: 'pending' | 'completed';
    ownerId: string;
    networkName?: string;
};

const InfoRow = ({ icon: Icon, label, value, isMono = false, valueClassName }: { icon: React.ElementType, label: string, value: string | number, isMono?: boolean, valueClassName?: string }) => (
    <div className="flex justify-between items-center text-xs py-2 border-b last:border-b-0">
        <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" /> {label}:</span>
        <span className={isMono ? 'font-mono' : `font-semibold ${valueClassName}`}>
            {typeof value === 'number' ? `${value.toLocaleString('en-US')} ريال` : value}
        </span>
    </div>
);

const NetworkDetails = ({ network }: { network: Network }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isTransferring, setIsTransferring] = useState<string | null>(null);
    const [isClearing, setIsClearing] = useState(false);

    const soldCardsQuery = useMemoFirebase(
      () => firestore ? query(collection(firestore, 'soldCards'), where('networkId', '==', network.id)) : null,
      [firestore, network.id]
    );
    const { data: rawSoldCards, isLoading: isLoadingSold } = useCollection<SoldCard>(soldCardsQuery);
    
    const { pendingCards, completedCards } = useMemo(() => {
        if (!rawSoldCards) return { pendingCards: [], completedCards: [] };
        const sorted = [...rawSoldCards].sort((a, b) => new Date(b.soldTimestamp).getTime() - new Date(a.soldTimestamp).getTime());
        return {
            pendingCards: sorted.filter(c => c.payoutStatus === 'pending'),
            completedCards: sorted.filter(c => c.payoutStatus === 'completed')
        };
    }, [rawSoldCards]);

    const { totalSales, totalPayout, totalCommission } = useMemo(() => {
        if (!rawSoldCards) return { totalSales: 0, totalPayout: 0, totalCommission: 0 };
        return rawSoldCards.reduce((acc, card) => {
            acc.totalSales += card.price;
            acc.totalPayout += card.payoutAmount;
            acc.totalCommission += card.commissionAmount;
            return acc;
        }, { totalSales: 0, totalPayout: 0, totalCommission: 0 });
    }, [rawSoldCards]);

    const handleTransferProfit = (card: SoldCard) => {
        if (!firestore || !card.ownerId) {
            toast({ variant: "destructive", title: "خطأ", description: "معلومات المالك غير متوفرة لهذا الكرت." });
            return; 
        }
        
        setIsTransferring(card.id);

        const batch = writeBatch(firestore);
        const now = new Date().toISOString();
        const payoutAmount = Number(card.payoutAmount) || 0;

        // 1. تحويل الرصيد للمالك
        const ownerRef = doc(firestore, 'users', card.ownerId);
        batch.update(ownerRef, { balance: increment(payoutAmount) });

        // 2. إضافة سجل عملية للمالك
        const ownerTxRef = doc(collection(firestore, `users/${card.ownerId}/transactions`));
        batch.set(ownerTxRef, {
            userId: card.ownerId,
            transactionDate: now,
            amount: payoutAmount,
            transactionType: 'أرباح مبيعات الكروت',
            notes: `تم تحويل أرباح كرت ${card.categoryName} - شبكة: ${network.name}`
        });

        // 3. أرشفة الطلب بدلاً من حذفه
        batch.update(doc(firestore, 'soldCards', card.id), { payoutStatus: 'completed' });

        batch.commit()
            .then(() => {
                toast({ title: "تم التحويل", description: "تم تحويل الربح للمالك وأرشفة الطلب." });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: `soldCards/${card.id}`,
                    operation: 'update'
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsTransferring(null);
            });
    };

    const handleClearNetworkArchive = async () => {
        if (!firestore || completedCards.length === 0) return;
        setIsClearing(true);
        try {
            const batch = writeBatch(firestore);
            completedCards.forEach(card => {
                batch.delete(doc(firestore, 'soldCards', card.id));
            });
            await batch.commit();
            toast({ title: "تم مسح الأرشيف", description: "تم تنظيف قائمة المبيعات المؤرشفة لهذه الشبكة." });
        } catch (e) {
            toast({ variant: "destructive", title: "خطأ", description: "فشل مسح الأرشيف." });
        } finally {
            setIsClearing(false);
        }
    };

    if (isLoadingSold) {
        return (
            <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <Card className="border-none bg-primary/5 p-2">
                    <p className="text-[8px] font-black uppercase text-primary mb-1">المبيعات</p>
                    <div className="text-sm font-black text-primary">{totalSales.toLocaleString()}</div>
                </Card>
                <Card className="border-none bg-green-500/5 p-2">
                    <p className="text-[8px] font-black uppercase text-green-600 mb-1">للمالك</p>
                    <div className="text-sm font-black text-green-600">{totalPayout.toLocaleString()}</div>
                </Card>
                <Card className="border-none bg-orange-500/5 p-2">
                    <p className="text-[8px] font-black uppercase text-orange-600 mb-1">العمولة</p>
                    <div className="text-sm font-black text-orange-600">{totalCommission.toLocaleString()}</div>
                </Card>
            </div>

            <Tabs defaultValue="new" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50 h-10 p-1 mb-4">
                    <TabsTrigger value="new" className="rounded-lg text-[10px] font-black data-[state=active]:bg-primary data-[state=active]:text-white">
                        <Inbox className="w-3 h-3 ml-1.5" /> جديد ({pendingCards.length})
                    </TabsTrigger>
                    <TabsTrigger value="archive" className="rounded-lg text-[10px] font-black data-[state=active]:bg-muted-foreground data-[state=active]:text-white">
                        <Archive className="w-3 h-3 ml-1.5" /> الأرشيف ({completedCards.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="new" className="space-y-3 mt-0">
                    {pendingCards.length > 0 ? (
                        pendingCards.map(card => (
                            <Card key={card.id} className="p-3 bg-white dark:bg-slate-900 border-none rounded-2xl relative shadow-sm">
                                <InfoRow icon={CreditCard} label="رقم الكرت" value={card.cardNumber} isMono />
                                <InfoRow icon={User} label="المشتري" value={card.buyerName} />
                                <InfoRow icon={Calendar} label="تاريخ البيع" value={format(parseISO(card.soldTimestamp), 'd/M/y, h:mm a', { locale: ar })} />
                                <InfoRow icon={Banknote} label="سعر البيع" value={card.price} valueClassName="text-primary" />
                                <InfoRow icon={TrendingUp} label="حصة المالك" value={card.payoutAmount} valueClassName="text-green-600" />
                                
                                <div className="flex justify-between items-center pt-3 mt-2 border-t border-dashed">
                                    <Badge className="bg-orange-500/10 text-orange-600 border-none px-3 py-1 rounded-lg">
                                        <span className="text-[9px] font-black">انتظار التحويل</span>
                                    </Badge>
                                    <Button 
                                        size="sm" 
                                        className="h-7 text-[9px] font-black bg-green-600 hover:bg-green-700 shadow-sm"
                                        onClick={() => handleTransferProfit(card)}
                                        disabled={!!isTransferring}
                                    >
                                        {isTransferring === card.id ? <Loader2 className="animate-spin h-3 w-3" /> : "تحويل الربح للمالك"}
                                    </Button>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-10 text-xs font-bold">لا توجد مبيعات جديدة حالياً.</p>
                    )}
                </TabsContent>

                <TabsContent value="archive" className="space-y-3 mt-0">
                    {completedCards.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-8 text-[9px] text-muted-foreground hover:text-destructive mb-2"
                            onClick={handleClearNetworkArchive}
                            disabled={isClearing}
                        >
                            {isClearing ? <Loader2 className="animate-spin h-3 w-3" /> : <Trash2 className="w-3 h-3 ml-1.5" />}
                            مسح أرشيف هذه الشبكة
                        </Button>
                    )}
                    {completedCards.length > 0 ? (
                        completedCards.map(card => (
                            <Card key={card.id} className="p-3 bg-muted/20 border-none rounded-2xl opacity-80">
                                <InfoRow icon={CreditCard} label="رقم الكرت" value={card.cardNumber} isMono />
                                <InfoRow icon={User} label="المشتري" value={card.buyerName} />
                                <InfoRow icon={Calendar} label="تاريخ البيع" value={format(parseISO(card.soldTimestamp), 'd/M/y, h:mm a', { locale: ar })} />
                                <InfoRow icon={Banknote} label="سعر البيع" value={card.price} />
                                
                                <div className="flex justify-between items-center pt-3 mt-2 border-t border-dashed">
                                    <Badge className="bg-green-500/10 text-green-600 border-none px-3 py-1 rounded-lg">
                                        <span className="text-[9px] font-black">تم التحويل (أرشيف)</span>
                                    </Badge>
                                    <Check className="w-4 h-4 text-green-600" />
                                </div>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-10 text-xs font-bold">الأرشيف فارغ.</p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function CardSalesReportsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isClearingAll, setIsClearingAll] = useState(false);

  const networksCollection = useMemoFirebase(() => firestore ? query(collection(firestore, 'networks'), orderBy('name')) : null, [firestore]);
  const { data: networks, isLoading } = useCollection<Network>(networksCollection);

  const isAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

  const handleClearAllMabi3at = async () => {
    if (!firestore) return;
    setIsClearingAll(true);
    try {
        const q = collection(firestore, 'soldCards');
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            toast({ title: "لا توجد بيانات", description: "القائمة فارغة بالفعل." });
            setIsClearingAll(false);
            return;
        }

        const batch = writeBatch(firestore);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        toast({ title: "تم الحذف", description: "تم مسح كافة السجلات بنجاح." });
    } catch (e) {
        toast({ variant: "destructive", title: "خطأ", description: "فشل مسح البيانات." });
    } finally {
        setIsClearingAll(false);
    }
  };

  if (!isAdmin) {
      return <div className="p-10 text-center font-bold">عذراً، هذه الصفحة مخصصة لمدير النظام.</div>;
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      );
    }
    if (!networks || networks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-64 opacity-20">
          <AlertCircle className="h-16 w-16" />
          <h3 className="mt-4 text-lg font-black">لا توجد شبكات مضافة</h3>
        </div>
      );
    }
    return (
        <div className="space-y-6">
            <div className="text-center space-y-1">
                <h2 className="text-xl font-black text-primary">أرباح مبيعات الكروت</h2>
                <p className="text-xs font-bold text-muted-foreground">مراجعة مبيعات الشبكات المحلية</p>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl mt-4">
                    <p className="text-[10px] text-blue-700 font-black leading-relaxed">
                        ℹ️ نظام الأرشفة: المبيعات الجديدة تظهر في "الجديد"، وعند التحويل تنتقل لـ "الأرشيف". يمكنك مسح الأرشيف في أي وقت لتنظيف الواجهة.
                    </p>
                </div>
            </div>
            
            <Accordion type="single" collapsible className="w-full space-y-3">
                {networks.map(network => (
                    <AccordionItem value={network.id} key={network.id} className="border-none bg-card rounded-2xl shadow-sm overflow-hidden">
                        <AccordionTrigger className="px-4 py-4 hover:no-underline">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 rounded-xl">
                                    <Wifi className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-sm block">{network.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-bold">{network.location}</span>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                            <NetworkDetails network={network} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="أرباح الكروت" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-end mb-4">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="rounded-xl h-9 font-black text-[10px]">
                        <Trash2 className="ml-1.5 h-3.5 w-3.5" />
                        مسح كافة السجلات الشامل
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تنبيه البدء الحقيقي</AlertDialogTitle>
                        <AlertDialogDescription className="text-center pt-2">
                            سيتم حذف كافة مبيعات الكروت (الجديد والأرشيف) من واجهتك الآن. 
                            هذا الإجراء مخصص للتنظيف ولا يؤثر على أرصدة الملاك.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                        <AlertDialogAction onClick={handleClearAllMabi3at} className="bg-destructive hover:bg-destructive/90 rounded-2xl h-12 font-bold w-full" disabled={isClearingAll}>
                            {isClearingAll ? <Loader2 className="animate-spin h-5 w-5" /> : "تأكيد الحذف النهائي"}
                        </AlertDialogAction>
                        <AlertDialogCancel className="rounded-2xl h-12 mt-0 w-full" disabled={isClearingAll}>إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        {renderContent()}
      </div>
      <Toaster/>
    </div>
  );
}
