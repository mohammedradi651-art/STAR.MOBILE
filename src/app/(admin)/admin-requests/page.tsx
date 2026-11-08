'use client';

import React, { useState, useMemo } from 'react';
import { collection, doc, query, orderBy, updateDoc, increment, writeBatch, getDocs, getDoc, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
} from '@/components/ui/alert-dialog';
import { 
  Zap, 
  Droplets, 
  Banknote, 
  User, 
  Phone, 
  Check, 
  X, 
  Archive, 
  Clock, 
  Wallet, 
  Hash, 
  MapPin, 
  CheckCircle2, 
  Building,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

// --- TYPES ---
type ElectricityRequest = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  subscriberNumber: string;
  subscriberName: string;
  billAmount: number;
  commission: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  timestamp: string;
};

type WaterRequest = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  city: string;
  subscriberNumber: string;
  subscriberName: string;
  billAmount: number;
  commission: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  timestamp: string;
};

type WithdrawalRequest = {
  id: string;
  transactionId?: string;
  balanceDeducted?: boolean;
  ownerId: string;
  ownerName: string;
  ownerPhoneNumber: string;
  amount: number;
  paymentMethodName: string;
  paymentMethodLogo?: string;
  recipientName: string;
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  readiness?: string;
  rejectReason?: string;
  requestTimestamp: string;
  completedAt?: string;
  rejectedAt?: string;
};

type DepositRequest = {
  id: string;
  transactionId?: string;
  userId: string;
  userName: string;
  userPhone: string;
  bank: 'alomqy' | 'kuraimi' | 'amjad';
  bankName: string;
  account?: string;
  reference?: string;
  refOrAccount: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  readiness: 'قيد الانتظار' | 'جاهزة' | 'فاشلة';
  methodName?: string;
  rejectReason?: string;
  createdAt: string;
  timestamp: string;
  approvedAt?: string;
  rejectedAt?: string;
};

const SafeFormatDate = (dateStr?: string) => {
  if (!dateStr) return '...';
  try {
    return format(parseISO(dateStr), 'd MMM, h:mm a', { locale: ar });
  } catch {
    return '...';
  }
};

const InfoRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
  <div className="flex justify-between items-center py-2 border-b last:border-b-0 text-xs">
    <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" /> {label}:</span>
    <span className="font-bold text-foreground">{value || '...'}</span>
  </div>
);

