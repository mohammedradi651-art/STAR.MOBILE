'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, deleteDocumentNonBlocking, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, getDocs, writeBatch, increment, limit as firestoreLimit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, MapPin, Heart, Search, X, AlertCircle, Database, Calendar, CheckCircle, Copy, MessageSquare, Wallet, Smartphone, Loader2, Clock } from 'lucide-react';
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
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Favorite = {
  id: string;
  userId: string;
  targetId: string; // Network ID
  name: string;
  location: string;
  phoneNumber?: string;
  favoriteType: 'Network';
  isLocal?: boolean;
  logo?: string;
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
    phoneNumber?: string;
    isLocal: boolean;
    ownerId?: string;
    logo?: string;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

const CARD_GRADIENTS = [
    "from-blue-400 via-blue-500 to-blue-600",
    "from-emerald-400 via-emerald-500 to-emerald-600",
    "from-rose-400 via-rose-500 to-rose-600",
    "from-amber-400 via-amber-500 to-orange-600",
    "from-violet-400 via-violet-500 to-indigo-600",
    "from-fuchsia-400 via-fuchsia-500 to-pink-600",
];

const CustomLoader = () => (
  <div className="bg-card/90 p-4 rounded-3xl shadow-2xl flex items-center justify-center w-24 h-24 animate-in zoom-in-95 border border-white/10">
    <div className="relative w-12 h-12">
      <svg
        viewBox="0 0 50 50"
        className="absolute inset-0 w-full h-full animate-spin"
        style={{ animationDuration: '1.2s' }}
      >
        <path d="M15 25 A10 10 0 0 0 35 25" fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 15 A15 15 0 0 1 40 35" fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" className="opacity-30" />
      </svg>
    </div>
  </div>
);

export default function FavoritesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Popup States
  const [selectedNetwork, setSelectedNetwork] = useState<CombinedNetwork | null>(null);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  
  // ترتيب الكروت من الأقل سعراً للأعلى سعراً (فقط للشبكات المحلية)
  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    if (selectedNetwork?.isLocal) {
        return [...categories].sort((a, b) => a.price - b.price);
    }
    return categories; // الشبكات الخارجية تبقى كما هي
  }, [categories, selectedNetwork]);

  // Purchase States
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<any>(null);
  const [showConfirmPurchase, setShowConfirmPurchase] = useState<any | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Favorites Query
  const favoritesQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, 'users', user.uid, 'favorites'),
            where('favoriteType', '==', 'Network')
          )
        : null,
    [firestore, user]
  );
  const { data: favorites, isLoading } = useCollection<Favorite>(favoritesQuery);

  // User Profile
  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  // Define favoriteNetworkIds correctly
  const favoriteNetworkIds = useMemo(() => new Set(favorites?.map(f => f.targetId)), [favorites]);

  const filteredFavorites = useMemo(() => {
    if (!favorites) return [];
    return favorites.filter(fav => 
      fav.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fav.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [favorites, searchTerm]);

  const handleRemoveFavorite = (e: React.MouseEvent, favoriteId: string, networkName: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || !firestore) return;
    const docRef = doc(firestore, 'users', user.uid, 'favorites', favoriteId);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: 'تمت الإزالة',
      description: `تمت إزالة "${networkName}" من المفضلة.`,
    });
  };

  const handleNetworkClick = async (fav: Favorite) => {
    const isLocal = fav.isLocal ?? isNaN(Number(fav.targetId));
    
    let ownerId = 'admin';
    if (isLocal && firestore) {
        const netDoc = await getDocs(query(collection(firestore, 'networks'), where('__name__', '==', fav.targetId)));
        if (!netDoc.empty) {
            ownerId = netDoc.docs[0].data().ownerId || 'admin';
        }
    }

    const network: CombinedNetwork = {
        id: fav.targetId,
        name: fav.name,
        location: fav.location,
        phoneNumber: fav.phoneNumber,
        isLocal: isLocal,
        ownerId: ownerId,
        logo: fav.logo
    };

    setSelectedNetwork(network);
    setCategories([]);
    setIsLoadingCategories(true);
    setCategoryError(null);
    setPurchasedCard(null);

    try {
      if (isLocal && firestore) {
        const catsRef = collection(firestore, `networks/${fav.targetId}/cardCategories`);
        const snapshot = await getDocs(catsRef).catch(async (err) => {
            const permissionError = new FirestorePermissionError({
                path: `networks/${fav.targetId}/cardCategories`,
                operation: 'list'
            });
            errorEmitter.emit('permission-error', permissionError);
            throw err;
        });
        const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
        setCategories(catsData);
      } else {
        const response = await fetch(`/services/networks-api/${fav.targetId}/classes`);
        if (!response.ok) throw new Error('فشل تحميل الفئات الخارجية');
        const data = await response.json();
        setCategories(data.map((c: any) => ({
            id: c.id,
            name: c.name,
            price: c.price,
            capacity: c.dataLimit,
            validity: c.expirationDate
        })));
      }
    } catch (err: any) {
      if (err.name !== 'FirebaseError') {
        setCategoryError(err.message || 'حدث خطأ أثناء جلب الفئات');
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handlePurchase = async () => {
    const selectedCategory = showConfirmPurchase;
    if (!selectedCategory || !selectedNetwork || !user || !userProfile || !firestore || !userDocRef) {
        toast({ variant: "destructive", title: "خطأ", description: "بيانات الشراء غير مكتملة." });
        return;
    }

    setIsProcessing(true);
    const categoryPrice = selectedCategory.price;
    const userBalance = userProfile?.balance ?? 0;

    if (userBalance < categoryPrice) {
        toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "رصيدك الحالي لا يكفي لإتمام عملية الشراء." });
        setIsProcessing(false);
        return;
    }

    try {
        const now = new Date().toISOString();
        const formattedDate = new Date().toLocaleDateString('ar-YE');
        const batch = writeBatch(firestore);
        let finalCardID = '';

        if (selectedNetwork.isLocal) {
            const cardsRef = collection(firestore, `networks/${selectedNetwork.id}/cards`);
            const q = query(cardsRef, where('categoryId', '==', selectedCategory.id), where('status', '==', 'available'), firestoreLimit(1));
            const availableCardsSnapshot = await getDocs(q);

            if (availableCardsSnapshot.empty) throw new Error('لا توجد كروت متاحة حالياً في هذه الفئة.');

            const cardToPurchaseDoc = availableCardsSnapshot.docs[0];
            const cardData = cardToPurchaseDoc.data();
            finalCardID = cardData.cardNumber;
            const ownerId = selectedNetwork.ownerId || 'admin';
            
            const commission = Math.floor(categoryPrice * 0.10);
            const payoutAmount = categoryPrice - commission;

            // 1. تحديث حالة الكرت
            batch.update(cardToPurchaseDoc.ref, { status: 'sold', soldTo: user.uid, soldTimestamp: now });
            
            // 2. سجل العملية للمشتري
            batch.update(userDocRef, { balance: increment(-categoryPrice) });
            
            // 3. سجل العملية للمشتري
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, 
                transactionDate: now, 
                amount: categoryPrice,
                transactionType: `شراء كرت ${selectedCategory.name}`, 
                notes: `شبكة: ${selectedNetwork.name}`,
                cardNumber: cardData.cardNumber,
            });

            // 5. سجل الكروت المباعة للإدارة (الحالة: انتظار للتحويل اليدوي)
            const soldCardRef = doc(collection(firestore, 'soldCards'));
            batch.set(soldCardRef, {
                networkId: selectedNetwork.id,
                ownerId: ownerId,
                networkName: selectedNetwork.name,
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                cardId: cardToPurchaseDoc.id,
                cardNumber: cardData.cardNumber,
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
            setPurchasedCard({ cardID: cardData.cardNumber });
        } else {
            const response = await fetch(`/services/networks-api/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedCategory.id })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل الشراء\nيرجى التواصل مع الادارة 770326828');
            }

            const result = await response.json();
            const cardData = result.data.order.card;
            finalCardID = cardData.cardID;

            batch.update(userDocRef, { balance: increment(-categoryPrice) });
            
            const transactionPayload: any = {
                userId: user.uid, transactionDate: now, amount: categoryPrice,
                transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة: ${selectedNetwork.name}`,
                cardNumber: cardData.cardID,
            };
            
            if (cardData.cardPass && cardData.cardPass !== cardData.cardID) {
                transactionPayload.cardPassword = cardData.cardPass;
            }

            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), transactionPayload);
            await batch.commit();
            setPurchasedCard(cardData);
        }
        
        // --- نظام إرسال الواتساب التلقائي ---
        if (userProfile?.phoneNumber) {
            const waMsg = `⭐ ستار موبايل\n\nمرحباً ${userProfile.displayName || 'عميلنا'}\n\nتم شراء الكرت بنجاح ✅\n\nالشبكة: ${selectedNetwork.name}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${finalCardID}\nالتاريخ: ${formattedDate}\n\nشكراً لاستخدام ستار موبايل`;
            
            fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: userProfile.phoneNumber,
                    message: waMsg
                })
            }).catch(e => console.error("WhatsApp Notify Error", e));
        }

        // إغلاق المنبثقات السابقة عند النجاح
        setShowConfirmPurchase(null);
        setSelectedNetwork(null);
        audioRef.current?.play().catch(() => {});
    } catch (error: any) {
        console.error("Purchase failed:", error);
        toast({ variant: "destructive", title: "فشل عملية الشراء", description: error.message || "حدث خطأ غير متوقع." });
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
        <div className="flex-1 overflow-y-auto px-4 pb-4">
            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="p-4 rounded-2xl animate-pulse"><div className="flex gap-4"><Skeleton className="h-12 w-12 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div></div></Card>
                    ))}
                </div>
            ) : !favorites || filteredFavorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-64">
                    <Heart className="h-16 w-16 text-muted-foreground opacity-20" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">لا توجد شبكات مفضلة</h3>
                    <p className="mt-1 text-sm text-muted-foreground">أضف شبكتك المفضلة هنا للوصول إليها بسرعة</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredFavorites.map((fav, index) => (
                        <Card 
                            key={fav.id} 
                            className="bg-mesh-gradient cursor-pointer text-white rounded-2xl animate-in fade-in-0 slide-in-from-bottom-2 border-none shadow-md overflow-hidden"
                            style={{ animationDelay: `${index * 30}ms` }}
                            onClick={() => handleNetworkClick(fav)}
                        >
                            <CardContent className="p-4 flex items-center justify-between gap-2">
                                <div className="p-3 bg-white/20 rounded-xl shrink-0 backdrop-blur-sm border border-white/10 w-12 h-12 flex items-center justify-center overflow-hidden">
                                    <Wifi className="h-6 w-6 text-white" />
                                </div>
                                
                                <div className="flex-1 text-right mx-4 space-y-1 text-white overflow-hidden">
                                    <h4 className="font-bold text-base text-white truncate">{fav.name}</h4>
                                    <p className="text-[10px] opacity-80 text-white/80 truncate">{fav.location}</p>
                                </div>
                                
                                <button 
                                    onClick={(e) => handleRemoveFavorite(e, fav.id, fav.name)}
                                    className="p-2.5 hover:scale-110 transition-transform bg-white/10 rounded-full shrink-0"
                                >
                                    <Heart className={cn("h-6 w-6 text-white", favoriteNetworkIds.has(fav.targetId) && "fill-white")} />
                                </button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </div>

      <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && !isProcessing && setSelectedNetwork(null)}>
        <DialogContent className="max-w-[95%] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden bg-white dark:bg-slate-950">
          {selectedNetwork && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="bg-mesh-gradient p-0 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                
                <DialogHeader className="pt-12 pb-8 px-8 text-white text-center relative z-10">
                    <DialogTitle className="sr-only">{selectedNetwork?.name || 'تفاصيل الشبكة'}</DialogTitle>
                    <DialogDescription className="sr-only">تفاصيل الشبكة والفئات المتاحة للشراء</DialogDescription>
                    <div className="bg-white/20 p-3 rounded-2xl w-14 h-14 mx-auto mb-3 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl overflow-hidden">
                        <Wifi className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-white drop-shadow-md">{selectedNetwork.name}</h2>
                    <p className="text-[10px] text-white/70 font-bold mt-1 bg-white/10 py-1 px-3 rounded-full border border-white/5 inline-block">{selectedNetwork.location}</p>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900">
                {isLoadingCategories ? (
                  <div className="flex justify-center py-10"><CustomLoader /></div>
                ) : categoryError ? (
                  <div className="text-center py-10 space-y-2"><AlertCircle className="h-10 w-10 mx-auto text-destructive" /><p className="text-sm font-bold">{categoryError}</p></div>
                ) : categories.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">لا توجد فئات متاحة حالياً.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedCategories.map((cat, idx) => {
                        const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                        return (
                            <div key={cat.id} className="animate-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 100}ms` }}>
                                <Card 
                                    className={cn(
                                        "relative overflow-hidden rounded-[28px] border-none shadow-lg transition-all duration-300 group cursor-pointer active:scale-[0.97]",
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
                                            <div className="flex flex-col items-end leading-tight">
                                                <span className="text-xl font-black tracking-tighter text-primary">{cat.price.toLocaleString('en-US')}</span>
                                                <span className="text-[7px] font-black text-muted-foreground uppercase opacity-60">ريال</span>
                                            </div>
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
              <div className="p-4 bg-white dark:bg-slate-900 border-t">
                <Button variant="outline" className="w-full h-11 rounded-2xl font-black text-sm" onClick={() => setSelectedNetwork(null)}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showConfirmPurchase} onOpenChange={(open) => !open && setShowConfirmPurchase(null)}>
        <DialogContent className="rounded-[32px] max-sm text-center bg-white dark:bg-slate-900 z-[10000] border-none shadow-2xl outline-none">
          <DialogHeader>
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <DialogTitle className="text-center font-black text-xl">تأكيد عملية الشراء</DialogTitle>
            <DialogDescription className="text-center font-bold">هل أنت متأكد من شراء كرت <span className="text-primary">"{showConfirmPurchase?.name}"</span>؟</DialogDescription>
          </DialogHeader>
          <div className="py-6 bg-muted/30 rounded-[28px] border-2 border-dashed border-primary/10 space-y-2 mt-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">سيتم خصم المبلغ من رصيدك</p>
            <p className="text-3xl font-black text-primary">{showConfirmPurchase?.price.toLocaleString('en-US')} <span className="text-sm">ريال</span></p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-6">
            <Button className="w-full h-12 rounded-2xl font-bold" onClick={handlePurchase} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد الشراء'}
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-2xl font-bold mt-0" onClick={() => setShowConfirmPurchase(null)}>تراجع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {purchasedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 animate-in fade-in-0">
            <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-background">
                <CardContent className="p-8 space-y-6">
                    <div>
                        <div className="bg-green-500 p-8 flex justify-center mb-4 rounded-t-[40px] -m-8">
                            <div className="bg-white/20 p-4 rounded-full animate-bounce">
                                <CheckCircle className="h-16 w-16 text-white" />
                            </div>
                        </div>
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

      {/* SMS Dialog */}
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
                <div className="space-y-2">
                    <Label htmlFor="sms-phone" className="text-[10px] font-black text-muted-foreground pr-1 uppercase tracking-widest">رقم جوال الزبون</Label>
                    <Input 
                        id="sms-phone"
                        placeholder="7xxxxxxxx" 
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

      {isProcessing && <ProcessingOverlay message="جاري معالجة طلبك..." />}
      <Toaster />
    </>
  );
}
