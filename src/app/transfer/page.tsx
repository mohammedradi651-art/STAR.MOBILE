
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  Send, 
  User, 
  CheckCircle, 
  Search, 
  Loader2, 
  Smartphone, 
  Users,
  ArrowLeftRight,
  ShieldCheck,
  Calendar,
  Hash
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, increment, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

type UserProfile = {
  id: string;
  balance?: number;
  phoneNumber?: string;
  displayName?: string;
};

export default function TransferPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const commission = 100;

  const [recipientPhone, setRecipientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const senderDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: senderProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(senderDocRef);

  useEffect(() => {
    if (showSuccess && audioRef.current) {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
    }
  }, [showSuccess]);

  useEffect(() => {
    const handleSearch = async () => {
      if (recipientPhone.length !== 9 || !firestore || !user) {
        setRecipient(null);
        return;
      }
      if (recipientPhone === senderProfile?.phoneNumber) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكنك التحويل إلى نفسك.' });
        setRecipient(null);
        return;
      }
      
      setIsSearching(true);
      setRecipient(null);

      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('phoneNumber', '==', recipientPhone));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            setRecipient(null);
        } else {
            const docData = querySnapshot.docs[0].data();
            setRecipient({
                ...docData,
                id: querySnapshot.docs[0].id
            } as UserProfile);
        }
      } catch (error: any) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timerId = setTimeout(() => {
        handleSearch();
    }, 600);

    return () => clearTimeout(timerId);

  }, [recipientPhone, firestore, user, senderProfile?.phoneNumber, toast]);

  const handleConfirmClick = () => {
    const numericAmount = parseFloat(amount);
    if (!recipient || !amount || isNaN(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "خطأ", description: "الرجاء إدخال مبلغ صحيح." });
      return;
    }
    if ((senderProfile?.balance ?? 0) < numericAmount + commission) {
        toast({ variant: "destructive", title: "رصيد غير كاف!", description: `رصيدك لا يكفي. المطلوب مع العمولة هو ${(numericAmount + commission).toLocaleString('en-US')} ريال.` });
        return;
    }
    setIsConfirming(true);
  };

  const handleFinalConfirmation = async () => {
    if (!user || !senderProfile || !recipient || !firestore || !senderProfile.displayName || !senderDocRef) return;

    setIsProcessing(true);
    const numericAmount = parseFloat(amount);
    const totalToDeduct = numericAmount + commission;
    
    try {
      const batch = writeBatch(firestore);
      const now = new Date().toISOString();

      batch.update(senderDocRef, { balance: increment(-totalToDeduct) });

      const recipientDocRef = doc(firestore, 'users', recipient.id);
      batch.update(recipientDocRef, { balance: increment(numericAmount) });

      const senderTransactionRef = doc(collection(firestore, 'users', user.uid, 'transactions'));
      batch.set(senderTransactionRef, {
        userId: user.uid,
        transactionDate: now,
        amount: totalToDeduct,
        transactionType: `تحويل إلى ${recipient.displayName}`,
        notes: `شامل عمولة خدمات ${commission} ريال`,
        recipientPhoneNumber: recipient.phoneNumber
      });

      const recipientTransactionRef = doc(collection(firestore, 'users', recipient.id, 'transactions'));
      batch.set(recipientTransactionRef, {
        userId: recipient.id,
        transactionDate: now,
        amount: numericAmount,
        transactionType: `استلام من ${senderProfile.displayName}`,
        notes: `من رقم: ${senderProfile.phoneNumber}`,
        recipientPhoneNumber: senderProfile.phoneNumber
      });

      await batch.commit();
      setShowSuccess(true);
    } catch (error: any) {
        toast({ variant: "destructive", title: "فشل العملية", description: "حدث خطأ غير متوقع أثناء التحويل." });
    } finally {
        setIsProcessing(false);
        setIsConfirming(false);
    }
  };

  const handleContactPick = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
        toast({ variant: "destructive", title: "غير مدعوم", description: "متصفحك لا يدعم الوصول لجهات الاتصال." });
        return;
    }
    try {
        const props = ['tel'];
        const opts = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, opts);
        if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
            let num = contacts[0].tel[0].replace(/[\s\-\(\)]/g, '').slice(-9);
            setRecipientPhone(num);
        }
    } catch (err) { console.error(err); }
  };
  
  if (showSuccess) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
        <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in-0">
            <Card className="w-full max-w-sm text-center shadow-2xl rounded-[48px] overflow-hidden border-none bg-card">
                <div className="bg-green-500 p-10 flex justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,white/20,transparent_70%)]" />
                    <div className="bg-white/20 p-5 rounded-full animate-bounce relative z-10">
                        <CheckCircle className="h-16 w-16 text-white" />
                    </div>
                </div>
                <CardContent className="p-8 space-y-6">
                    <div>
                        <h2 className="text-2xl font-black text-green-600">تم التحويل بنجاح</h2>
                        <p className="text-sm text-muted-foreground mt-1 font-bold">وصل المبلغ لحساب المشترك الآن</p>
                    </div>

                    <div className="w-full space-y-3 text-sm bg-muted/50 p-6 rounded-[32px] text-right border-2 border-dashed border-primary/10" dir="rtl">
                        <div className="flex justify-between items-center border-b border-muted pb-3">
                            <span className="text-muted-foreground flex items-center gap-2"><User className="w-4 h-4" /> المستلم:</span>
                            <span className="font-black text-foreground truncate max-w-[140px]">{recipient?.displayName}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-3">
                            <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> المبلغ الصافي:</span>
                            <span className="font-black text-primary text-lg">{Number(amount).toLocaleString('en-US')} ر.ي</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="font-black text-destructive">إجمالي المخصوم:</span>
                            <span className="font-black text-destructive text-base">{(Number(amount) + commission).toLocaleString('en-US')} ر.ي</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="rounded-2xl h-14 font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
                        <Button className="rounded-2xl h-14 font-black shadow-lg shadow-primary/20" onClick={() => {
                            setShowSuccess(false);
                            setRecipient(null);
                            setRecipientPhone('');
                            setAmount('');
                        }}>
                            تحويل جديد
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      {isSearching && <ProcessingOverlay message="جاري البحث عن العميل..." />}
      {isProcessing && <ProcessingOverlay message="جاري تنفيذ التحويل..." />}

      <SimpleHeader title="تحويل لمشترك" />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        
        <div className="bg-mesh-gradient pt-4 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-3">
                <div className="bg-white/20 p-3 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <ArrowLeftRight className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">نظام التحويل الفوري</h2>
                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-[0.2em]">أرسل الرصيد لأي مشترك بلمحة بصر</p>
                </div>
            </div>
        </div>

        <div className="px-4 space-y-8 pb-10">
            <Card className="overflow-hidden rounded-[32px] shadow-xl border-none bg-white dark:bg-slate-900 -mt-14 relative z-10 mx-2">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">رصيدك الحالي</p>
                        <div className="flex items-baseline gap-1" dir="rtl">
                            <h2 className="text-3xl font-black text-primary">
                                {isProfileLoading ? <Skeleton className="h-8 w-24 rounded-lg" /> : (senderProfile?.balance?.toLocaleString('en-US') || '0')}
                            </h2>
                            <span className="text-[10px] font-bold text-primary opacity-70 mr-1">ر.ي</span>
                        </div>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/5 shadow-inner">
                        <Wallet className="h-7 w-7 text-primary" />
                    </div>
                </CardContent>
            </Card>

            <div className="bg-white dark:bg-slate-900 rounded-[36px] p-6 shadow-sm border border-primary/5 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="recipientPhone" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم هاتف المستلم</Label>
                  <div className="relative group">
                    <Input
                      id="recipientPhone"
                      type="tel"
                      placeholder="7xxxxxxxx"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      disabled={isProcessing}
                      maxLength={9}
                      className="text-center font-black text-xl h-14 rounded-2xl bg-muted/20 border-none focus-visible:ring-primary transition-all pr-12 pl-12 shadow-inner"
                    />
                    <button 
                        onClick={handleContactPick}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                        title="جهات الاتصال"
                    >
                        <Users className="h-5 w-5" />
                    </button>
                    <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-30" />
                  </div>
                </div>
                
                {recipient && (
                    <div className="p-5 bg-primary/5 rounded-[28px] border border-primary/10 flex items-center gap-4 animate-in fade-in-0 zoom-in-95 duration-300" dir="rtl">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-primary/5">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">اسم المستلم المؤكد</p>
                            <p className="text-lg font-black text-foreground">{recipient.displayName}</p>
                            <p className="text-[9px] font-bold text-primary opacity-60">ID: {recipient.id.slice(-6)}</p>
                        </div>
                    </div>
                )}

                {recipient && (
                    <div className="animate-in fade-in-0 slide-in-from-top-2 duration-500 space-y-2">
                      <Label htmlFor="amount" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">المبلغ المراد تحويله</Label>
                      <div className="relative">
                        <Input
                            id="amount"
                            type="number"
                            inputMode='numeric'
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-primary placeholder:text-primary/10 focus-visible:ring-primary shadow-inner"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 font-black text-sm">ر.ي</div>
                      </div>
                    </div>
                )}

                <Button 
                    onClick={handleConfirmClick} 
                    className="w-full h-14 rounded-3xl text-lg font-black bg-mesh-gradient text-white shadow-xl shadow-primary/20 active:scale-95 transition-transform border-none" 
                    disabled={!recipient || !amount || isProcessing}
                >
                    <Send className="ml-2 h-5 w-5"/>
                    تنفيذ التحويل
                </Button>
            </div>

            <div className="bg-primary/5 p-5 rounded-[32px] border border-primary/5 flex items-start gap-4" dir="rtl">
                <div className="bg-primary/10 p-2 rounded-xl mt-0.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <div className="text-right space-y-1">
                    <h4 className="text-xs font-black text-primary uppercase tracking-tight">نظام العمولة الموحد</h4>
                    <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
                        يتم خصم عمولة ثابتة قدرها <span className="text-primary font-black">{commission} ريال</span> لكل عملية تحويل. يرجى التأكد من اسم المستلم قبل التأكيد.
                    </p>
                </div>
            </div>
        </div>
      </div>

      <Toaster />

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
          <AlertDialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-mesh-gradient p-8 text-center text-white relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
                  <AlertDialogHeader>
                      <AlertDialogTitle className="text-center font-black text-2xl text-white drop-shadow-md">تأكيد التحويل</AlertDialogTitle>
                  </AlertDialogHeader>
              </div>
              
              <div className="p-6 space-y-4">
                  <div className="bg-muted/50 rounded-[28px] p-6 space-y-4 text-sm text-right" dir="rtl">
                      <div className="flex justify-between items-center border-b border-dashed border-muted-foreground/20 pb-3">
                          <span className="text-muted-foreground font-bold">المبلغ المراد تحويله:</span>
                          <span className="font-black text-foreground">{Number(amount).toLocaleString('en-US')} ر.ي</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-dashed border-muted-foreground/20 pb-3">
                          <span className="text-muted-foreground font-bold">عمولة الخدمات:</span>
                          <span className="font-black text-foreground">{commission.toLocaleString('en-US')} ر.ي</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                          <span className="font-black text-primary text-base">إجمالي المخصوم:</span>
                          <div className="flex items-baseline gap-1" dir="rtl">
                            <span className="font-black text-primary text-2xl">{(Number(amount) + commission).toLocaleString('en-US')}</span>
                            <span className="text-[10px] font-bold text-primary">ر.ي</span>
                          </div>
                      </div>
                  </div>

                  <div className="text-center py-4 bg-primary/5 rounded-[24px] border border-primary/5">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">إلى المستلم</p>
                      <p className="font-black text-lg text-primary">{recipient?.displayName}</p>
                      <p className="text-xs font-bold text-muted-foreground">({recipient?.phoneNumber})</p>
                  </div>

                  <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                      <AlertDialogAction className="w-full rounded-2xl h-12 font-black shadow-lg" onClick={handleFinalConfirmation} disabled={isProcessing}>
                          {isProcessing ? 'جاري التحويل...' : 'تأكيد'}
                      </AlertDialogAction>
                      <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-bold" disabled={isProcessing}>تراجع</AlertDialogCancel>
                  </AlertDialogFooter>
              </div>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
