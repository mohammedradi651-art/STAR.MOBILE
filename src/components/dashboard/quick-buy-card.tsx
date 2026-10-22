'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  CheckCircle, 
  Copy, 
  MessageSquare, 
  Smartphone, 
  Loader2, 
  Database, 
  Clock, 
  ArrowUpRight,
  Gift
} from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, increment, collection, updateDoc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

export const dynamic = 'force-dynamic';

type NetworkCard = {
    cardID: string;
    cardPass?: string;
};

export function QuickBuyCard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [delayedOrderPopupOpen, setDelayedOrderPopupOpen] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<NetworkCard | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<any>(userDocRef);

  const getFirstLast = (name?: string) => {
    if (!name) return 'عميلنا';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const cardDetails = {
    name: "عرض العيد: 55GB - شبكة الخير",
    price: 2000,
    data: "55GB",
    validity: "شهر واحد",
    classId: "2000"
  };

  const handlePurchase = async () => {
    if (!user || !userProfile || !firestore || !userDocRef) return;

    if ((userProfile.balance ?? 0) < cardDetails.price) {
      toast({
        variant: "destructive",
        title: "رصيد غير كافٍ",
        description: "رصيدك الحالي لا يكفي لإتمام عملية الشراء.",
      });
      return;
    }

    setIsProcessing(true);
    const externalRef = `SM-BN-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const txRef = doc(collection(firestore, `users/${user.uid}/transactions`));
    const baityOrderRef = doc(firestore, 'baityOrders', externalRef);

    try {
      // 1. خصم المبلغ فوراً من العميل بمجرد تأكيد الشراء
      const initBatch = writeBatch(firestore);
      initBatch.update(userDocRef, { balance: increment(-cardDetails.price) });
      initBatch.set(txRef, {
        id: txRef.id,
        userId: user.uid,
        transactionDate: now,
        amount: cardDetails.price,
        transactionType: `شراء ${cardDetails.name}`,
        notes: `شبكة الخير - عرض العيد الحصري`,
        status: 'pending',
        externalRef: externalRef,
        networkName: 'شبكة الخير',
        className: cardDetails.name,
        classId: cardDetails.classId,
      });
      initBatch.set(baityOrderRef, {
        externalRef: externalRef,
        userId: user.uid,
        transactionId: txRef.id,
        classId: cardDetails.classId,
        className: cardDetails.name,
        networkName: 'شبكة الخير',
        networkId: '1',
        price: cardDetails.price,
        status: 'pending',
        phoneNumber: userProfile.phoneNumber || '',
        displayName: userProfile.displayName || '',
        createdAt: now,
      });
      await initBatch.commit();

      let isHandled = false;
      let timeoutId: any = null;
      let unsubscribe: (() => void) | null = null;

      const handleOrderFailure = async (reason: string, isStockOutArg?: boolean) => {
        if (isHandled) return;
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (unsubscribe) unsubscribe();

        try {
          const refundBatch = writeBatch(firestore);
          refundBatch.update(userDocRef!, { balance: increment(cardDetails.price) });
          refundBatch.update(txRef, {
            status: 'failed',
            readiness: 'فاشلة',
            notes: `شبكة: شبكة الخير (فشل الشراء)`,
            failedAt: new Date().toISOString()
          });
          refundBatch.update(baityOrderRef, {
            status: 'failed',
            failedAt: new Date().toISOString(),
            errorReason: reason || 'فشل الشراء من المزود'
          });
          await refundBatch.commit();
        } catch (refErr) {
          console.error("Refund commit error:", refErr);
        }

        setIsOpen(false);
        setIsProcessing(false);

        const isStockOut = isStockOutArg || /مخزون|نفاد|انتهى/i.test(reason);
        const failureMsg = isStockOut 
          ? "فشل الشراء: انتهى المخزون\nيرجى التواصل مع الادارة 770326828" 
          : "فشل الشراء\nيرجى التواصل مع الادارة 770326828";

        toast({
          variant: "destructive",
          title: "فشل الشراء",
          description: failureMsg,
          duration: 9000
        });
      };

      const handleOrderSuccess = async (cardData: { cardID: string; cardPass?: string }, uuidOrder?: string) => {
        if (isHandled) return;
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (unsubscribe) unsubscribe();

        try {
          const finishBatch = writeBatch(firestore);
          finishBatch.update(txRef, {
            status: 'completed',
            readiness: 'جاهزة',
            cardNumber: cardData.cardID,
            cardPassword: cardData.cardPass || cardData.cardID,
            completedAt: new Date().toISOString()
          });
          finishBatch.update(baityOrderRef, {
            status: 'completed',
            cardNumber: cardData.cardID,
            cardPass: cardData.cardPass || '',
            uuidOrder: uuidOrder || '',
            completedAt: new Date().toISOString()
          });
          await finishBatch.commit().catch(() => {});
        } catch (e) {
          console.error("Finish batch error:", e);
        }

        // إرسال SMS بالصيغة الملكية الجديدة
        if (userProfile?.phoneNumber) {
          const shortName = getFirstLast(userProfile.displayName);
          const smsMsg = `ستار موبايل\nمرحباً ${shortName}،\n\nتم شراء كرت الإنترنت الخاص بك بنجاح.\n\nالشبكة: شبكة الخير\nالفئة: عرض العيد 55GB\nرقم الكرت: ${cardData.cardID}`;
          
          fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: userProfile.phoneNumber.trim(),
              message: smsMsg
            })
          }).catch(e => console.error("SMS Notify Error", e));
        }

        setPurchasedCard(cardData);
        setIsOpen(false);
        setIsProcessing(false);
        audioRef.current?.play().catch(() => {});
      };

      // ننتظر الرد المباشر أو استجابة الويب هوك أو 50 ثانية
      await new Promise<void>((resolve) => {
        // 1) مؤقت 50 ثانية: إذا تأخر الرد تظهر المنبثقة
        timeoutId = setTimeout(() => {
          if (!isHandled) {
            isHandled = true;
            if (unsubscribe) unsubscribe();
            setIsOpen(false);
            setIsProcessing(false);
            setDelayedOrderPopupOpen(true);
            resolve();
          }
        }, 50000);

        // 2) الاستماع اللحظي للويب هوك
        unsubscribe = onSnapshot(baityOrderRef, (snap) => {
          if (!snap.exists() || isHandled) return;
          const data = snap.data();
          if (data?.status === 'completed' && data?.cardNumber) {
            handleOrderSuccess({ cardID: data.cardNumber, cardPass: data.cardPass || '' }, data.uuidOrder);
            resolve();
          } else if (data?.status === 'failed') {
            handleOrderFailure(data.errorReason || '');
            resolve();
          }
        });

        // 3) إرسال الطلب المباشر للمزود
        fetch(`/services/networks-api/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            classId: cardDetails.classId,
            externalRef: externalRef 
          })
        })
        .then(async (response) => {
          const result: any = await response.json().catch(() => ({}));
          if (isHandled) return;

          if (response.ok && result?.status === 200 && result?.data?.order?.card?.cardID) {
            handleOrderSuccess(result.data.order.card, result.data.order.uuidOrder);
            resolve();
          } else if (response.ok && result?.status === 200 && result?.data?.order?.uuidOrder && !result?.data?.order?.card) {
            // الطلب قيد الانتظار الفعلي لدى المزود - لا نظهر رسالة استلام بل نستمر بالانتظار حتى الويب هوك أو 50 ثانية
          } else {
            const errMsg = result?.message || 'فشل الشراء من المزود';
            handleOrderFailure(errMsg, result?.isStockOut);
            resolve();
          }
        })
        .catch((err) => {
          if (!isHandled) {
            handleOrderFailure(err?.message || 'خطأ في الاتصال بالمزود');
            resolve();
          }
        });
      });
    } catch (error: any) {
      if (userDocRef) {
        try {
          await updateDoc(userDocRef, { balance: increment(cardDetails.price) });
        } catch (refErr) {
          console.error("Refund error:", refErr);
        }
      }
      setIsOpen(false);
      toast({ 
        variant: "destructive",
        title: "فشل الشراء", 
        description: "فشل الشراء\nيرجى التواصل مع الادارة 770326828"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (purchasedCard) {
      navigator.clipboard.writeText(purchasedCard.cardID);
      toast({ title: "تم النسخ" });
    }
  };

  const handleSendSms = () => {
    if (!purchasedCard || !smsRecipient) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى إدخال رقم الزبون.' });
      return;
    }
    const name = userProfile?.displayName || 'عميلنا';
    const balance = (userProfile?.balance ?? 0).toLocaleString('en-US');
    const msg = `${name} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : شبكة الخير\nالفئة: عرض العيد 55GB\nرقم الكرت: ${purchasedCard.cardID}\n\n*رصيدك:* ${balance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
    
    window.location.href = `sms:${smsRecipient}?body=${encodeURIComponent(msg)}`;
    setIsSmsDialogOpen(false);
  };

  return (
    <div className="px-4 mt-2">
      <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
      
      {isProcessing && <ProcessingOverlay message="جاري معالجة طلبك..." />}

      <Card 
        className="relative overflow-hidden rounded-[20px] border-none shadow-lg bg-gradient-to-r from-orange-400 via-rose-500 to-primary cursor-pointer active:scale-[0.98] transition-all group"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <Gift className="h-5 w-5 text-white animate-bounce" />
            </div>
            <div className="text-right">
              <h4 className="text-[13px] font-black text-white">{cardDetails.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-white/80 flex items-center gap-1">
                  <Database className="w-3 h-3 text-white/60" /> {cardDetails.data}
                </span>
                <span className="text-[10px] font-bold text-white/80 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-white/60" /> {cardDetails.validity}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/20">
              <span className="text-white font-black text-xs">{cardDetails.price.toLocaleString()} ر.ي</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-2xl bg-[#F8FAFC] dark:bg-slate-950">
          <div className="bg-mesh-gradient pt-12 pb-10 px-8 text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
            <div className="relative z-10 space-y-4">
              <div className="bg-white/20 p-4 rounded-[28px] w-20 h-20 mx-auto backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                <Gift className="h-10 w-10 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-white drop-shadow-md">عرض العيد الحصري</DialogTitle>
                <DialogDescription className="text-xs text-white/70 font-bold mt-1 uppercase tracking-widest">شبكة الخير - باقة التوفير الكبرى</DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-none shadow-sm rounded-3xl p-4 bg-white dark:bg-slate-900 text-center">
                <Database className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">سعة البيانات</p>
                <p className="text-lg font-black text-foreground">{cardDetails.data}</p>
              </Card>
              <Card className="border-none shadow-sm rounded-3xl p-4 bg-white dark:bg-slate-900 text-center">
                <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">الصلاحية</p>
                <p className="text-lg font-black text-foreground">{cardDetails.validity}</p>
              </Card>
            </div>

            <div className="bg-muted/50 p-6 rounded-[32px] border-2 border-dashed border-primary/10 text-center space-y-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">المبلغ المخصوم من رصيدك</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-black text-primary">{cardDetails.price.toLocaleString()}</span>
                <span className="text-xs font-bold text-primary/70">ريال</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                className="h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 bg-primary text-white" 
                onClick={handlePurchase}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : 'تأكيد الشراء'}
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl font-black text-lg" onClick={() => setIsOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {purchasedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 animate-in fade-in-0">
            <Card className="w-full max-sm text-center shadow-2xl rounded-[48px] overflow-hidden border-none bg-background">
                <CardContent className="p-8 space-y-6">
                    <div className="bg-green-500 p-8 flex justify-center mb-4 rounded-t-[48px] -m-8">
                        <CheckCircle className="h-20 w-20 text-white animate-bounce" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-green-600">مبروك! تم الشراء بنجاح</h2>
                        <p className="text-sm text-muted-foreground mt-1">رقم كرتك لشبكة الخير ({cardDetails.data})</p>
                    </div>
                    <div className="p-6 bg-muted rounded-3xl border-2 border-dashed border-primary/20">
                        <p className="text-4xl font-black font-mono tracking-widest text-foreground">{purchasedCard.cardID}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Button className="rounded-2xl h-12 font-bold" onClick={handleCopy}>
                            <Copy className="ml-2 h-4 w-4" /> نسخ الكرت
                        </Button>
                        <Button variant="outline" className="rounded-2xl h-12 font-black" onClick={() => setIsSmsDialogOpen(true)}>
                            <MessageSquare className="ml-2 h-4 w-4" /> ارسال SMS
                        </Button>
                    </div>
                    <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => { setPurchasedCard(null); setIsOpen(false); }}>إغلاق</Button>
                </CardContent>
            </Card>
        </div>
      )}

      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 z-[10002] bg-white dark:bg-slate-900 border-none shadow-2xl outline-none">
            <DialogHeader>
                <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="text-primary h-6 w-6" />
                </div>
                <DialogTitle className="text-center text-xl font-black">ارسال كرت لزبون</DialogTitle>
                <DialogDescription className="text-center font-bold">
                    أدخل رقم جوال الزبون لفتح تطبيق الرسائل وإرسال بيانات الكرت.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
                <div className="space-y-2 text-right">
                    <Label htmlFor="sms-phone" className="text-[10px] font-black text-muted-foreground pr-1 uppercase tracking-widest">رقم جوال الزبون</Label>
                    <Input 
                        id="sms-phone"
                        placeholder="7xxxxxxxx" 
                        type="tel" 
                        value={smsRecipient} 
                        onChange={e => setSmsRecipient(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                        className="text-center text-2xl font-black h-14 rounded-2xl border-2 tracking-widest bg-muted/20" 
                    />
                </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3">
                <Button onClick={handleSendSms} className="w-full h-12 rounded-2xl font-black text-base shadow-lg" disabled={!smsRecipient || smsRecipient.length < 9}>إرسال الآن</Button>
                <Button variant="outline" className="w-full h-12 rounded-2xl font-black text-base mt-0" onClick={() => setIsSmsDialogOpen(false)}>إلغاء</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delayed Order Dialog (50s timeout) */}
      <Dialog open={delayedOrderPopupOpen} onOpenChange={setDelayedOrderPopupOpen}>
        <DialogContent className="rounded-[32px] max-w-sm p-6 z-[10002] bg-white dark:bg-slate-900 border-none shadow-2xl text-center" dir="rtl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500 mb-1">
              <Clock className="w-8 h-8 animate-pulse text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white">
              سنقوم بإرسال الكرت إليك بعد لحظات
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              طلبك قيد المعالجة لدى المزود وسيصلك الكرت وتجده في سجل العمليات فور صدوره.
            </DialogDescription>
            <Button 
              className="w-full mt-3 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-base shadow-lg"
              onClick={() => setDelayedOrderPopupOpen(false)}
            >
              حسناً
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isProcessing && <ProcessingOverlay message="جاري تجهيز واستخراج الكرت من المزود... يرجى الانتظار" />}
    </div>
  );
}
