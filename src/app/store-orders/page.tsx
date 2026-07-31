
'use client';

import React, { useState, useMemo } from 'react';
import { collection, doc, updateDoc, increment, query, orderBy, writeBatch } from 'firebase/firestore';
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
import { User, Tag, Phone, MapPin, Calendar, Check, X, Archive, Inbox, Trash2, MessageCircle, ShoppingBag, Truck, CheckCircle2, Wallet, MessageSquare } from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type StoreOrder = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  productId: string;
  productName: string;
  amount: number;
  address: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  timestamp: string;
};

const StatusBadge = ({ status }: { status: StoreOrder['status'] }) => {
  const statusStyles = {
    pending: 'bg-yellow-400/20 text-yellow-600 border-yellow-400/30',
    shipped: 'bg-blue-400/20 text-blue-600 border-blue-400/30',
    delivered: 'bg-green-400/20 text-green-600 border-green-400/30',
    cancelled: 'bg-red-400/20 text-red-600 border-red-400/30',
  };
  const statusText = {
    pending: 'قيد المعالجة',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'ملغي',
  };

  return <Badge className={statusStyles[status]}>{statusText[status]}</Badge>;
};

export default function StoreOrdersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  const ordersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'storeOrders'), orderBy('timestamp', 'desc')) : null),
    [firestore]
  );
  const { data: orders, isLoading } = useCollection<StoreOrder>(ordersQuery);

  const { activeOrders, archivedOrders } = useMemo(() => {
    const active: StoreOrder[] = [];
    const archived: StoreOrder[] = [];
    orders?.forEach(order => {
      if (order.status === 'pending' || order.status === 'shipped') {
        active.push(order);
      } else {
        archived.push(order);
      }
    });
    return { activeOrders: active, archivedOrders: archived };
  }, [orders]);

  const handleUpdateStatus = async (orderId: string, newStatus: StoreOrder['status']) => {
    if (!firestore) return;
    const orderRef = doc(firestore, 'storeOrders', orderId);
    try {
      await updateDoc(orderRef, { status: newStatus });
      toast({ title: 'تم التحديث', description: `حالة الطلب الآن: ${newStatus === 'shipped' ? 'تم الشحن' : 'تم التوصيل'}` });
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الطلب.' });
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !firestore) return;

    const batch = writeBatch(firestore);
    const orderRef = doc(firestore, 'storeOrders', selectedOrder.id);
    const userRef = doc(firestore, 'users', selectedOrder.userId);
    const txRef = doc(collection(firestore, 'users', selectedOrder.userId, 'transactions'));
    const notifRef = doc(collection(firestore, 'users', selectedOrder.userId, 'notifications'));

    try {
      // 1. Mark order as cancelled
      batch.update(orderRef, { status: 'cancelled' });

      // 2. Refund balance
      batch.update(userRef, { balance: increment(selectedOrder.amount) });

      // 3. Log refund transaction
      batch.set(txRef, {
        userId: selectedOrder.userId,
        transactionDate: new Date().toISOString(),
        amount: selectedOrder.amount,
        transactionType: 'استرجاع مبلغ طلب ملغي',
        notes: `إلغاء طلب: ${selectedOrder.productName}. ${cancelNote ? `السبب: ${cancelNote}` : ''}`
      });

      // 4. Notify user
      batch.set(notifRef, {
        title: 'تم إلغاء طلبك من المتجر',
        body: `تم إلغاء طلب "${selectedOrder.productName}" وإرجاع المبلغ لحسابك. ${cancelNote ? `السبب: ${cancelNote}` : ''}`,
        timestamp: new Date().toISOString()
      });

      await batch.commit();
      toast({ title: 'تم الإلغاء', description: 'تم إلغاء الطلب وإرجاع المبلغ للزبون.' });
      setIsCancelAlertOpen(false);
      setIsDialogOpen(false);
      setCancelNote('');
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت عملية الإلغاء.' });
    }
  };

  const openWhatsApp = (phone: string) => {
    window.open(`https://api.whatsapp.com/send?phone=967${phone}`, '_blank');
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0">
      <span className="text-muted-foreground flex items-center gap-2 text-xs"><Icon className="h-4 w-4" /> {label}:</span>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="طلبات المتجر" />
      
      <Tabs defaultValue="active" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/50">
          <TabsTrigger value="active">طلبات جارية ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="archived">الأرشيف ({archivedOrders.length})</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="active" className="mt-0 space-y-3">
            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : activeOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">لا توجد طلبات جارية حالياً.</p>
            ) : (
              activeOrders.map(order => (
                <Card key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setSelectedOrder(order); setIsDialogOpen(true); }}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><ShoppingBag className="h-5 w-5 text-primary" /></div>
                      <div>
                        <p className="font-bold text-sm">{order.productName}</p>
                        <p className="text-xs text-muted-foreground">{order.userName}</p>
                      </div>
                    </div>
                    <div className="text-left space-y-1">
                      <StatusBadge status={order.status} />
                      <p className="text-[10px] text-muted-foreground">{format(parseISO(order.timestamp), 'd MMM, h:mm a', { locale: ar })}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-0 space-y-3">
            {archivedOrders.map(order => (
              <Card key={order.id} className="opacity-80" onClick={() => { setSelectedOrder(order); setIsDialogOpen(true); }}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg"><Archive className="h-5 w-5 text-muted-foreground" /></div>
                    <div>
                      <p className="font-bold text-sm">{order.productName}</p>
                      <p className="text-xs text-muted-foreground">{order.userName}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <StatusBadge status={order.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-1 py-2">
              <InfoRow icon={User} label="الزبون" value={selectedOrder.userName} />
              <InfoRow icon={Phone} label="رقم الهاتف" value={selectedOrder.userPhone} />
              <InfoRow icon={Tag} label="المنتج" value={selectedOrder.productName} />
              <InfoRow icon={Wallet} label="المبلغ" value={`${selectedOrder.amount.toLocaleString()} ريال`} />
              <InfoRow icon={MapPin} label="العنوان" value={selectedOrder.address} />
              <InfoRow icon={Calendar} label="التاريخ" value={format(parseISO(selectedOrder.timestamp), 'Pp', { locale: ar })} />
              
              <div className="grid grid-cols-2 gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => openWhatsApp(selectedOrder.userPhone)}>
                  <MessageSquare className="ml-2 h-4 w-4" /> مراسلة
                </Button>
                {selectedOrder.status === 'pending' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'shipped')}>
                    <Truck className="ml-2 h-4 w-4" /> تأكيد الشحن
                  </Button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                    <CheckCircle2 className="ml-2 h-4 w-4" /> تم التوصيل
                  </Button>
                )}
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'shipped') && (
                  <Button variant="destructive" size="sm" className="col-span-2" onClick={() => setIsCancelAlertOpen(true)}>
                    <X className="ml-2 h-4 w-4" /> إلغاء الطلب (إرجاع المبلغ)
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع مبلغ {selectedOrder?.amount.toLocaleString()} ريال إلى رصيد الزبون فوراً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label>سبب الإلغاء (اختياري)</Label>
            <Textarea placeholder="مثلاً: المنتج غير متوفر حالياً..." value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
          </div>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1">تراجع</AlertDialogCancel>
            <AlertDialogAction className="flex-1 bg-destructive" onClick={handleCancelOrder}>تأكيد الإلغاء</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