export default function AdminRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeMainTab, setActiveMainTab] = useState<'electricity' | 'water' | 'withdrawals' | 'deposits'>('electricity');

  // --- 1. ELECTRICITY DATA ---
  const electQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'electricityRequests'), orderBy('timestamp', 'desc'), limit(100)) : null),
    [firestore]
  );
  const { data: electRequests, isLoading: isLoadingElect } = useCollection<ElectricityRequest>(electQuery);
  const [selectedElect, setSelectedElect] = useState<ElectricityRequest | null>(null);
  const [isElectCancelOpen, setIsElectCancelOpen] = useState(false);
  const [electCancelNote, setElectCancelNote] = useState('');

  const { activeElect, archivedElect } = useMemo(() => {
    const active: ElectricityRequest[] = [];
    const archived: ElectricityRequest[] = [];
    electRequests?.forEach(r => (r.status === 'pending' ? active.push(r) : archived.push(r)));
    return { activeElect: active, archivedElect: archived };
  }, [electRequests]);

  // --- 2. WATER DATA ---
  const waterQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'waterRequests'), orderBy('timestamp', 'desc'), limit(100)) : null),
    [firestore]
  );
  const { data: waterRequests, isLoading: isLoadingWater } = useCollection<WaterRequest>(waterQuery);
  const [selectedWater, setSelectedWater] = useState<WaterRequest | null>(null);
  const [isWaterCancelOpen, setIsWaterCancelOpen] = useState(false);
  const [waterCancelNote, setWaterCancelNote] = useState('');

  const { activeWater, archivedWater } = useMemo(() => {
    const active: WaterRequest[] = [];
    const archived: WaterRequest[] = [];
    waterRequests?.forEach(r => (r.status === 'pending' ? active.push(r) : archived.push(r)));
    return { activeWater: active, archivedWater: archived };
  }, [waterRequests]);

  // --- 3. WITHDRAWALS DATA ---
  const withQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'withdrawalRequests'), orderBy('requestTimestamp', 'desc'), limit(100)) : null),
    [firestore]
  );
  const { data: withRequests, isLoading: isLoadingWith } = useCollection<WithdrawalRequest>(withQuery);
  const [selectedWith, setSelectedWith] = useState<WithdrawalRequest | null>(null);
  const [withAction, setWithAction] = useState<'approve' | 'reject' | null>(null);
  const [withRejectNote, setWithRejectNote] = useState('');

  const { activeWith, archivedWith } = useMemo(() => {
    const active: WithdrawalRequest[] = [];
    const archived: WithdrawalRequest[] = [];
    withRequests?.forEach(r => (r.status === 'pending' ? active.push(r) : archived.push(r)));
    return { activeWith: active, archivedWith: archived };
  }, [withRequests]);

  // --- 4. DEPOSITS DATA ---
  const depQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'depositRequests'), orderBy('createdAt', 'desc'), limit(100)) : null),
    [firestore]
  );
  const { data: depRequests, isLoading: isLoadingDep } = useCollection<DepositRequest>(depQuery);
  const [selectedDep, setSelectedDep] = useState<DepositRequest | null>(null);
  const [depAction, setDepAction] = useState<'approve' | 'reject' | null>(null);
  const [depRejectNote, setDepRejectNote] = useState('');
  const [isProcessingDep, setIsProcessingDep] = useState(false);

  const { activeDep, archivedDep } = useMemo(() => {
    const active: DepositRequest[] = [];
    const archived: DepositRequest[] = [];
    depRequests?.forEach(r => (r.status === 'pending' ? active.push(r) : archived.push(r)));
    return { activeDep: active, archivedDep: archived };
  }, [depRequests]);

  // --- HANDLERS: ELECTRICITY ---
  const handleElectComplete = async (reqId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'electricityRequests', reqId), { status: 'completed' });
      toast({ title: 'تم السداد', description: 'تم وضع علامة تم السداد بنجاح.' });
      setSelectedElect(null);
    } catch {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التحديث.' });
    }
  };

  const handleElectCancel = async () => {
    if (!selectedElect || !firestore) return;
    const batch = writeBatch(firestore);
    try {
      batch.update(doc(firestore, 'electricityRequests', selectedElect.id), { status: 'cancelled' });
      batch.update(doc(firestore, 'users', selectedElect.userId), { balance: increment(selectedElect.totalAmount) });
      batch.set(doc(collection(firestore, `users/${selectedElect.userId}/transactions`)), {
        userId: selectedElect.userId,
        transactionDate: new Date().toISOString(),
        amount: selectedElect.totalAmount,
        transactionType: 'استرجاع سداد كهرباء',
        notes: `إلغاء طلب رقم: ${selectedElect.subscriberNumber}. ${electCancelNote ? `السبب: ${electCancelNote}` : ''}`
      });
      await batch.commit();
      toast({ title: 'تم الإلغاء', description: 'تم إرجاع المبلغ لحساب المشترك.' });
      setIsElectCancelOpen(false);
      setSelectedElect(null);
      setElectCancelNote('');
    } catch {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت العملية.' });
    }
  };

  // --- HANDLERS: WATER (Safe and Fortified) ---
  const handleWaterComplete = async (reqId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'waterRequests', reqId), { status: 'completed' });
      toast({ title: 'تم السداد', description: 'تم وضع علامة تم السداد بنجاح.' });
      setSelectedWater(null);
    } catch {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التحديث.' });
    }
  };

  const handleWaterCancel = async () => {
    if (!selectedWater || !firestore) return;
    const batch = writeBatch(firestore);
    const refundAmount = Number(selectedWater.totalAmount || 0);
    try {
      batch.update(doc(firestore, 'waterRequests', selectedWater.id), { status: 'cancelled' });
      batch.update(doc(firestore, 'users', selectedWater.userId), { balance: increment(refundAmount) });
      batch.set(doc(collection(firestore, `users/${selectedWater.userId}/transactions`)), {
        userId: selectedWater.userId,
        transactionDate: new Date().toISOString(),
        amount: refundAmount,
        transactionType: 'استرجاع سداد مياه',
        notes: `إلغاء طلب مياه رقم: ${selectedWater.subscriberNumber}. ${waterCancelNote ? `السبب: ${waterCancelNote}` : ''}`
      });
      await batch.commit();
      toast({ title: 'تم الإلغاء', description: 'تم إرجاع المبلغ لحساب المشترك بنجاح.' });
      setIsWaterCancelOpen(false);
      setSelectedWater(null);
      setWaterCancelNote('');
    } catch {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت العملية.' });
    }
  };

  // --- HANDLERS: WITHDRAWALS ---
  const handleWithActionConfirm = async () => {
    if (!selectedWith || !withAction || !firestore) return;
    const batch = writeBatch(firestore);
    try {
      const now = new Date().toISOString();

      // البحث عن معاملة العميل المرتبطة بطلب السحب
      let txDocRef = null;
      let existingNotes = '';

      if (selectedWith.transactionId) {
        const candidateRef = doc(firestore, `users/${selectedWith.ownerId}/transactions`, selectedWith.transactionId);
        const candidateSnap = await getDoc(candidateRef);
        if (candidateSnap.exists()) {
          txDocRef = candidateRef;
          existingNotes = candidateSnap.data()?.notes || '';
        }
      }

      if (!txDocRef) {
        const txQ = query(
          collection(firestore, `users/${selectedWith.ownerId}/transactions`),
          where('requestId', '==', selectedWith.id),
          limit(1)
        );
        const txSnap = await getDocs(txQ);
        if (!txSnap.empty) {
          txDocRef = txSnap.docs[0].ref;
          existingNotes = txSnap.docs[0].data()?.notes || '';
        }
      }

      if (withAction === 'approve') {
        const soldCardsRef = collection(firestore, 'soldCards');
        const q = query(soldCardsRef, where('ownerId', '==', selectedWith.ownerId), where('payoutStatus', '==', 'pending'));
        const snap = await getDocs(q);
        let acc = 0;
        for (const c of snap.docs) {
          if (acc < selectedWith.amount) {
            acc += (c.data().payoutAmount || 0);
            batch.update(c.ref, { payoutStatus: 'completed' });
          } else break;
        }

        // تحديث حالة العملية عند مالك الشبكة إلى "جاهزة"
        if (txDocRef) {
          batch.update(txDocRef, {
            status: 'completed',
            readiness: 'جاهزة',
            completedAt: now
          });
        }

        batch.set(doc(collection(firestore, `users/${selectedWith.ownerId}/notifications`)), {
          title: 'تمت الموافقة على طلب السحب 💸',
          body: `تمت الموافقة على طلب سحب مبلغ ${Number(selectedWith.amount).toLocaleString('en-US')} ريال بنجاح وتم التحويل لحسابك.`,
          timestamp: now,
        });

        batch.update(doc(firestore, 'withdrawalRequests', selectedWith.id), { 
          status: 'approved',
          readiness: 'جاهزة',
          completedAt: now
        });
      } else {
        // رفض طلب السحب:
        const failReason = withRejectNote?.trim() || 'تم رفض طلب السحب من قبل الإدارة';
        const finalNotes = existingNotes 
          ? `${existingNotes} | سبب الرفض: ${failReason}`
          : `سبب الرفض: ${failReason}`;

        // 1. إعادة المبلغ فوراً لرصيد مالك الشبكة إذا كان قد خُصم
        const userRef = doc(firestore, 'users', selectedWith.ownerId);
        if (selectedWith.balanceDeducted || selectedWith.transactionId || txDocRef) {
          batch.update(userRef, { balance: increment(selectedWith.amount) });
        }

        // 2. تحديث حركة العميل إلى "فاشلة" مع وضع السبب في الملاحظة
        if (txDocRef) {
          batch.update(txDocRef, {
            status: 'failed',
            readiness: 'فاشلة',
            notes: finalNotes,
            providerMessage: failReason,
            failedAt: now,
            refunded: true
          });
        }

        batch.set(doc(collection(firestore, `users/${selectedWith.ownerId}/notifications`)), {
          title: 'تم رفض طلب السحب ❌',
          body: `تم رفض طلب سحب مبلغ ${Number(selectedWith.amount).toLocaleString('en-US')} ريال وإعادة الرصيد لحسابك. السبب: ${failReason}`,
          timestamp: now,
        });

        batch.update(doc(firestore, 'withdrawalRequests', selectedWith.id), { 
          status: 'rejected',
          readiness: 'فاشلة',
          rejectReason: failReason,
          rejectedAt: now
        });
      }

      await batch.commit();
      toast({ title: 'نجاح', description: `تم ${withAction === 'approve' ? 'قبول' : 'رفض'} طلب السحب.` });
      setWithAction(null);
      setSelectedWith(null);
      setWithRejectNote('');
    } catch {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت العملية.' });
    }
  };

  // --- HANDLERS: DEPOSITS ---
  const handleDepActionConfirm = async () => {
    if (!selectedDep || !depAction || !firestore) return;
    setIsProcessingDep(true);
    try {
      const now = new Date().toISOString();
      const batch = writeBatch(firestore);

      if (depAction === 'approve') {
        const userRef = doc(firestore, 'users', selectedDep.userId);
        batch.update(userRef, { balance: increment(selectedDep.amount) });

        const depRef = doc(firestore, 'depositRequests', selectedDep.id);
        batch.update(depRef, {
          status: 'approved',
          readiness: 'جاهزة',
          approvedAt: now
        });

        if (selectedDep.transactionId) {
          const txRef = doc(firestore, `users/${selectedDep.userId}/transactions`, selectedDep.transactionId);
          batch.update(txRef, {
            status: 'success',
            readiness: 'جاهزة',
            completedAt: now,
            notes: `تم تأكيد الإيداع وإضافة مبلغ ${selectedDep.amount.toLocaleString()} ر.ي إلى محفظتك بنجاح.`
          });
        }

        const notifRef = doc(collection(firestore, `users/${selectedDep.userId}/notifications`));
        batch.set(notifRef, {
          id: notifRef.id,
          title: 'تم شحن رصيدك بنجاح ✅',
          body: `تمت الموافقة على طلب إيداعك بمبلغ ${selectedDep.amount.toLocaleString()} ر.ي عبر ${selectedDep.bankName}. الرصيد متاح في محفظتك الآن.`,
          type: 'deposit_approved',
          read: false,
          createdAt: now,
          timestamp: now
        });
      } else {
        const failReason = depRejectNote.trim() || 'لم يتم العثور على إيداع مطابق في البنك';
        const depRef = doc(firestore, 'depositRequests', selectedDep.id);
        batch.update(depRef, {
          status: 'rejected',
          readiness: 'فاشلة',
          rejectReason: failReason,
          rejectedAt: now
        });

        if (selectedDep.transactionId) {
          const txRef = doc(firestore, `users/${selectedDep.userId}/transactions`, selectedDep.transactionId);
          batch.update(txRef, {
            status: 'failed',
            readiness: 'فاشلة',
            rejectReason: failReason,
            providerMessage: failReason,
            failedAt: now,
            notes: `تم رفض طلب الإيداع. السبب: ${failReason}`
          });
        }

        const notifRef = doc(collection(firestore, `users/${selectedDep.userId}/notifications`));
        batch.set(notifRef, {
          id: notifRef.id,
          title: 'تعذر قبول طلب التغذية ❌',
          body: `تم رفض طلب تغذية رصيدك بمبلغ ${selectedDep.amount.toLocaleString()} ر.ي. السبب: ${failReason}`,
          type: 'deposit_rejected',
          read: false,
          createdAt: now,
          timestamp: now
        });
      }

      await batch.commit();
      toast({
        title: depAction === 'approve' ? 'تمت الموافقة بنجاح 🎉' : 'تم رفض الطلب',
        description: depAction === 'approve'
          ? `تم شحن ${selectedDep.amount.toLocaleString()} ر.ي لحساب ${selectedDep.userName || selectedDep.userPhone}.`
          : 'تم تحديث حالة العملية للمستخدم وحفظ سبب الرفض.'
      });
      setDepAction(null);
      setSelectedDep(null);
      setDepRejectNote('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message || 'فشلت العملية.' });
    } finally {
      setIsProcessingDep(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="الطلبات" />

      {/* الرأس: التبويبات الرئيسية الأربعة */}
      <div className="p-3 bg-card border-b">
        <div className="grid grid-cols-4 gap-1.5 bg-muted/60 p-1 rounded-2xl">
          <button
            onClick={() => setActiveMainTab('electricity')}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 rounded-xl font-black text-[11px] transition-all relative",
              activeMainTab === 'electricity' 
                ? "bg-amber-500 text-white shadow-md scale-[1.02]" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>الكهرباء</span>
            {activeElect.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                {activeElect.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMainTab('water')}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 rounded-xl font-black text-[11px] transition-all relative",
              activeMainTab === 'water' 
                ? "bg-blue-600 text-white shadow-md scale-[1.02]" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Droplets className="h-3.5 w-3.5" />
            <span>الماء</span>
            {activeWater.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                {activeWater.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMainTab('withdrawals')}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 rounded-xl font-black text-[11px] transition-all relative",
              activeMainTab === 'withdrawals' 
                ? "bg-[#0048ad] text-white shadow-md scale-[1.02]" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Banknote className="h-3.5 w-3.5" />
            <span>السحب</span>
            {activeWith.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                {activeWith.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMainTab('deposits')}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 rounded-xl font-black text-[11px] transition-all relative",
              activeMainTab === 'deposits' 
                ? "bg-emerald-600 text-white shadow-md scale-[1.02]" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>الإيداعات</span>
            {activeDep.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white animate-pulse">
                {activeDep.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-36 no-scrollbar">
        {/* --- 1. تبويب الكهرباء --- */}
        {activeMainTab === 'electricity' && (
          <Tabs defaultValue="active" className="w-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/30 border-b">
              <TabsTrigger value="active" className="font-bold text-xs">طلبات حالية ({activeElect.length})</TabsTrigger>
              <TabsTrigger value="archived" className="font-bold text-xs">الأرشيف ({archivedElect.length})</TabsTrigger>
            </TabsList>
            <div className="p-4">
              <TabsContent value="active" className="space-y-3 mt-0">
                {isLoadingElect ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
                ) : activeElect.length === 0 ? (
                  <p className="text-center text-muted-foreground py-16 text-xs font-bold">لا توجد طلبات كهرباء معلقة.</p>
                ) : (
                  activeElect.map(req => (
                    <Card key={req.id} className="cursor-pointer hover:bg-muted/30 transition-all rounded-[24px] border-none shadow-sm" onClick={() => setSelectedElect(req)}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-500/10 rounded-xl"><Zap className="h-5 w-5 text-amber-500" /></div>
                          <div className="text-right">
                            <p className="font-black text-sm">{req.subscriberName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{req.subscriberNumber}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-amber-600 text-sm">{Number(req.totalAmount || 0).toLocaleString()} ر.ي</p>
                          <p className="text-[9px] text-muted-foreground">{SafeFormatDate(req.timestamp)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              <TabsContent value="archived" className="space-y-3 mt-0">
                {archivedElect.map(req => (
                  <Card key={req.id} className="opacity-70 rounded-[24px] border-none shadow-sm cursor-pointer" onClick={() => setSelectedElect(req)}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-muted rounded-xl"><Archive className="h-5 w-5 text-muted-foreground" /></div>
                        <div className="text-right">
                          <p className="font-black text-sm">{req.subscriberName}</p>
                          <p className="text-[10px] text-muted-foreground">{req.subscriberNumber}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-black", req.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {req.status === 'completed' ? 'تم السداد' : 'ملغي'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* --- 2. تبويب الماء --- */}
        {activeMainTab === 'water' && (
          <Tabs defaultValue="active" className="w-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/30 border-b">
              <TabsTrigger value="active" className="font-bold text-xs">طلبات حالية ({activeWater.length})</TabsTrigger>
              <TabsTrigger value="archived" className="font-bold text-xs">الأرشيف ({archivedWater.length})</TabsTrigger>
            </TabsList>
            <div className="p-4">
              <TabsContent value="active" className="space-y-3 mt-0">
                {isLoadingWater ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
                ) : activeWater.length === 0 ? (
                  <p className="text-center text-muted-foreground py-16 text-xs font-bold">لا توجد طلبات مياه معلقة.</p>
                ) : (
                  activeWater.map(req => (
                    <Card key={req.id} className="cursor-pointer hover:bg-muted/30 transition-all rounded-[24px] border-none shadow-sm" onClick={() => setSelectedWater(req)}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-500/10 rounded-xl"><Droplets className="h-5 w-5 text-blue-600" /></div>
                          <div className="text-right">
                            <p className="font-black text-sm">{req.subscriberName || 'مشترك مياه'}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{req.city || ''} - {req.subscriberNumber}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-blue-600 text-sm">{Number(req.totalAmount || 0).toLocaleString()} ر.ي</p>
                          <p className="text-[9px] text-muted-foreground">{SafeFormatDate(req.timestamp)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              <TabsContent value="archived" className="space-y-3 mt-0">
                {archivedWater.map(req => (
                  <Card key={req.id} className="opacity-70 rounded-[24px] border-none shadow-sm cursor-pointer" onClick={() => setSelectedWater(req)}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-muted rounded-xl"><Archive className="h-5 w-5 text-muted-foreground" /></div>
                        <div className="text-right">
                          <p className="font-black text-sm">{req.subscriberName || 'مشترك مياه'}</p>
                          <p className="text-[10px] text-muted-foreground">{req.city || ''} - {req.subscriberNumber}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-black", req.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {req.status === 'completed' ? 'تم السداد' : 'ملغي'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* --- 3. تبويب السحب --- */}
        {activeMainTab === 'withdrawals' && (
          <Tabs defaultValue="active" className="w-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/30 border-b">
              <TabsTrigger value="active" className="font-bold text-xs">قيد الانتظار ({activeWith.length})</TabsTrigger>
              <TabsTrigger value="archived" className="font-bold text-xs">الأرشيف ({archivedWith.length})</TabsTrigger>
            </TabsList>
            <div className="p-4">
              <TabsContent value="active" className="space-y-3 mt-0">
                {isLoadingWith ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
                ) : activeWith.length === 0 ? (
                  <p className="text-center text-muted-foreground py-16 text-xs font-bold">لا توجد طلبات سحب معلقة.</p>
                ) : (
                  activeWith.map(req => (
                    <Card key={req.id} className="cursor-pointer hover:bg-muted/30 transition-all rounded-[24px] border-none shadow-sm" onClick={() => setSelectedWith(req)}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl"><Banknote className="h-5 w-5 text-emerald-600" /></div>
                          <div className="text-right">
                            <p className="font-black text-sm">{req.ownerName || 'مالك شبكة'}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{req.paymentMethodName} - {req.recipientName}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-emerald-600 text-sm">{Number(req.amount || 0).toLocaleString()} ر.ي</p>
                          <p className="text-[9px] text-muted-foreground">{SafeFormatDate(req.requestTimestamp)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              <TabsContent value="archived" className="space-y-3 mt-0">
                {archivedWith.map(req => (
                  <Card key={req.id} className="opacity-70 rounded-[24px] border-none shadow-sm cursor-pointer" onClick={() => setSelectedWith(req)}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-muted rounded-xl"><Archive className="h-5 w-5 text-muted-foreground" /></div>
                        <div className="text-right">
                          <p className="font-black text-sm">{req.ownerName || 'مالك شبكة'}</p>
                          <p className="text-[10px] text-muted-foreground">{req.paymentMethodName}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-black", req.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* --- 4. تبويب الإيداعات والتغذية --- */}
        {activeMainTab === 'deposits' && (
          <Tabs defaultValue="active" className="w-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/30 border-b">
              <TabsTrigger value="active" className="font-bold text-xs">طلبات حالية ({activeDep.length})</TabsTrigger>
              <TabsTrigger value="archived" className="font-bold text-xs">الأرشيف ({archivedDep.length})</TabsTrigger>
            </TabsList>
            <div className="p-4">
              <TabsContent value="active" className="space-y-3 mt-0">
                {isLoadingDep ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
                ) : activeDep.length === 0 ? (
                  <p className="text-center text-muted-foreground py-16 text-xs font-bold">لا توجد طلبات تغذية معلقة حالياً.</p>
                ) : (
                  activeDep.map(req => (
                    <Card key={req.id} className="cursor-pointer hover:bg-muted/30 transition-all rounded-[24px] border-none shadow-sm" onClick={() => setSelectedDep(req)}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl"><Wallet className="h-5 w-5 text-emerald-600" /></div>
                          <div className="text-right">
                            <p className="font-black text-sm">{req.userName || 'عميل'}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{req.bankName} - {req.refOrAccount}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-emerald-600 text-sm">{Number(req.amount || 0).toLocaleString()} ر.ي</p>
                          <p className="text-[9px] text-muted-foreground">{SafeFormatDate(req.createdAt || req.timestamp)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              <TabsContent value="archived" className="space-y-3 mt-0">
                {archivedDep.map(req => (
                  <Card key={req.id} className="opacity-70 rounded-[24px] border-none shadow-sm cursor-pointer" onClick={() => setSelectedDep(req)}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-muted rounded-xl"><Archive className="h-5 w-5 text-muted-foreground" /></div>
                        <div className="text-right">
                          <p className="font-black text-sm">{req.userName || 'عميل'}</p>
                          <p className="text-[10px] text-muted-foreground">{req.bankName} - {req.refOrAccount}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] font-black", req.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>

      {/* --- MODAL: ELECTRICITY DETAILS --- */}
      <Dialog open={!!selectedElect} onOpenChange={(open) => !open && setSelectedElect(null)}>
        <DialogContent className="max-w-sm rounded-[32px] overflow-hidden p-0 border-none shadow-2xl bg-card">
          <div className="bg-amber-500 p-6 text-center text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-center font-black text-lg">تفاصيل سداد الكهرباء</DialogTitle>
              <DialogDescription className="text-white/80 text-center text-xs">مراجعة بيانات فاتورة الكهرباء</DialogDescription>
            </DialogHeader>
          </div>
          {selectedElect && (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <InfoRow icon={User} label="صاحب الرقم" value={selectedElect.subscriberName} />
                <InfoRow icon={Hash} label="رقم المشترك" value={selectedElect.subscriberNumber} />
                <hr className="my-2 border-dashed" />
                <InfoRow icon={Wallet} label="قيمة الفاتورة" value={`${Number(selectedElect.billAmount || 0).toLocaleString()} ر.ي`} />
                <InfoRow icon={CheckCircle2} label="العمولة" value={`${Number(selectedElect.commission || 0).toLocaleString()} ر.ي`} />
                <div className="flex justify-between items-center py-2.5 bg-muted/60 rounded-xl px-3 mt-2">
                  <span className="font-black text-xs">الإجمالي المخصوم:</span>
                  <span className="font-black text-amber-600 text-base">{Number(selectedElect.totalAmount || 0).toLocaleString()} ر.ي</span>
                </div>
                <hr className="my-2 border-dashed" />
                <InfoRow icon={User} label="المرسل" value={selectedElect.userName} />
                <InfoRow icon={Phone} label="رقم المرسل" value={selectedElect.userPhone} />
              </div>
              {selectedElect.status === 'pending' ? (
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <Button variant="destructive" className="rounded-2xl h-11 font-black" onClick={() => setIsElectCancelOpen(true)}>
                    <X className="ml-1.5 h-4 w-4" /> رفض
                  </Button>
                  <Button className="rounded-2xl h-11 font-black bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleElectComplete(selectedElect.id)}>
                    <Check className="ml-1.5 h-4 w-4" /> تم السداد
                  </Button>
                </div>
              ) : (
                <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-11 font-black">إغلاق</Button></DialogClose>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- MODAL: WATER DETAILS (Fixed & Guaranteed) --- */}
      <Dialog open={!!selectedWater} onOpenChange={(open) => !open && setSelectedWater(null)}>
        <DialogContent className="max-w-sm rounded-[32px] overflow-hidden p-0 border-none shadow-2xl bg-card">
          <div className="bg-blue-600 p-6 text-center text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-center font-black text-lg">تفاصيل سداد المياه</DialogTitle>
              <DialogDescription className="text-white/80 text-center text-xs">مراجعة بيانات فاتورة المياه</DialogDescription>
            </DialogHeader>
          </div>
          {selectedWater && (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <InfoRow icon={User} label="صاحب الرقم" value={selectedWater.subscriberName || 'غير متوفر'} />
                <InfoRow icon={MapPin} label="المنطقة" value={selectedWater.city || 'غير محدد'} />
                <InfoRow icon={Hash} label="رقم المشترك" value={selectedWater.subscriberNumber || '...'} />
                <hr className="my-2 border-dashed" />
                <InfoRow icon={Wallet} label="قيمة الفاتورة" value={`${Number(selectedWater.billAmount || 0).toLocaleString()} ر.ي`} />
                <InfoRow icon={CheckCircle2} label="العمولة" value={`${Number(selectedWater.commission || 0).toLocaleString()} ر.ي`} />
                <div className="flex justify-between items-center py-2.5 bg-muted/60 rounded-xl px-3 mt-2">
                  <span className="font-black text-xs">الإجمالي المخصوم:</span>
                  <span className="font-black text-blue-600 text-base">{Number(selectedWater.totalAmount || 0).toLocaleString()} ر.ي</span>
                </div>
                <hr className="my-2 border-dashed" />
                <InfoRow icon={User} label="المرسل" value={selectedWater.userName || 'مشترك'} />
                <InfoRow icon={Phone} label="رقم المرسل" value={selectedWater.userPhone || '...'} />
              </div>
              {selectedWater.status === 'pending' ? (
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <Button variant="destructive" className="rounded-2xl h-11 font-black" onClick={() => setIsWaterCancelOpen(true)}>
                    <X className="ml-1.5 h-4 w-4" /> رفض
                  </Button>
                  <Button className="rounded-2xl h-11 font-black bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleWaterComplete(selectedWater.id)}>
                    <Check className="ml-1.5 h-4 w-4" /> تم السداد
                  </Button>
                </div>
              ) : (
                <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-11 font-black">إغلاق</Button></DialogClose>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- MODAL: WITHDRAWAL DETAILS --- */}
      <Dialog open={!!selectedWith} onOpenChange={(open) => !open && setSelectedWith(null)}>
        <DialogContent className="max-w-sm rounded-[32px] overflow-hidden p-0 border-none shadow-2xl bg-card">
          <div className="bg-[#0048ad] p-6 text-center text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-center font-black text-lg">تفاصيل طلب السحب</DialogTitle>
              <DialogDescription className="text-white/80 text-center text-xs">مراجعة بيانات سحب رصيد الشبكة</DialogDescription>
            </DialogHeader>
          </div>
          {selectedWith && (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <InfoRow icon={User} label="اسم المالك" value={selectedWith.ownerName || 'مالك شبكة'} />
                <InfoRow icon={Phone} label="رقم الهاتف" value={selectedWith.ownerPhoneNumber} />
                <hr className="my-2 border-dashed" />
                <InfoRow icon={Building} label="طريقة الاستلام" value={selectedWith.paymentMethodName} />
                <InfoRow icon={User} label="اسم المستلم" value={selectedWith.recipientName} />
                <InfoRow icon={Hash} label="رقم الحساب" value={selectedWith.accountNumber} />
                <div className="flex justify-between items-center py-2.5 bg-muted/60 rounded-xl px-3 mt-2">
                  <span className="font-black text-xs">المبلغ المطلوب:</span>
                  <span className="font-black text-emerald-600 text-base">{Number(selectedWith.amount || 0).toLocaleString()} ر.ي</span>
                </div>
              </div>
              {selectedWith.status === 'pending' ? (
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <Button variant="destructive" className="rounded-2xl h-11 font-black" onClick={() => setWithAction('reject')}>
                    <X className="ml-1.5 h-4 w-4" /> رفض
                  </Button>
                  <Button className="rounded-2xl h-11 font-black bg-[#0048ad] hover:bg-[#00388a] text-white" onClick={() => setWithAction('approve')}>
                    <Check className="ml-1.5 h-4 w-4" /> قبول وتحويل
                  </Button>
                </div>
              ) : (
                <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-11 font-black">إغلاق</Button></DialogClose>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- ALERT: ELECTRICITY REFUND --- */}
      <AlertDialog open={isElectCancelOpen} onOpenChange={setIsElectCancelOpen}>
        <AlertDialogContent className="rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">إلغاء الطلب واسترجاع المبلغ؟</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs pt-1">
              سيتم إرجاع مبلغ {Number(selectedElect?.totalAmount || 0).toLocaleString()} ريال فوراً لحساب المشترك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-[10px] font-black">سبب الإلغاء (اختياري)</Label>
            <Textarea placeholder="اكتب السبب هنا..." value={electCancelNote} onChange={(e) => setElectCancelNote(e.target.value)} className="rounded-2xl bg-muted/30 border-none text-xs" />
          </div>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-3">
            <AlertDialogAction className="rounded-2xl h-11 font-black bg-destructive hover:bg-destructive/90" onClick={handleElectCancel}>تأكيد الرفض</AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-11 font-black">تراجع</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: WATER REFUND --- */}
      <AlertDialog open={isWaterCancelOpen} onOpenChange={setIsWaterCancelOpen}>
        <AlertDialogContent className="rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">إلغاء الطلب واسترجاع المبلغ؟</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs pt-1">
              سيتم إرجاع مبلغ {Number(selectedWater?.totalAmount || 0).toLocaleString()} ريال فوراً لحساب المشترك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-[10px] font-black">سبب الإلغاء (اختياري)</Label>
            <Textarea placeholder="اكتب السبب هنا..." value={waterCancelNote} onChange={(e) => setWaterCancelNote(e.target.value)} className="rounded-2xl bg-muted/30 border-none text-xs" />
          </div>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-3">
            <AlertDialogAction className="rounded-2xl h-11 font-black bg-destructive hover:bg-destructive/90" onClick={handleWaterCancel}>تأكيد الرفض</AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-11 font-black">تراجع</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: WITHDRAWAL ACTION --- */}
      <AlertDialog open={!!withAction} onOpenChange={(open) => !open && setWithAction(null)}>
        <AlertDialogContent className="rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">
              {withAction === 'approve' ? 'تأكيد قبول طلب السحب' : 'رفض طلب السحب'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs pt-1">
              {withAction === 'approve' 
                ? `سيتم تأكيد سداد مبلغ ${Number(selectedWith?.amount || 0).toLocaleString()} ريال للمالك وإشعار حسابه.`
                : 'هل تريد رفض طلب السحب؟ يمكنك كتابة السبب بالأسفل.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {withAction === 'reject' && (
            <div className="py-2 space-y-1.5">
              <Label className="text-[10px] font-black">سبب الرفض</Label>
              <Textarea placeholder="اكتب سبب الرفض..." value={withRejectNote} onChange={(e) => setWithRejectNote(e.target.value)} className="rounded-2xl bg-muted/30 border-none text-xs" />
            </div>
          )}
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-3">
            <AlertDialogAction 
              className={cn("rounded-2xl h-11 font-black", withAction === 'approve' ? "bg-[#0048ad] hover:bg-[#00388a]" : "bg-destructive hover:bg-destructive/90")}
              onClick={handleWithActionConfirm}
            >
              {withAction === 'approve' ? 'تأكيد القبول' : 'تأكيد الرفض'}
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-11 font-black">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- MODAL: DEPOSIT DETAILS --- */}
      <Dialog open={!!selectedDep} onOpenChange={(open) => !open && setSelectedDep(null)}>
        <DialogContent className="max-w-sm rounded-[32px] overflow-hidden p-0 border-none shadow-2xl bg-card">
          <div className="bg-emerald-600 p-6 text-center text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-center font-black text-lg">تفاصيل طلب التغذية</DialogTitle>
              <DialogDescription className="text-white/80 text-center text-xs">مراجعة بيانات إيداع العميل</DialogDescription>
            </DialogHeader>
          </div>
          {selectedDep && (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <InfoRow icon={User} label="اسم العميل" value={selectedDep.userName || 'عميل'} />
                <InfoRow icon={Phone} label="رقم الهاتف" value={selectedDep.userPhone || 'غير متوفر'} />
                <hr className="my-2 border-dashed" />
                <InfoRow icon={Building} label="البنك المستلم" value={selectedDep.bankName} />
                <InfoRow icon={Hash} label="رقم الحساب / المرجع" value={selectedDep.refOrAccount} />
                <div className="flex justify-between items-center py-2.5 bg-muted/60 rounded-xl px-3 mt-2">
                  <span className="font-black text-xs">المبلغ المطلوب:</span>
                  <span className="font-black text-emerald-600 text-base">{Number(selectedDep.amount || 0).toLocaleString()} ر.ي</span>
                </div>
                {selectedDep.rejectReason && (
                  <div className="bg-red-500/10 p-2.5 rounded-xl text-xs text-red-600 font-bold border border-red-500/20 mt-2">
                    سبب الرفض: {selectedDep.rejectReason}
                  </div>
                )}
              </div>
              {selectedDep.status === 'pending' ? (
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <Button variant="destructive" className="rounded-2xl h-11 font-black" onClick={() => setDepAction('reject')}>
                    <X className="ml-1.5 h-4 w-4" /> رفض
                  </Button>
                  <Button className="rounded-2xl h-11 font-black bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setDepAction('approve')}>
                    <Check className="ml-1.5 h-4 w-4" /> موافق وشحن
                  </Button>
                </div>
              ) : (
                <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-11 font-black">إغلاق</Button></DialogClose>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- ALERT: DEPOSIT ACTION --- */}
      <AlertDialog open={!!depAction} onOpenChange={(open) => !open && setDepAction(null)}>
        <AlertDialogContent className="rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">
              {depAction === 'approve' ? 'تأكيد قبول طلب التغذية' : 'رفض طلب التغذية'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs pt-1">
              {depAction === 'approve' 
                ? `سيتم إضافة مبلغ ${Number(selectedDep?.amount || 0).toLocaleString()} ريال فوراً لحساب العميل.`
                : 'يرجى كتابة سبب الرفض ليظهر للعميل في كشف حسابه:'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {depAction === 'reject' && (
            <div className="py-2 space-y-1.5">
              <Label className="text-[10px] font-black">سبب الرفض</Label>
              <Textarea 
                placeholder="اكتب سبب الرفض (مثال: لم نجد إشعار الإيداع في البنك)..." 
                value={depRejectNote} 
                onChange={(e) => setDepRejectNote(e.target.value)} 
                className="rounded-2xl bg-muted/30 border-none text-xs" 
              />
            </div>
          )}
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-3">
            <AlertDialogAction 
              className={cn("rounded-2xl h-11 font-black", depAction === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90")}
              onClick={handleDepActionConfirm}
              disabled={isProcessingDep}
            >
              {isProcessingDep ? <Loader2 className="animate-spin h-4 w-4" /> : depAction === 'approve' ? 'تأكيد الشحن' : 'تأكيد الرفض'}
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-11 font-black">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
