'use client';

import React, { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, increment, collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle, Copy, AlertCircle, Database, CreditCard, MessageSquare, Smartphone, Loader2, Wifi, Clock } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Separator } from '@/components/ui/separator';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type CardCategory = {
    id: string;
    name: string;
    price: number;
    capacity?: string;
    validity?: string;
};

type NetworkCard = {
    id: string;
    cardNumber: string;
    status: 'available' | 'sold';
    categoryId: string;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

type Network = {
    ownerId?: string;
    name: string;
};


function NetworkPurchasePageComponent() {
  const params = useParams();
  const networkId = params?.networkId as string;
  const searchParams = useSearchParams();
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const networkDocRef = useMemoFirebase(() => (firestore && networkId ? doc(firestore, 'networks', networkId) : null), [firestore, networkId]);
  const { data: networkData } = useDoc<Network>(networkDocRef);
  const networkName = networkData?.name || searchParams.get('name') || 'شراء كروت';

  const categoriesQuery = useMemoFirebase(() => (
    firestore && networkId ? collection(firestore, `networks/${networkId}/cardCategories`) : null
  ), [firestore, networkId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<CardCategory>(categoriesQuery);

  // ترتيب الكروت من الأقل سعراً إلى الأعلى سعراً
  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => a.price - b.price);
  }, [categories]);

  const [selectedCategory, setSelectedCategory] = useState<CardCategory | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<NetworkCard | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const handlePurchase = async () => {
    if (!selectedCategory || !user || !userProfile || !firestore || !userDocRef || !networkId || !networkData) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "معلومات الشراء غير مكتملة." });
      setIsConfirming(false);
      return;
    }
  
    setIsProcessing(true);
    const categoryPrice = selectedCategory.price;
    const userBalance = userProfile?.balance ?? 0;
  
    if (userBalance < categoryPrice) {
        toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "رصيدك الحالي لا يكفي لإتمام الشراء." });
        setIsProcessing(false);
        setIsConfirming(false);
        return;
    }
  
    try {
        const cardsRef = collection(firestore, `networks/${networkId}/cards`);
        const q = query(cardsRef, where('categoryId', '==', selectedCategory.id), where('status', '==', 'available'), firestoreLimit(1));
        const availableCardsSnapshot = await getDocs(q);
  
        if (availableCardsSnapshot.empty) {
            throw new Error('لا توجد كروت متاحة حالياً في هذه الفئة.');
        }
  
        const cardToPurchaseDoc = availableCardsSnapshot.docs[0];
        const cardToPurchaseData = { id: cardToPurchaseDoc.id, ...cardToPurchaseDoc.data() } as NetworkCard;
        
        const batch = writeBatch(firestore);
        const now = new Date().toISOString();
        const commission = Math.ceil(categoryPrice * 0.10);
        const payoutAmount = categoryPrice - commission;
        const ownerId = networkData.ownerId;
  
        // 1. تحديث حالة الكرت
        batch.update(cardToPurchaseDoc.ref, { 
            status: 'sold', 
            soldTo: user.uid, 
            soldTimestamp: now 
        });
        
        // 2. خصم الرصيد من المشتري
        batch.update(userDocRef, { balance: increment(-categoryPrice) });
        
        // 3. سجل عملية للمشتري
        const buyerTransactionRef = doc(collection(firestore, `users/${user.uid}/transactions`));
        batch.set(buyerTransactionRef, {
            userId: user.uid,
            transactionDate: now,
            amount: categoryPrice,
            transactionType: `شراء كرت ${selectedCategory.name}`,
            notes: `شبكة: ${networkName}`,
            cardNumber: cardToPurchaseData.cardNumber,
        });

        // 5. سجل الكروت المباعة (الحالة: انتظار للتحويل اليدوي من الإدارة)
        const soldCardRef = doc(collection(firestore, 'soldCards'));
        batch.set(soldCardRef, {
            networkId: networkId,
            ownerId: ownerId || 'admin',
            networkName: networkName,
            categoryId: selectedCategory.id,
            categoryName: selectedCategory.name,
            cardId: cardToPurchaseData.id,
            cardNumber: cardToPurchaseData.cardNumber,
            price: categoryPrice,
            commissionAmount: commission,
            payoutAmount: payoutAmount,
            buyerId: user.uid,
            buyerName: userProfile.displayName || 'مشترك',
            buyerPhoneNumber: userProfile.phoneNumber || '',
            soldTimestamp: now,
            payoutStatus: 'pending' // انتظار التحويل اليدوي من الإدارة
        });
        
        await batch.commit();

        setPurchasedCard(cardToPurchaseData);
        audioRef.current?.play().catch(() => {});

        // --- نظام الـ SMS التلقائي للعميل عبر الربط ---
        if (userProfile?.phoneNumber) {
            const currentBalance = (userBalance - categoryPrice).toLocaleString('en-US');
            const autoMsg = `${userProfile.displayName || 'عميلنا'} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${networkName}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${cardToPurchaseData.cardNumber}\n\n*رصيدك:* ${currentBalance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
            
            fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: userProfile.phoneNumber,
                    message: autoMsg
                })
            }).catch(e => console.error("Auto SMS API failed", e));
        }
  
    } catch (error: any) {
        console.error("Local network purchase failure:", error);
        toast({ variant: "destructive", title: "فشل الشراء", description: error.message || "حدث خطأ غير متوقع." });
    } finally {
        setIsProcessing(false);
        setIsConfirming(false);
    }
  };

  const handleCopyCardDetails = () => {
    if (purchasedCard) {
        navigator.clipboard.writeText(purchasedCard.cardNumber);
        toast({ title: "تم النسخ" });
    }
  };
  
  const handleSendSms = () => {
    if (!purchasedCard || !selectedCategory || !smsRecipient || !networkName) return;
    
    const name = userProfile?.displayName || 'عميلنا';
    const balance = (userProfile?.balance ?? 0).toLocaleString('en-US');
    
    const messageBody = `${name} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${networkName}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${purchasedCard.cardNumber}\n\n*رصيدك:* ${balance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
    
    // فتح تطبيق الرسائل في الجوال مباشرة
    window.location.href = `sms:${smsRecipient}?body=${encodeURIComponent(messageBody)}`;
    setIsSmsDialogOpen(false);
  };

  const renderContent = () => {
    if (isLoadingCategories) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
        );
    }

    if (!categories || categories.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center text-center h-64">
                <AlertCircle className="h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">لا توجد فئات كروت</h3>
                <p className="mt-1 text-sm text-muted-foreground">لم يتم إضافة أي فئات كروت بعد.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {sortedCategories.map((category, index) => (
                <Card key={category.id} className="overflow-hidden animate-in fade-in-0" style={{ animationDelay: `${index * 100}ms` }}>
                    <CardContent className="p-0 flex">
                        <div className="flex-none w-1/4 bg-accent/50 flex flex-col items-center justify-center p-4 text-accent-foreground">
                            <Database className="w-8 h-8 text-primary/80" />
                            {category.capacity && <span className="font-bold text-sm text-center text-primary/80 mt-2">{category.capacity}</span>}
                        </div>
                        <div className="flex-grow p-3">
                            <div className='flex items-start justify-between gap-2'>
                                <div className='space-y-1 text-right'>
                                    <h3 className="font-bold text-base">{category.name}</h3>
                                    <p className="font-semibold text-primary">{category.price.toLocaleString('en-US')} ريال</p>
                                </div>
                                <button 
                                    className="h-10 py-2 px-5 text-sm font-bold rounded-lg bg-primary text-white hover:bg-primary/90"
                                    onClick={() => {
                                        setSelectedCategory(category);
                                        setIsConfirming(true);
                                    }}
                                >
                                    شراء
                                </button>
                            </div>
                            <Separator className="my-2" />
                            <div className="text-xs text-muted-foreground flex items-center justify-start gap-x-4 gap-y-1">
                                {category.validity && <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> الصلاحية: {category.validity}</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  };
  
  return (
    <>
        <div className="flex flex-col h-full bg-background">
            <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
            <SimpleHeader title={networkName} />
            <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
        </div>
        <Toaster />

        <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
            {selectedCategory && (
                <AlertDialogContent className="rounded-3xl bg-white dark:bg-slate-900">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center">تأكيد عملية الشراء</AlertDialogTitle>
                        <AlertDialogDescription className="text-center pt-2">
                            هل أنت متأكد من رغبتك في شراء كرت "{selectedCategory.name}"؟ سيتم خصم <span className="font-bold text-primary">{selectedCategory.price.toLocaleString('en-US')} ريال</span> من رصيدك.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold" onClick={handlePurchase} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : 'تأكيد'}
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0" disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            )}
        </AlertDialog>

        {purchasedCard && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in-0">
                <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-background">
                    <div className="bg-green-500 p-8 flex justify-center"><CheckCircle className="h-16 w-16 text-white animate-bounce" /></div>
                    <CardContent className="p-8 space-y-6">
                        <div>
                            <h2 className="text-2xl font-black text-green-600">تم الشراء بنجاح!</h2>
                            <p className="text-3xl font-black font-mono mt-6 tracking-[0.2em] bg-muted py-4 rounded-2xl border-2 border-dashed border-primary/20">{purchasedCard.cardNumber}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Button className="rounded-2xl h-12 font-bold" onClick={handleCopyCardDetails}><Copy className="ml-2 h-4 w-4" /> نسخ</Button>
                            <Button variant="outline" className="rounded-2xl h-12 font-black" onClick={() => setIsSmsDialogOpen(true)}><MessageSquare className="ml-2 h-4 w-4" /> ارسال SMS</Button>
                        </div>
                        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { setPurchasedCard(null); router.push('/login'); }}>إغلاق</Button>
                    </CardContent>
                </Card>
            </div>
        )}

        <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
            <DialogContent className="rounded-[32px] max-sm p-6 z-[10000] bg-white dark:bg-slate-900">
                <DialogHeader>
                    <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"><Smartphone className="text-primary h-6 w-6" /></div>
                    <DialogTitle className="text-center text-xl font-black">ارسال كرت لزبون</DialogTitle>
                    <DialogDescription className="text-center">أدخل رقم جوال الزبون لفتح تطبيق الرسائل وإرسال بيانات الكرت.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-6">
                    <div className="space-y-2">
                        <Label htmlFor="sms-phone" className="text-sm font-bold text-muted-foreground pr-1">رقم جوال الزبون</Label>
                        <Input id="sms-phone" placeholder="7xxxxxxxx" type="tel" value={smsRecipient} onChange={e => setSmsRecipient(e.target.value.replace(/\D/g, '').slice(0, 9))} className="text-center text-2xl font-black h-14 rounded-2xl border-2 tracking-widest" />
                    </div>
                </div>
                <DialogFooter className="grid grid-cols-2 gap-3">
                    <Button onClick={handleSendSms} className="w-full h-12 rounded-2xl font-bold" disabled={!smsRecipient || smsRecipient.length < 9}>إرسال الآن</Button>
                    <Button variant="outline" className="w-full h-12 rounded-2xl font-bold mt-0" onClick={() => setIsSmsDialogOpen(false)}>إلغاء</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}


export default function NetworkCardsPage() {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <NetworkPurchasePageComponent />
      </Suspense>
    );
}
