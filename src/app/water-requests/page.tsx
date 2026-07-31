
'use client';

import React, { useState, useMemo } from 'react';
import { collection, doc, query, orderBy, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
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
import { User, Phone, Check, X, Archive, Inbox, Droplets, Hash, Calendar, Wallet, MapPin, Textarea as TextareaIcon } from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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

const StatusBadge = ({ status }: { status: WaterRequest['status'] }) => {
  const statusStyles = {
    pending: 'bg-yellow-400/20 text-yellow-600 border-yellow-400/30',
    completed: 'bg-green-400/20 text-green-600 border-green-400/30',
    cancelled: 'bg-red-400/20 text-red-600 border-red-400/30',
  };
  const statusText = {
    pending: 'قيد المعالجة',
    completed: 'تم السداد',
    cancelled: 'ملغي/مسترجع',
  };

  return <Badge className={statusStyles[status]}>{statusText[status]}</Badge>;
};

export default function WaterRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<WaterRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'waterRequests'), orderBy('timestamp', 'desc')) : null),
    [firestore]
  );
  const { data: requests, isLoading } = useCollection<WaterRequest>(requestsQuery);

  const { activeRequests, archivedRequests } = useMemo(() => {
    const active: WaterRequest[] = [];
    const archived: WaterRequest[] = [];
    requests?.forEach(req => {
      if (req.status === 'pending') {
        active.push(req);
      } else {
        archived.push(req);
      }
    });
    return { activeRequests: active, archivedRequests: archived };
  }, [requests]);

  const handleComplete = async (requestId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'waterRequests', requestId), { status: 'completed' });
      toast({ title: 'تم التحديث', description: 'تم وضع علامة "تم السداد" على الطلب.' });
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التحديث.' });
    }
  };

  const handleCancelAndRefund = async () => {
    if (!selectedRequest || !firestore) return;

    const batch = writeBatch(firestore);
    const reqRef = doc(firestore, 'waterRequests', selectedRequest.id);
    const userRef = doc(firestore, 'users', selectedRequest.userId);
    const txRef = doc(collection(firestore, `users/${selectedRequest.userId}/transactions`));
    const notifRef = doc(collection(firestore, `users/${selectedRequest.userId}/notifications`));

    try {
      batch.update(reqRef, { status: 'cancelled' });
      batch.update(userRef, { balance: increment(selectedRequest.totalAmount) });
      
      batch.set(txRef, {
        userId: selectedRequest.userId,
        transactionDate: new Date().toISOString(),
        amount: selectedRequest.totalAmount,
        transactionType: 'استرجاع سداد مياه',
        notes: `إلغاء طلب مياه: ${selectedRequest.subscriberNumber}. ${cancelNote ? `السبب: ${cancelNote}` : ''}`
      });

      batch.set(notifRef, {
        title: 'إلغاء طلب سداد مياه',
        body: `نعتذر، تم إلغاء طلب سداد فاتورة المياه للرقم ${selectedRequest.subscriberNumber} وإرجاع المبلغ لحسابك.`,
        timestamp: new Date().toISOString()
      });

      await batch.commit();
      toast({ title: 'تم الإلغاء', description: 'تم إلغاء الطلب وإرجاع المبلغ للمشترك.' });
      setIsCancelAlertOpen(false);
      setIsDialogOpen(false);
      setCancelNote('');
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت العملية.' });
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0 text-xs">
      <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" /> {label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="طلبات المياه" />
      
      <Tabs defaultValue="active" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/50">
          <TabsTrigger value="active">طلبات حالية ({activeRequests.length})</TabsTrigger>
          <TabsTrigger value="archived">الأرشيف ({archivedRequests.length})</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          <TabsContent value="active" className="mt-0 space-y-3">
            {isLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
            ) : activeRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-20">لا توجد طلبات مياه معلقة.</p>
            ) : (
                activeRequests.map(req => (
                    <Card key={req.id} className="cursor-pointer hover:bg-muted/30 transition-all rounded-[28px] border-none shadow-sm" onClick={() => { setSelectedRequest(req); setIsDialogOpen(true); }}>
                        <CardContent className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl"><Droplets className="h-5 w-5 text-blue-600" /></div>
                                <div className="text-right">
                                    <p className="font-black text-sm">{req.subscriberName}</p>
                                    <p className="text-[10px] text-muted-foreground font-bold">{req.city} - {req.subscriberNumber}</p>
                                </div>
                            </div>
                            <div className="text-left">
                                <p className="font-black text-blue-600 text-sm">{req.totalAmount.toLocaleString()} ر.ي</p>
                                <p className="text-[9px] text-muted-foreground">{format(parseISO(req.timestamp), 'd MMM, h:mm a', { locale: ar })}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-0 space-y-3">
            {archivedRequests.map(req => (
                <Card key={req.id} className="opacity-70 rounded-[28px] border-none shadow-sm" onClick={() => { setSelectedRequest(req); setIsDialogOpen(true); }}>
                    <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-muted rounded-xl"><Archive className="h-5 w-5 text-muted-foreground" /></div>
                            <div className="text-right">
                                <p className="font-black text-sm">{req.subscriberName}</p>
                                <p className="text-[10px] text-muted-foreground">{req.city} - {req.subscriberNumber}</p>
                            </div>
                        </div>
                        <StatusBadge status={req.status} />
                    </CardContent>
                </Card>
            ))}
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm rounded-[32px] overflow-hidden p-0 border-none shadow-2xl">
            <div className="bg-blue-600 p-6 text-center text-white">
                <DialogHeader>
                    <DialogTitle className="text-white text-center font-black">تفاصيل سداد المياه</DialogTitle>
                </DialogHeader>
            </div>
          {selectedRequest && (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <InfoRow icon={User} label="صاحب الرقم" value={selectedRequest.subscriberName} />
                <InfoRow icon={MapPin} label="المنطقة" value={selectedRequest.city} />
                <InfoRow icon={Hash} label="رقم المشترك" value={selectedRequest.subscriberNumber} />
                <hr className="my-2 border-dashed" />
                <InfoRow icon={Wallet} label="قيمة الفاتورة" value={`${selectedRequest.billAmount.toLocaleString()} ر.ي`} />
                <InfoRow icon={CheckCircle2} label="العمولة" value={`${selectedRequest.commission} ر.ي`} />
                <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2 mt-2">
                    <span className="font-black text-xs">الإجمالي المخصوم:</span>
                    <span className="font-black text-blue-600 text-base">{selectedRequest.totalAmount.toLocaleString()} ر.ي</span>
                </div>
                <hr className="my-2 border-dashed" />
                <InfoRow icon={User} label="المرسل" value={selectedRequest.userName} />
                <InfoRow icon={Phone} label="رقم المرسل" value={selectedRequest.userPhone} />
              </div>
              
              {selectedRequest.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button variant="destructive" className="rounded-2xl h-12 font-black" onClick={() => setIsCancelAlertOpen(true)}>
                        <X className="ml-2 h-4 w-4" /> رفض
                    </Button>
                    <Button className="rounded-2xl h-12 font-black bg-blue-600 hover:bg-blue-700" onClick={() => handleComplete(selectedRequest.id)}>
                        <Check className="ml-2 h-4 w-4" /> تم السداد
                    </Button>
                </div>
              )}
              {selectedRequest.status !== 'pending' && (
                  <DialogClose asChild><Button variant="outline" className="w-full rounded-2xl h-12 font-black">إغلاق</Button></DialogClose>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent className="rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">إلغاء الطلب واسترجاع المبلغ؟</AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-2">
              هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع مبلغ {selectedRequest?.totalAmount.toLocaleString()} ريال إلى رصيد المشترك فوراً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-[10px] font-black mr-1">سبب الإلغاء (اختياري)</Label>
            <Textarea placeholder="اكتب السبب هنا..." value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} className="rounded-2xl bg-muted/30 border-none" />
          </div>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
            <AlertDialogAction className="w-full rounded-2xl h-12 font-black bg-destructive" onClick={handleCancelAndRefund}>تأكيد الإلغاء</AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-black">تراجع</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
