'use client';

import React, { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, writeBatch, increment, collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle, Copy, AlertCircle, Database, MessageSquare, Smartphone } from 'lucide-react';
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

type CardCategory = {
    id: number;
    name: string;
    price: number;
    dataLimit?: string;
    expirationDate?: string;
    count?: number;
};

type NetworkCard = {
    cardID: string;
    cardPass: string;
};

type OrderResponse = {
    data: {
        order: {
            uuidOrder: string;
            card: NetworkCard;
        }
    }
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

function NetworkPurchasePageComponent() {
  const params = useParams();
  const networkId = params.networkId as string;
  const searchParams = useSearchParams();
  const networkName = searchParams.get('name') || 'شراء كروت';
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<CardCategory | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<NetworkCard | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchCategories = async () => {
        if (!networkId) return;
        setIsLoadingCategories(true);
        setError(null);
        try {
            const response = await fetch(`/services/networks-api/${networkId}/classes`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch categories');
            }
            const data = await response.json();
            setCategories(data);
        } catch (err: any) {
            setError(err.message || 'لا يمكن تحميل الفئات حالياً.');
            console.error(err);
        } finally {
            setIsLoadingCategories(false);
        }
    };
    fetchCategories();
  }, [networkId]);


  const userDocRef = useMemo(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  
  useEffect(() => {
    if (purchasedCard) {
        audioRef.current?.play().catch(e => console.error("Audio playback failed:", e));
    }
  }, [purchasedCard]);

  const handlePurchase = async () => {
    if (!selectedCategory || !user || !userProfile || !firestore || !userDocRef) return;

    setIsProcessing(true);
    const categoryPrice = selectedCategory.price;
    const userBalance = userProfile?.balance ?? 0;

    if (userBalance < categoryPrice) {
        toast({
            variant: "destructive",
            title: "رصيد غير كافٍ",
            description: "رصيدك الحالي لا يكفي لإتمام عملية الشراء.",
        });
        setIsProcessing(false);
        setIsConfirming(false);
        return;
    }

    try {
        const response = await fetch(`/services/networks-api/order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                classId: selectedCategory.id,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData?.error?.message?.ar || errorData?.message || 'فشل إنشاء الطلب.');
        }

        const result: OrderResponse = await response.json();
        const cardData = result.data.order.card;
        
        const batch = writeBatch(firestore);
        const now = new Date().toISOString();

        batch.update(userDocRef!, { balance: increment(-categoryPrice) });

        const buyerTransactionRef = doc(collection(firestore, `users/${user.uid}/transactions`));
        const transactionPayload: any = {
            userId: user.uid,
            transactionDate: now,
            amount: categoryPrice,
            transactionType: `شراء كرت ${selectedCategory.name}`,
            notes: `شبكة: ${networkName}`,
            cardNumber: cardData.cardID,
        };

        if (cardData.cardPass && cardData.cardPass !== cardData.cardID) {
            transactionPayload.cardPassword = cardData.cardPass;
        }
        
        batch.set(buyerTransactionRef, transactionPayload);
        await batch.commit();
        setPurchasedCard(cardData);

        // --- نظام الـ SMS التلقائي للعميل عبر الربط ---
        if (userProfile?.phoneNumber) {
            const currentBalance = (userBalance - categoryPrice).toLocaleString('en-US');
            const autoMsg = `${userProfile.displayName || 'عميلنا'} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${networkName}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${cardData.cardID}\n\n*رصيدك:* ${currentBalance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
            
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
        console.error("Purchase failed:", error);
        toast({
            variant: "destructive",
            title: "فشلت عملية الشراء",
            description: error.message || "حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.",
        });
    } finally {
        setIsProcessing(false);
        setIsConfirming(false);
    }
  };

  const handleCopyCardDetails = () => {
    if (purchasedCard) {
        navigator.clipboard.writeText(purchasedCard.cardID);
        toast({
            title: "تم النسخ",
            description: "تم نسخ رقم الكرت بنجاح.",
        });
    }
  };
  
  const handleSendSms = () => {
    if (!purchasedCard || !selectedCategory || !smsRecipient || !networkName) return;

    const name = userProfile?.displayName || 'عميلنا';
    const balance = (userProfile?.balance ?? 0).toLocaleString('en-US');

    const messageBody = `${name} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${networkName}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${purchasedCard.cardID}\n\n*رصيدك:* ${balance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
    
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

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center text-center h-64">
                <AlertCircle className="h-16 w-16 text-destructive" />
                <h3 className="mt-4 text-lg font-semibold">حدث خطأ</h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (!categories || categories.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center text-center h-64">
                <AlertCircle className="h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">لا توجد فئات كروت</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    لم يتم العثور على فئات لهذه الشبكة.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {categories.map((category, index) => {
                return (
                    <Card key={category.id} className="overflow-hidden animate-in fade-in-0" style={{ animationDelay: `${index * 100}ms` }}>
                        <CardContent className="p-0 flex">
                            <div className="flex-none w-1/4 bg-accent/50 flex flex-col items-center justify-center p-4 text-accent-foreground">
                            <Database className="w-8 h-8 text-primary/80" />
                            {category.dataLimit && (
                                    <span className="font-bold text-sm text-center text-primary/80 mt-2">{category.dataLimit}</span>
                            )}
                            </div>
                            <div className="flex-grow p-3">
                                <div className='flex items-start justify-between gap-2'>
                                    <div className='space-y-1 text-right'>
                                        <h3 className="font-bold text-base">{category.name}</h3>
                                        <p className="font-semibold text-primary dark:text-primary-foreground">{category.price.toLocaleString('en-US')} ريال</p>
                                    </div>
                                    <Button 
                                        size="default" 
                                        className="h-auto py-2 px-5 text-sm font-bold rounded-lg"
                                        onClick={() => {
                                            setSelectedCategory(category);
                                            setIsConfirming(true);
                                        }}
                                    >
                                        شراء
                                    </Button>
                                </div>
                                <Separator className="my-2" />
                                <div className="text-xs text-muted-foreground flex items-center justify-start gap-x-4 gap-y-1">
                                    {category.expirationDate && <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> الصلاحية: {category.expirationDate}</span>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
  };
  
  if (isProcessing) {
    return <ProcessingOverlay message="جاري تجهيز طلبك..." />;
  }

  if (purchasedCard) {
    return (
      <>
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in-0 p-4">
            <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] border-none bg-card">
                <CardContent className="p-8">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <div className="bg-green-500 p-6 rounded-full animate-bounce">
                            <CheckCircle className="h-16 w-16 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-green-600">تم الشراء بنجاح</h2>
                        <p className="text-sm text-muted-foreground">هذا هو رقم الكرت الخاص بك.</p>
                        
                        <div className="w-full text-center space-y-2 bg-muted p-6 rounded-3xl border-2 border-dashed border-primary/20 font-mono text-3xl font-black tracking-widest">
                           <p>{purchasedCard.cardID}</p>
                        </div>
                        
                         <div className="w-full grid grid-cols-2 gap-3 pt-2">
                             <Button className="w-full h-12 rounded-2xl font-bold" onClick={handleCopyCardDetails}>
                                 <Copy className="ml-2 h-4 w-4" />
                                 نسخ
                             </Button>
                             <Button variant="outline" className="w-full h-12 rounded-2xl font-black" onClick={() => setIsSmsDialogOpen(true)}>
                                <MessageSquare className="ml-2 h-4 w-4" />
                                ارسال SMS
                            </Button>
                         </div>

                        <div className="w-full pt-4">
                            <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => {
                                setPurchasedCard(null);
                                router.push('/login');
                            }}>إغلاق</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
        <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
            <DialogContent className="rounded-[32px] max-w-sm p-6 z-[10000] border-none shadow-2xl">
                <DialogHeader>
                    <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Smartphone className="text-primary h-6 w-6" />
                    </div>
                    <DialogTitle className="text-center text-xl font-black">إرسال كرت لزبون</DialogTitle>
                    <DialogDescription className="text-center">
                        أدخل رقم جوال الزبون لفتح تطبيق الرسائل وإرسال بيانات الكرت.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6">
                    <div className="space-y-2">
                        <Label htmlFor="sms-phone" className="text-sm font-bold text-muted-foreground pr-1">رقم جوال الزبون</Label>
                        <Input 
                            id="sms-phone"
                            placeholder="7xxxxxxxx" 
                            type="tel" 
                            value={smsRecipient} 
                            onChange={e => setSmsRecipient(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                            className="text-center text-2xl font-black h-14 rounded-2xl border-2 focus-visible:ring-primary tracking-widest bg-muted/20" 
                        />
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

  return (
    <>
        <div className="flex flex-col h-full bg-background">
            <SimpleHeader title={networkName} />
            <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
        </div>
        <Toaster />

        <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
            {selectedCategory && (
                <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center font-black">تأكيد عملية الشراء</AlertDialogTitle>
                        <AlertDialogDescription className="text-center pt-2">
                            هل أنت متأكد من رغبتك في شراء كرت "{selectedCategory.name}"؟ سيتم خصم <span className="font-bold text-primary dark:text-primary-foreground">{selectedCategory.price.toLocaleString('en-US')} ريال</span> من رصيدك.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                        <AlertDialogAction className="w-full rounded-2xl h-12 font-bold" onClick={handlePurchase} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : 'تأكيد'}
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0" disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            )}
        </AlertDialog>
    </>
  );
}


export default function NetworkPurchasePage() {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <NetworkPurchasePageComponent />
      </Suspense>
    );
}
