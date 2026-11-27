'use client';

import React, { useState, useMemo } from 'react';
import { collection, doc, query, orderBy, updateDoc, increment, writeBatch, getDocs, getDoc, where, limit, serverTimestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useOrderDocArray, updateOrderItemInDoc, deleteOrderItemFromDoc, clearArchivedOrderItemsInDoc } from '@/lib/order-unified';
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
  Trash2,
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
  const { data: electRequests, isLoading: isLoadingElect } = useOrderDocArray<ElectricityRequest>('electricityRequests', 'requests');
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
  const { data: waterRequests, isLoading: isLoadingWater } = useOrderDocArray<WaterRequest>('waterRequests', 'requests');
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
  const { data: withRequests, isLoading: isLoadingWith } = useOrderDocArray<WithdrawalRequest>('withdrawalRequests', 'requests');
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
  const { data: depRequests, isLoading: isLoadingDep } = useOrderDocArray<DepositRequest>('depositRequests', 'requests');
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
      const now = new Date().toISOString();
      await updateOrderItemInDoc(firestore, 'electricityRequests', reqId, { 
        status: 'completed',
        readiness: 'جاهزة',
        completedAt: now
      });

      const targetReq = electRequests?.find(r => r.id === reqId) || selectedElect;
      if (targetReq?.userId) {
        // تحديث مصفوفة history للعمليات
        try {
          const historyRef = doc(firestore, `users/${targetReq.userId}/transactions`, 'history');
          const historySnap = await getDoc(historyRef);
          if (historySnap.exists()) {
            const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
            let updated = false;
            const newList = list.map((item: any) => {
              if (item.id === reqId || item.transactionId === reqId || item.operationId === reqId || item.subscriberNumber === targetReq.subscriberNumber) {
                updated = true;
                return {
                  ...item,
                  s: 'completed',
                  r: 'جاهز',
                  readiness: 'جاهز',
                  status: 'completed',
                  completedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              await updateDoc(historyRef, { list: newList, transactions: newList, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating history for electricity complete:", e);
        }

        // إرسال إشعار سحابي FCM مباشر للعميل
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetReq.userId,
            title: 'تم سداد فاتورة الكهرباء بنجاح ⚡',
            body: `تم تأكيد سداد فاتورة الكهرباء رقم (${targetReq.subscriberNumber}) بمبلغ ${Number(targetReq.totalAmount).toLocaleString()} ريال بنجاح.`,
            transid: targetReq.id,
            status: 'completed',
            amount: targetReq.totalAmount,
          }),
        }).catch(err => console.error("Push notification error:", err));
      }

      toast({ title: 'تم السداد', description: 'تم وضع علامة تم السداد وإشعار العميل بنجاح.' });
      setSelectedElect(null);
    } catch {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التحديث.' });
    }
  };

  const handleElectCancel = async () => {
    if (!selectedElect || !firestore) return;
    const batch = writeBatch(firestore);
    try {
      const now = new Date().toISOString();
      await updateOrderItemInDoc(firestore, 'electricityRequests', selectedElect.id, { 
        status: 'cancelled',
        readiness: 'فاشلة',
        cancelledAt: now,
        cancelReason: electCancelNote || 'تم إلغاء الطلب من قبل الإدارة'
      });
      batch.update(doc(firestore, 'users', selectedElect.userId), { balance: increment(selectedElect.totalAmount) });

      // تحديث مصفوفة history للعمليات دون إنشاء أي مستند منفصل
      try {
        const historyRef = doc(firestore, `users/${selectedElect.userId}/transactions`, 'history');
        const historySnap = await getDoc(historyRef);
        if (historySnap.exists()) {
          const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
          let updated = false;
          const newList = list.map((item: any) => {
            if (item.id === selectedElect.id || item.transactionId === selectedElect.id || item.operationId === selectedElect.id || item.subscriberNumber === selectedElect.subscriberNumber) {
              updated = true;
              return {
                ...item,
                s: 'failed',
                r: 'غير جاهز',
                readiness: 'غير جاهز',
                status: 'cancelled',
                refunded: true,
                notes: `إلغاء طلب رقم: ${selectedElect.subscriberNumber}. ${electCancelNote ? `السبب: ${electCancelNote}` : ''}`,
                failedAt: now,
              };
            }
            return item;
          });
          if (updated) {
            batch.update(historyRef, { list: newList, transactions: newList, lastUpdated: now });
          } else {
            const refundEntry = {
              id: 'ref_' + Date.now(),
              t: 'استرجاع سداد كهرباء',
              transactionType: 'استرجاع سداد كهرباء',
              type: 'refund',
              direction: 'credit',
              amount: selectedElect.totalAmount,
              a: selectedElect.totalAmount,
              date: now,
              d: now,
              status: 'completed',
              s: 'completed',
              readiness: 'جاهز',
              r: 'جاهز',
              notes: `إلغاء طلب رقم: ${selectedElect.subscriberNumber}. ${electCancelNote ? `السبب: ${electCancelNote}` : ''}`
            };
            batch.update(historyRef, { list: [refundEntry, ...list], transactions: [refundEntry, ...list], lastUpdated: now });
          }
        }
      } catch (e) {
        console.error("Error updating history for electricity cancel:", e);
      }

      await batch.commit();

      // إرسال إشعار سحابي FCM مباشر للعميل
      fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedElect.userId,
          title: 'تم إلغاء طلب سداد الكهرباء ⚠️',
          body: `تم إلغاء طلب سداد فاتورة الكهرباء (${selectedElect.subscriberNumber}) وإعادة مبلغ ${Number(selectedElect.totalAmount).toLocaleString()} ريال لرصيدك.${electCancelNote ? ` السبب: ${electCancelNote}` : ''}`,
          transid: selectedElect.id,
          status: 'failed',
          amount: selectedElect.totalAmount,
        }),
      }).catch(err => console.error("Push notification error:", err));

      toast({ title: 'تم الإلغاء', description: 'تم إرجاع المبلغ لحساب المشترك وإشعاره بنجاح.' });
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
      const now = new Date().toISOString();
      await updateOrderItemInDoc(firestore, 'waterRequests', reqId, { 
        status: 'completed',
        readiness: 'جاهزة',
        completedAt: now
      });

      const targetReq = waterRequests?.find(r => r.id === reqId) || selectedWater;
      if (targetReq?.userId) {
        // تحديث مصفوفة history للعمليات
        try {
          const historyRef = doc(firestore, `users/${targetReq.userId}/transactions`, 'history');
          const historySnap = await getDoc(historyRef);
          if (historySnap.exists()) {
            const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
            let updated = false;
            const newList = list.map((item: any) => {
              if (item.id === reqId || item.transactionId === reqId || item.operationId === reqId || item.subscriberNumber === targetReq.subscriberNumber) {
                updated = true;
                return {
                  ...item,
                  s: 'completed',
                  r: 'جاهز',
                  readiness: 'جاهز',
                  status: 'completed',
                  completedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              await updateDoc(historyRef, { list: newList, transactions: newList, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating history for water complete:", e);
        }

        // إرسال إشعار سحابي FCM مباشر للعميل
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetReq.userId,
            title: 'تم سداد فاتورة المياه بنجاح 💧',
            body: `تم تأكيد سداد فاتورة المياه رقم (${targetReq.subscriberNumber}) بمبلغ ${Number(targetReq.totalAmount).toLocaleString()} ريال بنجاح.`,
            transid: targetReq.id,
            status: 'completed',
            amount: targetReq.totalAmount,
          }),
        }).catch(err => console.error("Push notification error:", err));
      }

      toast({ title: 'تم السداد', description: 'تم وضع علامة تم السداد وإشعار العميل بنجاح.' });
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
      const now = new Date().toISOString();
      await updateOrderItemInDoc(firestore, 'waterRequests', selectedWater.id, { 
        status: 'cancelled',
        readiness: 'فاشلة',
        cancelledAt: now,
        cancelReason: waterCancelNote || 'تم إلغاء الطلب من قبل الإدارة'
      });
      batch.update(doc(firestore, 'users', selectedWater.userId), { balance: increment(refundAmount) });

      // تحديث مصفوفة history للعمليات دون إنشاء أي مستند منفصل
      try {
        const historyRef = doc(firestore, `users/${selectedWater.userId}/transactions`, 'history');
        const historySnap = await getDoc(historyRef);
        if (historySnap.exists()) {
          const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
          let updated = false;
          const newList = list.map((item: any) => {
            if (item.id === selectedWater.id || item.transactionId === selectedWater.id || item.operationId === selectedWater.id || item.subscriberNumber === selectedWater.subscriberNumber) {
              updated = true;
              return {
                ...item,
                s: 'failed',
                r: 'غير جاهز',
                readiness: 'غير جاهز',
                status: 'cancelled',
                refunded: true,
                notes: `إلغاء طلب مياه رقم: ${selectedWater.subscriberNumber}. ${waterCancelNote ? `السبب: ${waterCancelNote}` : ''}`,
                failedAt: now,
              };
            }
            return item;
          });
          if (updated) {
            batch.update(historyRef, { list: newList, transactions: newList, lastUpdated: now });
          } else {
            const refundEntry = {
              id: 'ref_' + Date.now(),
              t: 'استرجاع سداد مياه',
              transactionType: 'استرجاع سداد مياه',
              type: 'refund',
              direction: 'credit',
              amount: refundAmount,
              a: refundAmount,
              date: now,
              d: now,
              status: 'completed',
              s: 'completed',
              readiness: 'جاهز',
              r: 'جاهز',
              notes: `إلغاء طلب مياه رقم: ${selectedWater.subscriberNumber}. ${waterCancelNote ? `السبب: ${waterCancelNote}` : ''}`
            };
            batch.update(historyRef, { list: [refundEntry, ...list], transactions: [refundEntry, ...list], lastUpdated: now });
          }
        }
      } catch (e) {
        console.error("Error updating history for water cancel:", e);
      }

      await batch.commit();

      // إرسال إشعار سحابي FCM مباشر للعميل
      fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedWater.userId,
          title: 'تم إلغاء طلب سداد المياه ⚠️',
          body: `تم إلغاء طلب سداد فاتورة المياه (${selectedWater.subscriberNumber}) وإعادة مبلغ ${refundAmount.toLocaleString()} ريال لرصيدك.${waterCancelNote ? ` السبب: ${waterCancelNote}` : ''}`,
          transid: selectedWater.id,
          status: 'failed',
          amount: refundAmount,
        }),
      }).catch(err => console.error("Push notification error:", err));

      toast({ title: 'تم الإلغاء', description: 'تم إرجاع المبلغ لحساب المشترك وإشعاره بنجاح.' });
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

        // تحديث مصفوفة history للعمليات حتى تظهر فوراً "جاهزة" في التطبيق
        try {
          const historyRef = doc(firestore, `users/${selectedWith.ownerId}/transactions`, 'history');
          const historySnap = await getDoc(historyRef);
          if (historySnap.exists()) {
            const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
            let updated = false;
            const targetId = String(selectedWith.transactionId || selectedWith.id || '').trim();
            const newList = list.map((item: any) => {
              const itemId = String(item.id || item.transactionId || item.operationId || '').trim();
              if (itemId === targetId || itemId === String(selectedWith.id).trim()) {
                updated = true;
                return {
                  ...item,
                  s: 'completed',
                  r: 'جاهز',
                  readiness: 'جاهز',
                  status: 'approved',
                  completedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              batch.update(historyRef, { list: newList, transactions: newList, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating history for withdrawal:", e);
        }

        // تحديث مستند network_withdrawals ليظهر السحب مباشرة كـ "جاهز" في التطبيق
        try {
          const netWithRef = doc(firestore, 'network_withdrawals', selectedWith.ownerId);
          const netWithSnap = await getDoc(netWithRef);
          if (netWithSnap.exists()) {
            const data = netWithSnap.data() || {};
            const list = data.list || data.requests || [];
            let updated = false;
            const targetId = String(selectedWith.transactionId || selectedWith.id || '').trim();
            const newList = list.map((item: any) => {
              const itemId = String(item.id || item.transactionId || item.operationId || '').trim();
              if (itemId === targetId || itemId === String(selectedWith.id).trim()) {
                updated = true;
                return {
                  ...item,
                  status: 'approved',
                  s: 'completed',
                  readiness: 'جاهز',
                  r: 'جاهز',
                  completedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              await updateDoc(netWithRef, { list: newList, requests: newList, lastUpdated: serverTimestamp() });
            }
          }
        } catch (e) {
          console.error("Error updating network_withdrawals:", e);
        }

        await updateOrderItemInDoc(firestore, 'withdrawalRequests', selectedWith.id, { 
          status: 'approved',
          readiness: 'جاهزة',
          completedAt: now
        });

        // إرسال إشعار سحابي FCM مباشر للعميل وحفظه في الإشعارات
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedWith.ownerId,
            title: 'تمت الموافقة على طلب السحب 💸',
            body: `تمت الموافقة على طلب سحب مبلغ ${Number(selectedWith.amount).toLocaleString('en-US')} ريال بنجاح وتم التحويل لحسابك.`,
            transid: selectedWith.transactionId || selectedWith.id,
            status: 'completed',
            amount: selectedWith.amount,
          }),
        }).catch(err => console.error("Push notification error:", err));
      } else {
        // رفض طلب السحب:
        const failReason = withRejectNote?.trim() || 'تم رفض طلب السحب من قبل الإدارة';

        // 1. إعادة المبلغ فوراً لرصيد مالك الشبكة إذا كان قد خُصم
        const userRef = doc(firestore, 'users', selectedWith.ownerId);
        if (selectedWith.balanceDeducted || selectedWith.transactionId) {
          batch.update(userRef, { balance: increment(selectedWith.amount) });
        }

        // 2. تحديث مصفوفة history للعمليات إلى فاشلة
        try {
          const historyRef = doc(firestore, `users/${selectedWith.ownerId}/transactions`, 'history');
          const historySnap = await getDoc(historyRef);
          if (historySnap.exists()) {
            const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
            let updated = false;
            const targetId = String(selectedWith.transactionId || selectedWith.id || '').trim();
            const newList = list.map((item: any) => {
              const itemId = String(item.id || item.transactionId || item.operationId || '').trim();
              if (itemId === targetId || itemId === String(selectedWith.id).trim()) {
                updated = true;
                return {
                  ...item,
                  s: 'failed',
                  r: 'غير جاهز',
                  readiness: 'غير جاهز',
                  status: 'rejected',
                  notes: `سبب الرفض: ${failReason}`,
                  rejectReason: failReason,
                  failedAt: now,
                  refunded: true,
                };
              }
              return item;
            });
            if (updated) {
              batch.update(historyRef, { list: newList, transactions: newList, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating history for withdrawal rejection:", e);
        }

        // 3. تحديث مستند network_withdrawals إلى فاشلة / غير جاهز
        try {
          const netWithRef = doc(firestore, 'network_withdrawals', selectedWith.ownerId);
          const netWithSnap = await getDoc(netWithRef);
          if (netWithSnap.exists()) {
            const data = netWithSnap.data() || {};
            const list = data.list || data.requests || [];
            let updated = false;
            const targetId = String(selectedWith.transactionId || selectedWith.id || '').trim();
            const newList = list.map((item: any) => {
              const itemId = String(item.id || item.transactionId || item.operationId || '').trim();
              if (itemId === targetId || itemId === String(selectedWith.id).trim()) {
                updated = true;
                return {
                  ...item,
                  status: 'rejected',
                  s: 'failed',
                  readiness: 'غير جاهز',
                  r: 'غير جاهز',
                  rejectReason: failReason,
                  failedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              await updateDoc(netWithRef, { list: newList, requests: newList, lastUpdated: serverTimestamp() });
            }
          }
        } catch (e) {
          console.error("Error updating network_withdrawals on reject:", e);
        }

        await updateOrderItemInDoc(firestore, 'withdrawalRequests', selectedWith.id, { 
          status: 'rejected',
          readiness: 'فاشلة',
          rejectReason: failReason,
          rejectedAt: now
        });

        // إرسال إشعار سحابي FCM مباشر للعميل
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedWith.ownerId,
            title: 'تم رفض طلب السحب ❌',
            body: `تم رفض طلب سحب مبلغ ${Number(selectedWith.amount).toLocaleString('en-US')} ريال وإعادة الرصيد لحسابك. السبب: ${failReason}`,
            transid: selectedWith.transactionId || selectedWith.id,
            status: 'failed',
            amount: selectedWith.amount,
          }),
        }).catch(err => console.error("Push notification error:", err));
      }

      await batch.commit();
      toast({ title: 'نجاح', description: `تم ${withAction === 'approve' ? 'قبول' : 'رفض'} طلب السحب وإشعار العميل.` });
      setWithAction(null);
      setSelectedWith(null);
      setWithRejectNote('');
    } catch (err: any) {
      console.error("Error in handleWithdrawalAction:", err);
      toast({ variant: 'destructive', title: 'خطأ', description: err?.message || 'فشلت العملية.' });
    }
  };

  // --- HANDLER: DELETE ARCHIVED ITEM ---
  const [archiveDeleteTarget, setArchiveDeleteTarget] = useState<{
    docName: 'electricityRequests' | 'waterRequests' | 'withdrawalRequests' | 'depositRequests';
    id: string;
    label: string;
  } | null>(null);
  const [isDeletingArchive, setIsDeletingArchive] = useState(false);

  const [clearArchiveTarget, setClearArchiveTarget] = useState<{
    docName: 'electricityRequests' | 'waterRequests' | 'withdrawalRequests' | 'depositRequests';
    label: string;
  } | null>(null);
  const [isClearingArchive, setIsClearingArchive] = useState(false);

  const handleConfirmDeleteArchive = async () => {
    if (!firestore || !archiveDeleteTarget) return;
    setIsDeletingArchive(true);
    try {
      await deleteOrderItemFromDoc(firestore, archiveDeleteTarget.docName, archiveDeleteTarget.id);
      toast({ title: 'تم الحذف', description: 'تم حذف السجل من الأرشيف بنجاح.' });
      setArchiveDeleteTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e?.message || 'تعذر حذف السجل من الأرشيف.' });
    } finally {
      setIsDeletingArchive(false);
    }
  };

  const handleConfirmClearArchive = async () => {
    if (!firestore || !clearArchiveTarget) return;
    setIsClearingArchive(true);
    try {
      await clearArchivedOrderItemsInDoc(firestore, clearArchiveTarget.docName);
      toast({ title: 'تم الحذف', description: `تم حذف جميع سجلات ${clearArchiveTarget.label} من الأرشيف بنجاح.` });
      setClearArchiveTarget(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e?.message || 'تعذر حذف الأرشيف.' });
    } finally {
      setIsClearingArchive(false);
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

        let currentBal = 0;
        try {
          const userSnap = await getDoc(userRef);
          const prevBal = Number(userSnap.data()?.balance || 0);
          currentBal = prevBal + Number(selectedDep.amount || 0);
        } catch (_) {}

        const formattedAmt = Number(selectedDep.amount).toLocaleString('en-US');
        const formattedBal = currentBal.toLocaleString('en-US');
        const bankNameText = selectedDep.bankName || 'البنك';
        const txIdText = selectedDep.transactionId || selectedDep.id || '';

        const notifTitle = 'تم إيداع مبلغ في حسابك بنجاح';
        const notifBody = `تم إيداع ${formattedAmt} ريال من ${bankNameText} | رقم العملية: ${txIdText} | رصيدك الحالي: ${formattedBal} ريال.`;

        await updateOrderItemInDoc(firestore, 'depositRequests', selectedDep.id, {
          status: 'approved',
          readiness: 'جاهزة',
          approvedAt: now
        });

        // تحديث مصفوفة history للعمليات حتى تظهر فوراً "جاهزة" في التطبيق
        try {
          const historyRef = doc(firestore, `users/${selectedDep.userId}/transactions`, 'history');
          const historySnap = await getDoc(historyRef);
          if (historySnap.exists()) {
            const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
            let updated = false;
            const targetId = String(selectedDep.transactionId || selectedDep.id || '').trim();
            const newList = list.map((item: any) => {
              const itemId = String(item.id || item.transactionId || item.operationId || '').trim();
              if (itemId === targetId || itemId === String(selectedDep.id).trim()) {
                updated = true;
                return {
                  ...item,
                  s: 'completed',
                  r: 'جاهزة',
                  readiness: 'جاهزة',
                  status: 'completed',
                  note: `تم تأكيد الإيداع وإضافة مبلغ ${formattedAmt} ر.ي إلى محفظتك بنجاح.`,
                  completedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              batch.update(historyRef, { list: newList, transactions: newList, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating history for deposit:", e);
        }

        // تحديث فرع طلبات الإيداع للمستخدم users/{uid}/deposit_requests/requests
        try {
          const userDepRef = doc(firestore, `users/${selectedDep.userId}/deposit_requests`, 'requests');
          const userDepSnap = await getDoc(userDepRef);
          if (userDepSnap.exists()) {
            const reqs = userDepSnap.data()?.requests || [];
            let updated = false;
            const targetId = String(selectedDep.transactionId || selectedDep.id || '').trim();
            const newReqs = reqs.map((r: any) => {
              const rId = String(r.id || r.operationId || r.transactionId || '').trim();
              if (rId === targetId || rId === String(selectedDep.id).trim()) {
                updated = true;
                return {
                  ...r,
                  status: 'approved',
                  readiness: 'جاهزة',
                  approvedAt: now,
                };
              }
              return r;
            });
            if (updated) {
              batch.update(userDepRef, { requests: newReqs, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating user deposit_requests:", e);
        }

        // إرسال إشعار سحابي FCM مباشر للعميل بدون انتظار الرد لتسريع الاستجابة
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedDep.userId,
            title: notifTitle,
            body: notifBody,
            transid: txIdText,
            status: 'completed',
            amount: selectedDep.amount,
          }),
        }).catch(err => console.error("Push notification error:", err));
      } else {
        const failReason = depRejectNote.trim() || 'لم يتم العثور على إيداع مطابق في البنك';
        await updateOrderItemInDoc(firestore, 'depositRequests', selectedDep.id, {
          status: 'rejected',
          readiness: 'فاشلة',
          rejectReason: failReason,
          rejectedAt: now
        });

        // تحديث مصفوفة history للعمليات إلى فاشلة
        try {
          const historyRef = doc(firestore, `users/${selectedDep.userId}/transactions`, 'history');
          const historySnap = await getDoc(historyRef);
          if (historySnap.exists()) {
            const list = historySnap.data()?.list || historySnap.data()?.transactions || [];
            let updated = false;
            const targetId = String(selectedDep.transactionId || selectedDep.id || '').trim();
            const newList = list.map((item: any) => {
              const itemId = String(item.id || item.transactionId || item.operationId || '').trim();
              if (itemId === targetId || itemId === String(selectedDep.id).trim()) {
                updated = true;
                return {
                  ...item,
                  s: 'failed',
                  r: 'فاشلة',
                  readiness: 'فاشلة',
                  status: 'failed',
                  note: `تم رفض طلب الإيداع. السبب: ${failReason}`,
                  failedAt: now,
                };
              }
              return item;
            });
            if (updated) {
              batch.update(historyRef, { list: newList, transactions: newList, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating history for deposit rejection:", e);
        }

        // تحديث فرع طلبات الإيداع للمستخدم users/{uid}/deposit_requests/requests
        try {
          const userDepRef = doc(firestore, `users/${selectedDep.userId}/deposit_requests`, 'requests');
          const userDepSnap = await getDoc(userDepRef);
          if (userDepSnap.exists()) {
            const reqs = userDepSnap.data()?.requests || [];
            let updated = false;
            const targetId = String(selectedDep.transactionId || selectedDep.id || '').trim();
            const newReqs = reqs.map((r: any) => {
              const rId = String(r.id || r.operationId || r.transactionId || '').trim();
              if (rId === targetId || rId === String(selectedDep.id).trim()) {
                updated = true;
                return {
                  ...r,
                  status: 'rejected',
                  readiness: 'فاشلة',
                  rejectReason: failReason,
                  rejectedAt: now,
                };
              }
              return r;
            });
            if (updated) {
              batch.update(userDepRef, { requests: newReqs, lastUpdated: now });
            }
          }
        } catch (e) {
          console.error("Error updating user deposit_requests rejection:", e);
        }

        // إرسال إشعار سحابي FCM مباشر للعميل بدون انتظار الرد لتسريع الاستجابة
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedDep.userId,
            title: 'تعذر قبول طلب التغذية ❌',
            body: `تم رفض طلب تغذية رصيدك بمبلغ ${selectedDep.amount.toLocaleString()} ر.ي. السبب: ${failReason}`,
            transid: selectedDep.transactionId || selectedDep.id,
            status: 'failed',
            amount: selectedDep.amount,
          }),
        }).catch(err => console.error("Push notification error:", err));
      }

      await batch.commit();
      toast({ title: 'نجاح', description: `تم ${depAction === 'approve' ? 'قبول' : 'رفض'} طلب الإيداع وإشعار العميل.` });
      setDepAction(null);
      setSelectedDep(null);
      setDepRejectNote('');
    } catch (err: any) {
      console.error("Error in handleDepositAction:", err);
      toast({ variant: 'destructive', title: 'خطأ', description: err?.message || 'فشلت العملية.' });
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
                {archivedElect.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 px-3 rounded-xl font-black text-xs gap-1.5"
                      onClick={() => setClearArchiveTarget({ docName: 'electricityRequests', label: 'أرشيف الكهرباء' })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف الكل ({archivedElect.length})</span>
                    </Button>
                  </div>
                )}
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
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] font-black", req.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {req.status === 'completed' ? 'تم السداد' : 'ملغي'}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveDeleteTarget({
                              docName: 'electricityRequests',
                              id: req.id,
                              label: `فاتورة كهرباء (${req.subscriberName || req.subscriberNumber})`,
                            });
                          }}
                          title="حذف من الأرشيف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                {archivedWater.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 px-3 rounded-xl font-black text-xs gap-1.5"
                      onClick={() => setClearArchiveTarget({ docName: 'waterRequests', label: 'أرشيف المياه' })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف الكل ({archivedWater.length})</span>
                    </Button>
                  </div>
                )}
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
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] font-black", req.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {req.status === 'completed' ? 'تم السداد' : 'ملغي'}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveDeleteTarget({
                              docName: 'waterRequests',
                              id: req.id,
                              label: `فاتورة مياه (${req.subscriberName || req.subscriberNumber})`,
                            });
                          }}
                          title="حذف من الأرشيف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                {archivedWith.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 px-3 rounded-xl font-black text-xs gap-1.5"
                      onClick={() => setClearArchiveTarget({ docName: 'withdrawalRequests', label: 'أرشيف السحب' })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف الكل ({archivedWith.length})</span>
                    </Button>
                  </div>
                )}
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
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] font-black", req.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveDeleteTarget({
                              docName: 'withdrawalRequests',
                              id: req.id,
                              label: `طلب سحب (${req.ownerName || 'مالك شبكة'})`,
                            });
                          }}
                          title="حذف من الأرشيف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                {archivedDep.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-9 px-3 rounded-xl font-black text-xs gap-1.5"
                      onClick={() => setClearArchiveTarget({ docName: 'depositRequests', label: 'أرشيف الإيداعات' })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف الكل ({archivedDep.length})</span>
                    </Button>
                  </div>
                )}
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
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] font-black", req.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiveDeleteTarget({
                              docName: 'depositRequests',
                              id: req.id,
                              label: `طلب إيداع (${req.userName || 'عميل'})`,
                            });
                          }}
                          title="حذف من الأرشيف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <AlertDialog open={!!archiveDeleteTarget} onOpenChange={(open) => !open && setArchiveDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">تأكيد الحذف من الأرشيف</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs pt-1">
              هل أنت متأكد من حذف {archiveDeleteTarget?.label} نهائياً من الأرشيف؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-3">
            <AlertDialogAction
              className="rounded-2xl h-11 font-black bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDeleteArchive}
              disabled={isDeletingArchive}
            >
              {isDeletingArchive ? <Loader2 className="animate-spin h-4 w-4" /> : 'تأكيد الحذف'}
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-11 font-black">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clearArchiveTarget} onOpenChange={(open) => !open && setClearArchiveTarget(null)}>
        <AlertDialogContent className="rounded-[32px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">تأكيد حذف كل الأرشيف</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs pt-1">
              هل أنت متأكد من حذف جميع سجلات {clearArchiveTarget?.label} نهائياً؟ (لن تتأثر الطلبات المعلقة الحالية)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-3">
            <AlertDialogAction
              className="rounded-2xl h-11 font-black bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmClearArchive}
              disabled={isClearingArchive}
            >
              {isClearingArchive ? <Loader2 className="animate-spin h-4 w-4" /> : 'حذف الكل'}
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-11 font-black">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
