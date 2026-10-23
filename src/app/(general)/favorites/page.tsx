'use client';

import React, { useState, useMemo, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, getDoc, writeBatch, increment, limit as firestoreLimit, updateDoc, onSnapshot } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wifi, 
  Heart, 
  Search, 
  CheckCircle, 
  Copy, 
  MessageSquare, 
  Smartphone, 
  Loader2, 
  Clock, 
  Database, 
  WifiOff
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { Label } from '@/components/ui/label';
import { useServicesConfig } from '@/hooks/use-services-config';
import { roundCurrency, isUserApiCustomer } from '@/lib/services-config';

export const dynamic = 'force-dynamic';

// --- TYPES ---
type Favorite = {
  id: string;
  userId: string;
  targetId: string;
  name: string;
  location: string;
  favoriteType: 'Network';
  isLocal?: boolean;
};

type CardCategory = {
    id: string | number;
    name: string;
    price: number;
    capacity?: string;
    validity?: string;
    expirationDate?: string;
};

type CombinedNetwork = {
    id: string;
    name: string;
    location: string;
    isLocal: boolean;
    ownerId?: string;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
  apiKey?: string;
  role?: string;
};

const CARD_GRADIENTS = [
    "from-blue-400 via-blue-500 to-blue-600",
    "from-emerald-400 via-emerald-500 to-emerald-600",
    "from-rose-400 via-rose-500 to-rose-600",
    "from-amber-400 via-amber-500 to-orange-600",
    "from-violet-400 via-violet-500 to-indigo-600",
    "from-fuchsia-400 via-fuchsia-500 to-pink-600",
    "from-teal-400 via-teal-500 to-cyan-600",
];

