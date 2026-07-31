'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { collection, doc, updateDoc, increment, query, orderBy, addDoc, writeBatch } from 'firebase/firestore';
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
import { User, Tag, Phone, CreditCard, Calendar, Check, X, Archive, Inbox, Trash2, MessageCircle, Building, HelpCircle, Loader2 } from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type BillPaymentRequest = {
  id: string;
  userId: string;
  userName: string;
  userPhoneNumber: string;
  targetPhoneNumber: string;
  company: string;
  serviceType: string;
  amount: number;
  commission: number;
  totalCost: number;
  status: 'pending' | 'approved' | 'rejected';
  requestTimestamp: string;
  transid?: string;
};

type OperationStatus = {
    isDone: string; // "1" or "0"
    isBan: string; // "1" or "0"
    reason: string;
};

const StatusBadge = ({ status }: { status: BillPaymentRequest['status'] }) => {
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

export default function BillPaymentRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<BillPaymentRequest | null>(null);
  const [actionToConfirm, setActionToConfirm] = useState<'approve' | 'reject' | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDeleteAllAlertOpen, setIsDeleteAllAlertOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);


  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'billPaymentRequests'), orderBy('requestTimestamp', 'desc')) : null),
    [firestore]
  );
  const { data: requests, isLoading } = useCollection<BillPaymentRequest>(requestsQuery);

  const { pendingRequests, archivedRequests } = useMemo(() => {
    const pending: BillPaymentRequest[] = [];
    const archived: BillPaymentRequest[] = [];
    requests?.forEach(req => {
      if (req.status === 'pending') {
        pending.push(req);
      } else {
        archived.push(req);
      }
    });
    return { pendingRequests: pending, archivedRequests: archived };
  }, [requests]);


  const handleAction = async (actionType?: 'approve' | 'reject') => {
    const finalAction = actionType || actionToConfirm;
    if (!selectedRequest || !finalAction || !firestore) return;

    const requestDocRef = doc(firestore, 'billPaymentRequests', selectedRequest.id);
    const userDocRef = doc(firestore, 'users', selectedRequest.userId);
    const userTransactionsRef = collection(firestore, 'users', selectedRequest.userId, 'transactions');
    const userNotificationsRef = collection(firestore, 'users', selectedRequest.userId, 'notifications');
    
    try {
        const batch = writeBatch(firestore);

        if (finalAction === 'approve') {
              const transactionRef = doc(userTransactionsRef);
              batch.set(transactionRef, {
                userId: selectedRequest.userId,
                transactionDate: new Date().toISOString(),
                amount: selectedRequest.totalCost,
                transactionType: `سداد ${selectedRequest.company}`,
                notes: `إلى رقم: ${selectedRequest.targetPhoneNumber}`,
                recipientPhoneNumber: selectedRequest.targetPhoneNumber,
              });
        } else { // 'reject'
            batch.update(userDocRef, {
                balance: increment(selectedRequest.totalCost)
            });

            const refundTransactionRef = doc(userTransactionsRef);
            batch.set(refundTransactionRef, {
                userId: selectedRequest.userId,
                transactionDate: new Date().toISOString(),
                amount: selectedRequest.totalCost,
                transactionType: 'استرجاع مبلغ مرفوض',
                notes: `تم رفض طلب سداد "${selectedRequest.company}". ${rejectionNote ? `السبب: ${rejectionNote}` : ''}`,
            });

            const notificationRef = doc(userNotificationsRef);
            batch.set(notificationRef, {
                title: 'تم رفض طلب السداد',
                body: `تم رفض طلب سداد فاتورة ${selectedRequest.company}. السبب: ${rejectionNote || 'لا يوجد سبب محدد.'}`,
                timestamp: new Date().toISOString(),
            });
        }

        batch.update(requestDocRef, { status: finalAction === 'approve' ? 'approved' : 'rejected' });

        await batch.commit();

        toast({
            title: "نجاح",
            description: `تم ${finalAction === 'approve' ? 'قبول الطلب بنجاح.' : 'رفض الطلب وإرجاع المبلغ للمستخدم.'}`,
        });

    } catch (error: any) {
        console.error("Error processing request: ", error);
        toast({
            variant: "destructive",
            title: "خطأ",
            description: "حدث خطأ أثناء معالجة الطلب.",
        });
    } finally {
        setActionToConfirm(null);
        setSelectedRequest(null);
        setIsDialogOpen(false);
        setRejectionNote('');
    }
  };

  const handleCheckStatus = useCallback(async () => {
    if (!selectedRequest?.transid || !selectedRequest?.targetPhoneNumber) {
        toast({
            variant: 'destructive',
            title: 'خطأ',
            description: 'لا يوجد رقم معاملة (transid) للتحقق منه.'
        });
        return;
    }
    setIsCheckingStatus(true);
    try {
        const response = await fetch(`/api/telecom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'status',
                mobile: selectedRequest.targetPhoneNumber,
                transid: selectedRequest.transid,
            })
        });
        const data: OperationStatus = await response.json();

        if (!response.ok) {
            throw new Error((data as any).message || 'فشل التحقق من الحالة.');
        }

        let statusDescription = 'الحالة غير معروفة.';
        if (data.isDone === '1' && data.isBan === '0') {
            statusDescription = `✅ نجحت العملية: ${data.reason}`;
        } else if (data.isDone === '0' && data.isBan === '0') {
            statusDescription = `⏳ لا تزال قيد التنفيذ: ${data.reason}`;
        } else if (data.isBan === '1') {
            statusDescription = `❌ محظورة/مرفوضة: ${data.reason}`;
        }

        toast({
            title: 'نتيجة التحقق من العملية',
            description: statusDescription,
            duration: 9000,
        });

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'فشل التحقق',
            description: error.message,
        });
    } finally {
        setIsCheckingStatus(false);
    }
}, [selectedRequest, toast]);

  const handleDelete = () => {
    if (!selectedRequest || !firestore) return;
    const requestDocRef = doc(firestore, 'billPaymentRequests', selectedRequest.id);
    deleteDocumentNonBlocking(requestDocRef);
    toast({
        title: "تم الحذف",
        description: "تم حذف الطلب من الأرشيف بنجاح."
    });
    setIsDeleteAlertOpen(false);
    setSelectedRequest(null);
    setIsDialogOpen(false);
  }

  const handleDeleteAllArchived = () => {
    if (!firestore || !archivedRequests || archivedRequests.length === 0) return;
    
    const batch = writeBatch(firestore);
    archivedRequests.forEach(request => {
      const docRef = doc(firestore, 'billPaymentRequests', request.id);
      batch.delete(docRef);
    });

    batch.commit()
      .then(() => {
        toast({
          title: 'نجاح',
          description: 'تم حذف جميع الطلبات المؤرشفة بنجاح.'
        });
      })
      .catch((serverError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: '/billPaymentRequests'
        });
        errorEmitter.emit('permission-error', contextualError);
      });

    setIsDeleteAllAlertOpen(false);
  };

  const RequestList = ({ list, emptyMessage }: { list: BillPaymentRequest[], emptyMessage: string }) => {
    if (!list || list.length === 0) {
      return <p className="text-center text-muted-foreground mt-10">{emptyMessage}</p>;
    }
    return (
        <div className="space-y-3">
          {list.map((request) => (
            <div
              key={request.id}
              onClick={() => {
                setSelectedRequest(request);
                setIsDialogOpen(true);
              }}
              className="cursor-pointer"
            >
              <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                      <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                      <p className="font-bold">{request.userName}</p>
                      <p className="text-sm text-muted-foreground">{request.company} - {request.serviceType}</p>
                  </div>
                  </div>
                  <div className="text-left flex flex-col items-end gap-1">
                      <StatusBadge status={request.status} />
                      <span className="text-xs text-muted-foreground">
                          {format(parseISO(request.requestTimestamp), 'P', { locale: ar })}
                      </span>
                  </div>
              </CardContent>
              </Card>
            </div>
          ))}
        </div>
    );
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      );
    }
    return (
        <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">
                   <Inbox className="ml-2 h-4 w-4"/>
                   الطلبات الحالية ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="archived">
                    <Archive className="ml-2 h-4 w-4"/>
                    الأرشيف ({archivedRequests.length})
                </TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="p-4">
               <RequestList list={pendingRequests} emptyMessage="لا توجد طلبات سداد حاليًا."/>
            </TabsContent>
            <TabsContent value="archived" className="p-4 space-y-4">
                {archivedRequests.length > 0 && (
                    <Button variant="destructive" className="w-full" onClick={() => setIsDeleteAllAlertOpen(true)}>
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف كل الأرشيف
                    </Button>
                )}
                <RequestList list={archivedRequests} emptyMessage="لا توجد طلبات مؤرشفة."/>
            </TabsContent>
        </Tabs>
    );
  };
  
  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
    <div className="flex justify-between items-center">
        <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" /> {label}:</span>
        <span className="font-semibold">{typeof value === 'number' ? `${value.toLocaleString('en-US')} ريال` : value}</span>
    </div>
  );

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="طلبات كبينة السداد" />
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
      <Toaster />

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedRequest(null);
        }
        setIsDialogOpen(open);
      }}>
         {selectedRequest && (
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>تفاصيل طلب السداد</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-3 text-sm">
                    <InfoRow icon={User} label="اسم العميل" value={selectedRequest.userName} />
                    <InfoRow icon={Phone} label="رقم العميل" value={selectedRequest.userPhoneNumber} />
                    <hr className="my-2"/>
                    <InfoRow icon={Building} label="الشركة" value={selectedRequest.company} />
                     <InfoRow icon={Tag} label="نوع الخدمة" value={selectedRequest.serviceType} />
                    <InfoRow icon={Phone} label="رقم السداد" value={selectedRequest.targetPhoneNumber} />
                    <InfoRow icon={Calendar} label="تاريخ الطلب" value={format(parseISO(selectedRequest.requestTimestamp), 'Pp', { locale: ar })} />
                    <hr className="my-2"/>
                    <InfoRow icon={CreditCard} label="مبلغ الفاتورة" value={selectedRequest.amount} />
                    <InfoRow icon={CreditCard} label="العمولة" value={selectedRequest.commission} />
                    <div className="flex justify-between items-center pt-2 border-t mt-3">
                        <span className="text-muted-foreground font-semibold">التكلفة الإجمالية:</span>
                        <span className="font-bold text-lg text-primary dark:text-primary-foreground">{selectedRequest.totalCost.toLocaleString('en-US')} ريال</span>
                    </div>
                </div>
                <DialogFooter className="grid grid-cols-2 gap-2">
                    {selectedRequest.status === 'pending' && (
                    <>
                        <Button variant="destructive" onClick={() => setActionToConfirm('reject')}><X className="ml-2"/> رفض</Button>
                        <Button onClick={() => handleAction('approve')}><Check className="ml-2"/> قبول</Button>
                        {selectedRequest.transid && (
                            <Button variant="outline" className="col-span-2" onClick={handleCheckStatus} disabled={isCheckingStatus}>
                                {isCheckingStatus ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <HelpCircle className="ml-2 h-4 w-4" />}
                                {isCheckingStatus ? 'جاري التحقق...' : 'التحقق من حالة العملية'}
                            </Button>
                        )}
                    </>
                    )}
                     {selectedRequest.status !== 'pending' && (
                         <>
                            <Button variant="destructive" onClick={() => setIsDeleteAlertOpen(true)} className="col-span-1">
                                <Trash2 className="ml-2 h-4 w-4"/>
                                حذف
                            </Button>
                            <DialogClose asChild>
                                <Button variant="outline" className="col-span-1">إغلاق</Button>
                            </DialogClose>
                         </>
                     )}
                </DialogFooter>
            </DialogContent>
        )}
      </Dialog>

      <AlertDialog open={!!actionToConfirm} onOpenChange={(open) => {
          if (!open) {
            setActionToConfirm(null);
            setRejectionNote('');
          }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm === 'approve'
                ? `سيتم تأكيد العملية وتسجيلها في سجل عمليات المستخدم.`
                : 'سيتم رفض هذا الطلب وإرجاع المبلغ للعميل. لا يمكن التراجع عن هذا الإجراء.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
           {actionToConfirm === 'reject' && (
             <div className="grid w-full gap-1.5 pt-2">
                <Label htmlFor="rejection-note" className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> سبب الرفض (اختياري)</Label>
                <Textarea 
                    placeholder="اكتب سبب رفض الطلب هنا..." 
                    id="rejection-note" 
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAction()}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا الطلب من الأرشيف؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllAlertOpen} onOpenChange={setIsDeleteAllAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف جميع الطلبات المؤرشفة؟ سيتم حذف {archivedRequests.length} طلبات نهائيًا ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllArchived} className="bg-destructive hover:bg-destructive/90">حذف الكل</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
