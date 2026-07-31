'use client';

import React, { useState, useMemo } from 'react';
import { collection, doc, query, orderBy, updateDoc, addDoc, writeBatch, getDocs, where, increment } from 'firebase/firestore';
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
import { User, Phone, Check, X, Archive, Inbox, Banknote, Building, Image as ImageIcon, MessageCircle, Trash2 } from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type WithdrawalRequest = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhoneNumber: string;
  amount: number;
  paymentMethodName: string;
  paymentMethodLogo?: string;
  recipientName: string;
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  requestTimestamp: string;
};

type SoldCard = {
    id: string;
    payoutStatus: 'pending' | 'completed';
};

const StatusBadge = ({ status }: { status: WithdrawalRequest['status'] }) => {
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

const getLogoSrc = (url?: string) => {
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      return url;
    }
    return 'https://placehold.co/100x100/e2e8f0/e2e8f0'; 
};

export default function WithdrawalRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [actionToConfirm, setActionToConfirm] = useState<'approve' | 'reject' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');


  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'withdrawalRequests'), orderBy('requestTimestamp', 'desc')) : null),
    [firestore]
  );
  const { data: requests, isLoading } = useCollection<WithdrawalRequest>(requestsQuery);

  const { pendingRequests, archivedRequests } = useMemo(() => {
    const pending: WithdrawalRequest[] = [];
    const archived: WithdrawalRequest[] = [];
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

    const requestDocRef = doc(firestore, 'withdrawalRequests', selectedRequest.id);
    const ownerDocRef = doc(firestore, 'users', selectedRequest.ownerId);
    const ownerNotificationsRef = collection(firestore, 'users', selectedRequest.ownerId, 'notifications');
    
    try {
        const batch = writeBatch(firestore);

        if (finalAction === 'approve') {
            // Find all pending sold cards for the owner up to the requested amount and mark them as completed
            const soldCardsRef = collection(firestore, 'soldCards');
            const q = query(soldCardsRef, where('ownerId', '==', selectedRequest.ownerId), where('payoutStatus', '==', 'pending'));
            const soldCardsSnapshot = await getDocs(q);

            let accumulatedAmount = 0;
            for (const cardDoc of soldCardsSnapshot.docs) {
                if (accumulatedAmount < selectedRequest.amount) {
                    const cardData = cardDoc.data();
                    accumulatedAmount += cardData.payoutAmount;
                    batch.update(cardDoc.ref, { payoutStatus: 'completed' });
                } else {
                    break; // Stop once we've covered the withdrawal amount
                }
            }
            
            // NOTE: We do not add the amount to the owner's balance.
            // The process is: Admin sees request, sends money externally, marks as approved.
            // This simply records that the payout for these cards is done.

            const notificationRef = doc(ownerNotificationsRef);
            batch.set(notificationRef, {
                title: 'تمت الموافقة على طلب السحب',
                body: `تمت الموافقة على طلب سحب مبلغ ${selectedRequest.amount.toLocaleString('en-US')} ريال. سيتم إرسال المبلغ إلى حسابك المحدد.`,
                timestamp: new Date().toISOString(),
            });

        } else { // 'reject'
            const notificationRef = doc(ownerNotificationsRef);
            batch.set(notificationRef, {
                title: 'تم رفض طلب السحب',
                body: `تم رفض طلب سحب مبلغ ${selectedRequest.amount.toLocaleString('en-US')} ريال. السبب: ${rejectionNote || 'لا يوجد سبب محدد.'}`,
                timestamp: new Date().toISOString(),
            });
        }

        // Update request status for both approve and reject
        batch.update(requestDocRef, { status: finalAction === 'approve' ? 'approved' : 'rejected' });
        
        await batch.commit();

        toast({
            title: "نجاح",
            description: `تم ${finalAction === 'approve' ? 'قبول' : 'رفض'} طلب السحب بنجاح.`,
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

  const handleDelete = () => {
    if (!selectedRequest || !firestore) return;
    const docRef = doc(firestore, 'withdrawalRequests', selectedRequest.id);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: 'تم الحذف',
      description: `تم حذف طلب "${selectedRequest.ownerName}" بنجاح.`,
    });
    setIsDeleteAlertOpen(false);
    setIsDialogOpen(false);
    setSelectedRequest(null);
  };
  
  const RequestList = ({ list, emptyMessage }: { list: WithdrawalRequest[], emptyMessage: string }) => {
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
                      <p className="font-bold">{request.ownerName}</p>
                      <p className="text-sm text-muted-foreground">{request.paymentMethodName}</p>
                  </div>
                  </div>
                  <div className="text-left flex flex-col items-end gap-1">
                      <p className="font-bold text-lg text-primary">{request.amount.toLocaleString('en-US')} ريال</p>
                      <StatusBadge status={request.status} />
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
               <RequestList list={pendingRequests} emptyMessage="لا توجد طلبات سحب حاليًا."/>
            </TabsContent>
            <TabsContent value="archived" className="p-4">
                <RequestList list={archivedRequests} emptyMessage="لا توجد طلبات مؤرشفة."/>
            </TabsContent>
        </Tabs>
    );
  };
  
  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | React.ReactNode }) => (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0">
        <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" /> {label}:</span>
        <span className="font-semibold">{value}</span>
    </div>
  );

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="طلبات السحب" />
        <div className="flex-1 overflow-y-auto pb-36 no-scrollbar">
          {renderContent()}
        </div>
      </div>
      <Toaster />

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) { setSelectedRequest(null); }
        setIsDialogOpen(open);
      }}>
         {selectedRequest && (
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>تفاصيل طلب السحب</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-2 text-sm">
                    <InfoRow icon={User} label="اسم مالك الشبكة" value={selectedRequest.ownerName} />
                    <InfoRow icon={Phone} label="رقم الهاتف" value={selectedRequest.ownerPhoneNumber} />
                    <InfoRow icon={Banknote} label="المبلغ المطلوب" value={<span className='text-primary font-bold'>{selectedRequest.amount.toLocaleString('en-US')} ريال</span>} />
                    <hr className="my-2"/>
                    <InfoRow icon={ImageIcon} label="طريقة الاستلام" value={
                        <div className="flex items-center gap-2">
                             <Image src={getLogoSrc(selectedRequest.paymentMethodLogo)} alt={selectedRequest.paymentMethodName} width={20} height={20} className="rounded-md" />
                             {selectedRequest.paymentMethodName}
                        </div>
                    } />
                    <InfoRow icon={User} label="اسم المستلم" value={selectedRequest.recipientName} />
                    <InfoRow icon={Building} label="رقم الحساب" value={selectedRequest.accountNumber} />
                </div>
                {selectedRequest.status === 'pending' ? (
                    <DialogFooter className="grid grid-cols-2 gap-2">
                        <Button variant="destructive" onClick={() => setActionToConfirm('reject')}><X className="ml-2"/> رفض الطلب</Button>
                        <Button onClick={() => setActionToConfirm('approve')}><Check className="ml-2"/> قبول الطلب</Button>
                    </DialogFooter>
                ) : (
                     <DialogFooter className="grid grid-cols-2 gap-2">
                        <Button variant="destructive" onClick={() => setIsDeleteAlertOpen(true)}>
                          <Trash2 className="ml-2 h-4 w-4" />
                          حذف
                        </Button>
                        <DialogClose asChild>
                            <Button variant="outline">إغلاق</Button>
                        </DialogClose>
                     </DialogFooter>
                 )}
            </DialogContent>
        )}
      </Dialog>
      
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
                ? `سيتم تأكيد الطلب كمقبول. هذا يعني أنك قمت بإرسال المبلغ المطلوب خارج التطبيق.`
                : 'سيتم رفض هذا الطلب. لن يتم إعادة أي رصيد لأن المبلغ لم يتم خصمه مسبقاً.'}
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
    </>
  );
}