export default function FavoritesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline;
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedNetwork, setSelectedNetwork] = useState<CombinedNetwork | null>(null);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<any>(null);
  const [showConfirmPurchase, setShowConfirmPurchase] = useState<any | null>(null);
  const [delayedOrderPopupOpen, setDelayedOrderPopupOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const getFirstLast = (name?: string) => {
    if (!name) return 'عميلنا';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const favoritesQuery = useMemoFirebase(
    () => user && firestore ? query(collection(firestore, 'users', user.uid, 'favorites'), where('favoriteType', '==', 'Network')) : null,
    [firestore, user]
  );
  const { data: favorites, isLoading } = useCollection<Favorite>(favoritesQuery);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  const { config } = useServicesConfig();
  const isApiUser = isUserApiCustomer(userProfile);

  const getEffectiveCardPrice = (basePrice: number) => {
    if (!isApiUser) return basePrice;
    const rate = config.networks?.rate ?? 0.95;
    return roundCurrency(basePrice * rate);
  };

  const filteredFavorites = useMemo(() => {
    if (!favorites) return [];
    return favorites.filter(fav => 
      fav.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fav.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [favorites, searchTerm]);

  const handleRemoveFavorite = (e: React.MouseEvent, fav: Favorite) => {
    e.stopPropagation();
    if (!user || !firestore) return;
    const favDocRef = doc(firestore, 'users', user.uid, 'favorites', fav.id);
    deleteDocumentNonBlocking(favDocRef);
    toast({ title: "تمت الإزالة من المفضلة" });
  };

  const handleNetworkClick = async (fav: Favorite) => {
    setSelectedNetwork({ id: fav.targetId, name: fav.name, location: fav.location, isLocal: !!fav.isLocal });
    setCategoryError(null);
    setPurchasedCard(null);

    const catCacheKey = `star_cache_cats_${fav.targetId}`;
    const cachedCats = localStorage.getItem(catCacheKey);
    let hasValidCache = false;

    if (cachedCats) {
      try {
        const parsed = JSON.parse(cachedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          setIsLoadingCategories(false);
          hasValidCache = true;
        }
      } catch (e) {
        setCategories([]);
      }
    }

    if (isOffline) {
      if (!hasValidCache) {
        setCategories([]);
        setIsLoadingCategories(false);
        setCategoryError('uncached_offline');
      }
      return;
    }

    if (!hasValidCache) {
      setIsLoadingCategories(true);
    }

    try {
      if (fav.isLocal && firestore) {
        const catsRef = collection(firestore, `networks/${fav.targetId}/cardCategories`);
        const snapshot = await getDocs(catsRef);
        const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
        setCategories(catsData);
        localStorage.setItem(catCacheKey, JSON.stringify(catsData));
      } else {
        const response = await fetch(`/services/networks-api/${fav.targetId}/classes`);
        if (!response.ok) throw new Error('فشل تحميل الفئات من المصدر');
        const data = await response.json();
        const mapped = data.map((c: any) => ({ 
          id: c.id, 
          name: c.name, 
          price: c.price, 
          capacity: c.dataLimit, 
          validity: c.expirationDate 
        }));
        setCategories(mapped);
        localStorage.setItem(catCacheKey, JSON.stringify(mapped));
      }
    } catch (err: any) {
      console.error(err);
      if (categories.length === 0) {
        setCategoryError(err.message || 'لا يمكن تحميل الفئات حالياً.');
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handlePurchase = async () => {
    const selectedCategory = showConfirmPurchase;
    if (!selectedCategory || !selectedNetwork) return;

    const categoryPrice = selectedCategory.price;
    const effectivePrice = getEffectiveCardPrice(categoryPrice);

    // في وضع عدم الاتصال بالإنترنت: فتح تطبيق الرسائل للرقم 770326828 بكود مختصر جداً
    if (isOffline) {
      const adminPhone = '770326828';
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      const smsBody = `#STAR:${selectedNetwork.id}:${selectedCategory.id}:${effectivePrice}#`;

      const smsUrl = isIOS
        ? `sms:${adminPhone}&body=${encodeURIComponent(smsBody)}`
        : `sms:${adminPhone}?body=${encodeURIComponent(smsBody)}`;

      setShowConfirmPurchase(null);
      toast({
        title: "جارٍ فتح تطبيق الرسائل...",
        description: `سيتم إرسال كود الطلب السريع للرقم ${adminPhone} لخصم المبلغ وتزويدك برقم الكرت فوراً.`,
        duration: 5000,
      });

      window.location.href = smsUrl;
      return;
    }

    if (!user || !userProfile || !firestore || !userDocRef) return;

    setIsProcessing(true);
    const userBalance = userProfile?.balance ?? 0;

    if (userBalance < effectivePrice) {
        toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "رصيدك الحالي لا يكفي لإتمام عملية الشراء." });
        setIsProcessing(false);
        return;
    }

    let localBalanceDeducted = false;
    try {
        const now = new Date().toISOString();
        let finalCardID = '';

        if (selectedNetwork.isLocal) {
            // 1. شبكة محلية: خصم المبلغ فوراً لحمايته في حال انقطاع النت
            await updateDoc(userDocRef, { balance: increment(-effectivePrice) });
            localBalanceDeducted = true;

            const cardsRef = collection(firestore, `networks/${selectedNetwork.id}/cards`);
            const q = query(cardsRef, where('categoryId', '==', selectedCategory.id), where('status', '==', 'available'), firestoreLimit(1));
            const availableCardsSnapshot = await getDocs(q);

            if (availableCardsSnapshot.empty) {
                await updateDoc(userDocRef, { balance: increment(effectivePrice) });
                localBalanceDeducted = false;
                throw new Error('نعتذر، لا توجد كروت متاحة حالياً في هذه الفئة.');
            }
            
            const cardToPurchaseDoc = availableCardsSnapshot.docs[0];
            const cardData = cardToPurchaseDoc.data();
            finalCardID = cardData.cardNumber;

            // حساب عمولة المنصة 10%
            const netSnap = await getDoc(doc(firestore, 'networks', selectedNetwork.id));
            const ownerId = netSnap.exists() ? netSnap.data()?.ownerId : null;
            const commission = Math.ceil(categoryPrice * 0.10);
            const payoutAmount = categoryPrice - commission;

            const batch = writeBatch(firestore);
            batch.update(cardToPurchaseDoc.ref, { status: 'sold', soldTo: user.uid, soldTimestamp: now });
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, 
                transactionDate: now, 
                amount: effectivePrice,
                transactionType: `شراء كرت ${selectedCategory.name}`, 
                notes: `شبكة: ${selectedNetwork.name}`,
                cardNumber: cardData.cardNumber,
                status: 'completed',
            });

            const soldCardRef = doc(collection(firestore, 'soldCards'));
            batch.set(soldCardRef, {
                networkId: selectedNetwork.id,
                ownerId: ownerId,
                networkName: selectedNetwork.name,
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                cardId: cardToPurchaseDoc.id,
                cardNumber: cardData.cardNumber,
                price: selectedCategory.price,
                commissionAmount: commission,
                payoutAmount: payoutAmount,
                buyerId: user.uid,
                buyerName: userProfile.displayName || 'مشترك',
                buyerPhoneNumber: userProfile.phoneNumber || '',
                soldTimestamp: now,
                payoutStatus: 'completed'
            });

            // تحويل أرباح الكرت تلقائياً لمالك الشبكة بعد خصم 10%
            if (ownerId && ownerId !== 'admin') {
                const ownerRef = doc(firestore, 'users', ownerId);
                batch.update(ownerRef, { balance: increment(payoutAmount) });

                const ownerTxRef = doc(collection(firestore, `users/${ownerId}/transactions`));
                batch.set(ownerTxRef, {
                    userId: ownerId,
                    transactionDate: now,
                    amount: payoutAmount,
                    transactionType: 'أرباح مبيعات الكروت',
                    notes: `أرباح كرت ${selectedCategory.name} - شبكة: ${selectedNetwork.name} (صافي بعد خصم 10% عمولة)`
                });
            }

            await batch.commit();
            setPurchasedCard({ cardID: cardData.cardNumber });
            setShowConfirmPurchase(null);
            setSelectedNetwork(null);
            audioRef.current?.play().catch(() => {});
        } else {
            // 2. شبكة خارجية (بيتي): خصم المبلغ فوراً والاستماع للرد المباشر حتى 50 ثانية
            const externalRef = `SM-BN-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
            const txRef = doc(collection(firestore, `users/${user.uid}/transactions`));
            const baityOrderRef = doc(firestore, 'baityOrders', externalRef);

            const initBatch = writeBatch(firestore);
            initBatch.update(userDocRef, { balance: increment(-effectivePrice) });
            initBatch.set(txRef, {
                id: txRef.id,
                userId: user.uid,
                transactionDate: now,
                amount: effectivePrice,
                transactionType: `شراء كرت ${selectedCategory.name}`,
                notes: `شبكة: ${selectedNetwork.name}`,
                status: 'pending',
                readiness: 'قيد الانتظار',
                externalRef: externalRef,
                networkName: selectedNetwork.name,
                className: selectedCategory.name,
                classId: selectedCategory.id,
            });
            initBatch.set(baityOrderRef, {
                externalRef: externalRef,
                userId: user.uid,
                transactionId: txRef.id,
                classId: selectedCategory.id,
                className: selectedCategory.name,
                networkName: selectedNetwork.name,
                networkId: String(selectedNetwork.id),
                price: effectivePrice,
                status: 'pending',
                phoneNumber: userProfile?.phoneNumber || '',
                displayName: userProfile?.displayName || '',
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
                    refundBatch.update(userDocRef, { balance: increment(effectivePrice) });
                    refundBatch.update(txRef, {
                        status: 'failed',
                        readiness: 'فاشلة',
                        notes: `شبكة: ${selectedNetwork.name} (فشل الشراء)`,
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

                setShowConfirmPurchase(null);
                setSelectedNetwork(null);
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

                finalCardID = cardData.cardID;

                try {
                    const finishBatch = writeBatch(firestore);
                    const transactionPayload: any = {
                        status: 'completed',
                        readiness: 'جاهزة',
                        cardNumber: cardData.cardID,
                        completedAt: new Date().toISOString()
                    };
                    if (cardData.cardPass && cardData.cardPass !== cardData.cardID) {
                        transactionPayload.cardPassword = cardData.cardPass;
                    }
                    finishBatch.update(txRef, transactionPayload);
                    finishBatch.update(baityOrderRef, {
                        status: 'completed',
                        cardNumber: cardData.cardID,
                        cardPass: cardData.cardPass || '',
                        uuidOrder: uuidOrder || '',
                        completedAt: new Date().toISOString()
                    });
                    await finishBatch.commit().catch(() => {});
                } catch (e) {
                    console.error("Update success error:", e);
                }

                setPurchasedCard(cardData);
                setShowConfirmPurchase(null);
                setSelectedNetwork(null);
                setIsProcessing(false);
                audioRef.current?.play().catch(() => {});

                // إرسال SMS بالصيغة الملكية
                if (userProfile?.phoneNumber) {
                    const shortName = getFirstLast(userProfile.displayName);
                    const smsMsg = `ستار موبايل\nمرحباً ${shortName}،\n\nتم شراء كرت الإنترنت الخاص بك بنجاح.\n\nالشبكة: ${selectedNetwork.name}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${cardData.cardID}`;
                    fetch('/api/sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phoneNumber: userProfile.phoneNumber.trim(),
                            message: smsMsg
                        })
                    }).catch(e => console.error("SMS Notify Error", e));
                }
            };

            // ننتظر الرد المباشر أو استجابة الويب هوك أو انقضاء مهلة الـ 50 ثانية
            await new Promise<void>((resolve) => {
                // 1) مؤقت 50 ثانية: إذا تأخر الرد تظهر المنبثقة للعميل
                timeoutId = setTimeout(() => {
                    if (!isHandled) {
                        isHandled = true;
                        if (unsubscribe) unsubscribe();
                        setShowConfirmPurchase(null);
                        setSelectedNetwork(null);
                        setIsProcessing(false);
                        setDelayedOrderPopupOpen(true);
                        resolve();
                    }
                }, 50000);

                // 2) الاستماع اللحظي للويب هوك في حال رد المزود خلال الثواني الأولى
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
                        classId: selectedCategory.id,
                        externalRef: externalRef 
                    })
                })
                .then(async (response) => {
                    const result = await response.json().catch(() => ({}));
                    if (isHandled) return;

                    if (response.ok && result?.status === 200 && result?.data?.order?.card?.cardID) {
                        // أ) نجاح فوري واستلام الكرت
                        handleOrderSuccess(result.data.order.card, result.data.order.uuidOrder);
                        resolve();
                    } else if (response.ok && result?.status === 200 && result?.data?.order?.uuidOrder && !result?.data?.order?.card) {
                        // ب) الطلب قيد الانتظار الفعلي لدى المزود - لا نظهر رسالة استلام بل نستمر بالانتظار حتى الويب هوك أو 50 ثانية
                    } else {
                        // ج) فشل الشراء مباشرة من المزود (مثل عدم كفاية رصيد الأدمن أو نفاد المخزون)
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
        }

        // إرسال SMS بالصيغة الملكية إذا تم استلام الكرت فوراً للشبكة المحلية
        if (finalCardID && userProfile?.phoneNumber && selectedNetwork.isLocal) {
            const shortName = getFirstLast(userProfile.displayName);
            const smsMsg = `ستار موبايل\nمرحباً ${shortName}،\n\nتم شراء كرت الإنترنت الخاص بك بنجاح.\n\nالشبكة: ${selectedNetwork.name}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${finalCardID}`;
            fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: userProfile.phoneNumber.trim(), message: smsMsg }) }).catch(() => {});
        }
    } catch (error: any) {
        console.error("Purchase execution error:", error);
        if (localBalanceDeducted && userDocRef) {
            try {
                await updateDoc(userDocRef, { balance: increment(effectivePrice) });
            } catch (refErr) {
                console.error("Refund failed:", refErr);
            }
        }
        setShowConfirmPurchase(null);
        setSelectedNetwork(null);
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
        const textToCopy = purchasedCard.cardID || purchasedCard.cardNumber;
        navigator.clipboard.writeText(textToCopy);
        toast({ title: "تم النسخ" });
    }
  };

  const handleSendSms = () => {
    if (!purchasedCard || !selectedNetwork || !smsRecipient) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى إدخال رقم الزبون.' });
        return;
    }
    const name = userProfile?.displayName || 'عميلنا';
    const balance = (userProfile?.balance ?? 0).toLocaleString('en-US');
    const cardInfo = purchasedCard.cardID || purchasedCard.cardNumber;

    const msg = `${name} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${selectedNetwork.name}\nالفئة: ${selectedNetwork.name}\nرقم الكرت: ${cardInfo}\n\n*رصيدك:* ${balance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
    
    window.location.href = `sms:${smsRecipient}?body=${encodeURIComponent(msg)}`;
    setIsSmsDialogOpen(false);
  };

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    if (selectedNetwork?.isLocal) {
        return [...categories].sort((a, b) => a.price - b.price);
    }
    return categories;
  }, [categories, selectedNetwork]);

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <SimpleHeader title="المفضلة" />
        
        <div className="p-4">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    type="text" 
                    placeholder="البحث في المفضلة..." 
                    className="w-full pr-10 rounded-xl h-12 bg-muted/20 border-2 border-black/10 focus-visible:ring-primary shadow-sm" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4">
            {isLoading ? (
                <div className="flex justify-center py-20"><ProcessingOverlay /></div>
            ) : filteredFavorites.length === 0 ? (
                <div className="text-center py-20 opacity-40">
                    <Heart className="h-16 w-16 mx-auto mb-4" />
                    <p className="font-bold">لا توجد شبكات في المفضلة حالياً</p>
                </div>
            ) : (
                filteredFavorites.map((fav, index) => (
                    <Card 
                        key={fav.id} 
                        className="bg-mesh-gradient cursor-pointer text-white rounded-2xl border-none shadow-md overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handleNetworkClick(fav)}
                    >
                        <CardContent className="p-4 flex items-center justify-between gap-2">
                            <div className="p-3 bg-white/20 rounded-xl shrink-0 backdrop-blur-sm border border-white/10 w-12 h-12 flex items-center justify-center overflow-hidden">
                                <Wifi className="h-6 w-6 text-white" />
                            </div>
                            
                            <div className="flex-1 text-right mx-2 space-y-0.5 overflow-hidden">
                                <h4 className="font-black text-base text-white truncate">{fav.name}</h4>
                                <p className="text-[10px] text-white/70 font-bold truncate opacity-80">{fav.location}</p>
                            </div>
                            
                            <button 
                                onClick={(e) => handleRemoveFavorite(e, fav)} 
                                className="p-2.5 hover:scale-110 transition-transform bg-white/10 rounded-full shrink-0"
                                title="إزالة من المفضلة"
                            >
                                <Heart className="h-5 w-5 text-white fill-white" />
                            </button>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
      </div>

      {/* Dialog for Categories - Identical to Services Page */}
      <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && !isProcessing && setSelectedNetwork(null)}>
        <DialogContent className="max-w-[95%] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden bg-white dark:bg-slate-950">
          {selectedNetwork && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="bg-mesh-gradient p-0 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                
                <DialogHeader className="pt-12 pb-8 px-8 text-white text-center relative z-10">
                    <DialogTitle className="sr-only">{selectedNetwork?.name || 'تفاصيل الشبكة'}</DialogTitle>
                    <DialogDescription className="sr-only">استعراض فئات الكروت المتاحة للشبكة المختارة</DialogDescription>
                    <div className="bg-white/20 p-3 rounded-2xl w-14 h-14 mx-auto mb-3 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl overflow-hidden">
                        <Wifi className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-white drop-shadow-md">{selectedNetwork.name}</h2>
                    <p className="text-[10px] text-white/70 font-bold mt-1 bg-white/10 py-1 px-3 rounded-full border border-white/5 inline-block">{selectedNetwork.location}</p>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900">
                {(isLoadingCategories && categories.length === 0) ? (
                  <div className="flex justify-center py-10"><ProcessingOverlay /></div>
                ) : categoryError === 'uncached_offline' ? (
                  <div className="text-center p-6 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-[28px] space-y-3 my-4">
                    <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                      <WifiOff className="w-7 h-7 animate-pulse" />
                    </div>
                    <h3 className="text-base font-black text-foreground">الفئات غير محملة مسبقاً</h3>
                    <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                      عزيزي العميل، لم يتم تحميل فئات هذه الشبكة مسبقاً في هاتفك أثناء اتصالك بالإنترنت.
                      <br className="my-1" />
                      يرجى الاتصال بالإنترنت وفتح هذه الشبكة مرة واحدة فقط ليتم حفظ فئاتها تلقائياً، وبعدها ستفتح معك وتعمل بدون إنترنت دائماً!
                    </p>
                  </div>
                ) : categoryError ? (
                  <p className="text-center text-destructive font-bold p-4 bg-destructive/10 rounded-2xl">{categoryError}</p>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-bold">لا توجد فئات متاحة حالياً لهذه الشبكة.</div>
                ) : (
                  <div className="space-y-3">
                    {sortedCategories.map((cat, idx) => {
                        const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                        return (
                            <div key={cat.id} className="animate-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 100}ms` }}>
                                <Card 
                                    className={cn(
                                        "relative overflow-hidden rounded-[28px] border-none shadow-xl transition-all duration-300 group cursor-pointer active:scale-[0.97]",
                                        "bg-gradient-to-br p-[2px]",
                                        gradient
                                    )}
                                    onClick={() => setShowConfirmPurchase(cat)}
                                >
                                    <div className="relative rounded-[26px] p-3.5 flex items-center justify-between gap-4 h-full transition-colors bg-white/95 dark:bg-slate-900/95 hover:bg-primary/[0.02]">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-11 w-11 rounded-[18px] flex items-center justify-center shrink-0 shadow-lg bg-gradient-to-br text-white overflow-hidden",
                                                gradient
                                            )}>
                                                <Wifi className="h-5 w-5" />
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <h4 className="text-xs font-black text-foreground group-hover:text-primary transition-colors">{cat.name}</h4>
                                                <div className="flex gap-2.5 mt-1">
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-primary">
                                                        <Database className="h-2.5 w-2.5" />
                                                        <span>{cat.capacity || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
                                                        <Clock className="h-2.5 w-2.5" />
                                                        <span>{cat.validity || cat.expirationDate || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5">
                                            {(() => {
                                                const finalPrice = getEffectiveCardPrice(cat.price);
                                                return (
                                                    <div className="flex flex-col items-end leading-tight">
                                                        <span className="text-xl font-black tracking-tighter text-primary">{finalPrice.toLocaleString('en-US')}</span>
                                                    </div>
                                                );
                                            })()}
                                            <Button size="sm" className="h-7 rounded-lg text-[9px] font-black px-4 bg-primary shadow-md shadow-primary/20">شراء</Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-white dark:bg-slate-900"><Button variant="outline" className="w-full h-11 rounded-2xl font-black text-sm" onClick={() => setSelectedNetwork(null)}>إغلاق</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!showConfirmPurchase} onOpenChange={(open) => !open && setShowConfirmPurchase(null)}>
        <DialogContent className="rounded-[32px] max-sm text-center bg-white dark:bg-slate-900 z-[10000] border-none shadow-2xl outline-none">
          <DialogHeader>
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
              isOffline ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"
            )}>
                {isOffline ? <MessageSquare className="h-9 w-9 text-amber-600 animate-pulse" /> : <CheckCircle className="h-10 w-10 text-primary" />}
            </div>
            <DialogTitle className="text-center font-black text-xl">
              {isOffline ? 'طلب كرت بدون إنترنت (SMS)' : 'تأكيد عملية الشراء'}
            </DialogTitle>
            <DialogDescription className="text-center font-bold">
              {isOffline ? (
                <>
                  سيتم فتح تطبيق الرسائل لإرسال طلب شراء كرت <span className="text-primary font-black">"{showConfirmPurchase?.name}"</span> إلى الإدارة (<span className="font-mono text-foreground font-black">770326828</span>) وسيتم خصم المبلغ من رصيدك وتزويدك برقم الكرت فوراً.
                </>
              ) : (
                <>هل أنت متأكد من شراء كرت <span className="text-primary">"{showConfirmPurchase?.name}"</span>؟</>
              )}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const finalPrice = showConfirmPurchase ? getEffectiveCardPrice(showConfirmPurchase.price) : 0;
            return (
              <div className="py-6 bg-muted/30 rounded-[28px] border-2 border-dashed border-primary/10 space-y-2 mt-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  {isOffline ? 'المبلغ المطلوب خصمه من رصيدك' : 'سيتم خصم المبلغ من رصيدك'}
                </p>
                <p className="text-3xl font-black text-primary">{finalPrice.toLocaleString('en-US')} <span className="text-sm">ريال</span></p>
              </div>
            );
          })()}
          <DialogFooter className="grid grid-cols-2 gap-3 mt-6">
            <Button 
              className={cn(
                "w-full h-12 rounded-2xl font-black text-base shadow-lg",
                isOffline ? "bg-[#0048ad] hover:bg-[#003887] text-white gap-2 shadow-[#0048ad]/20" : "shadow-primary/20"
              )} 
              onClick={handlePurchase} 
              disabled={isProcessing}
            >
                {isProcessing ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : isOffline ? (
                  <>
                    <MessageSquare className="h-5 w-5" />
                    <span>إرسال الطلب (SMS)</span>
                  </>
                ) : (
                  'تأكيد الشراء'
                )}
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-2xl font-black text-base mt-0" onClick={() => setShowConfirmPurchase(null)}>تراجع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Card Dialog - Identical to Services Page */}
      {purchasedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 animate-in fade-in-0">
            <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-background">
                <CardContent className="p-8 space-y-6">
                    <div className="bg-green-500 p-8 flex justify-center mb-4 rounded-t-[40px] -m-8">
                        <div className="bg-white/20 p-4 rounded-full animate-bounce">
                            <CheckCircle className="h-16 w-16 text-white" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-green-600 mt-4">تم الشراء بنجاح!</h2>
                        <p className="text-sm text-muted-foreground mt-1">احتفظ برقم الكرت جيداً</p>
                    </div>
                    
                    <div className="p-6 bg-muted rounded-[24px] border-2 border-dashed border-primary/20 space-y-3">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">رقم الكرت</p>
                        <p className="text-3xl font-black font-mono tracking-tighter text-foreground">
                            {purchasedCard.cardID || purchasedCard.cardNumber}
                        </p>
                        {purchasedCard.cardPass && purchasedCard.cardPass !== (purchasedCard.cardID || purchasedCard.cardNumber) && (
                            <div className="mt-2 pt-2 border-t border-dashed border-primary/10">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">كلمة المرور</p>
                                <p className="text-xl font-black font-mono text-foreground">{purchasedCard.cardPass}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Button className="rounded-2xl h-12 font-bold" onClick={handleCopy}>
                            <Copy className="ml-2 h-4 w-4" /> نسخ الكرت
                        </Button>
                        <Button variant="outline" className="rounded-2xl h-12 font-black" onClick={() => setIsSmsDialogOpen(true)}>
                            <MessageSquare className="ml-2 h-4 w-4" /> ارسال SMS
                        </Button>
                    </div>
                    <Button variant="ghost" className="w-full text-muted-foreground font-bold" onClick={() => { setPurchasedCard(null); setSelectedNetwork(null); }}>إغلاق</Button>
                </CardContent>
            </Card>
        </div>
      )}

      {/* SMS To Customer Dialog */}
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
                        placeholder="73xxxxxxx" 
                        type="tel" 
                        value={smsRecipient} 
                        onChange={e => setSmsRecipient(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                        className="text-center text-2xl font-black h-14 rounded-2xl border-2 focus-visible:ring-primary tracking-widest text-foreground bg-muted/20 border-none" 
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
      <Toaster />
    </>
  );
}
