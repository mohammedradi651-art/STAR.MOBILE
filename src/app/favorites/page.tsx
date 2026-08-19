'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, deleteDocumentNonBlocking, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, getDocs, writeBatch, increment, limit as firestoreLimit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, MapPin, Heart, Search, X, AlertCircle, Database, Calendar, CheckCircle, Copy, MessageSquare, Wallet, Smartphone, Loader2, Clock, WifiOff } from 'lucide-react';
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
  targetId: string;
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
  const [isOnline, setIsOnline] = useState(true);

  // Popup States
  const [selectedNetwork, setSelectedNetwork] = useState<CombinedNetwork | null>(null);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  
  // Purchase States
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<any>(null);
  const [showConfirmPurchase, setShowConfirmPurchase] = useState<any | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Favorites Hybrid logic
  const favoritesQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(collection(firestore, 'users', user.uid, 'favorites'), where('favoriteType', '==', 'Network'))
        : null,
    [firestore, user]
  );
  const { data: liveFavorites, isLoading: isLoadingLive } = useCollection<Favorite>(favoritesQuery);
  const [cachedFavorites, setCachedFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    const cached = localStorage.getItem('star_cached_favorites');
    if (cached) setCachedFavorites(JSON.parse(cached));
  }, []);

  useEffect(() => {
    if (liveFavorites && liveFavorites.length > 0) {
      localStorage.setItem('star_cached_favorites', JSON.stringify(liveFavorites));
      setCachedFavorites(liveFavorites);
    }
  }, [liveFavorites]);

  const displayFavorites = isOnline ? liveFavorites || cachedFavorites : cachedFavorites;
  const isLoading = isLoadingLive && cachedFavorites.length === 0;

  const filteredFavorites = useMemo(() => {
    return displayFavorites.filter(fav => 
      fav.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fav.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [displayFavorites, searchTerm]);

  const handleRemoveFavorite = (e: React.MouseEvent, favoriteId: string, networkName: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!isOnline) {
        toast({ variant: "destructive", title: "تحتاج إنترنت", description: "عمليات التعديل تتطلب اتصالاً بالإنترنت." });
        return;
    }
    if (!user || !firestore) return;
    const docRef = doc(firestore, 'users', user.uid, 'favorites', favoriteId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'تمت الإزالة', description: `تمت إزالة "${networkName}" من المفضلة.` });
  };

  const handleNetworkClick = async (fav: Favorite) => {
    const isLocal = fav.isLocal ?? isNaN(Number(fav.targetId));
    const network: CombinedNetwork = {
        id: fav.targetId,
        name: fav.name,
        location: fav.location,
        phoneNumber: fav.phoneNumber,
        isLocal: isLocal,
        logo: fav.logo
    };

    setSelectedNetwork(network);
    setCategoryError(null);
    setPurchasedCard(null);

    const catCacheKey = `star_cached_cats_${network.id}`;
    const cachedCats = localStorage.getItem(catCacheKey);
    
    if (cachedCats) {
      try {
        setCategories(JSON.parse(cachedCats));
        setIsLoadingCategories(false);
      } catch (e) {
        setCategories([]);
        setIsLoadingCategories(true);
      }
    } else {
      setCategories([]);
      setIsLoadingCategories(true);
    }

    if (isOnline) {
        try {
          if (isLocal && firestore) {
            const catsRef = collection(firestore, `networks/${fav.targetId}/cardCategories`);
            const snapshot = await getDocs(catsRef);
            const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
            setCategories(catsData);
            localStorage.setItem(catCacheKey, JSON.stringify(catsData));
          } else {
            const response = await fetch(`/services/networks-api/${fav.targetId}/classes`);
            if (!response.ok) throw new Error('فشل تحميل الفئات');
            const data = await response.json();
            const mapped = data.map((c: any) => ({
                id: c.id, name: c.name, price: c.price, capacity: c.dataLimit, validity: c.expirationDate
            }));
            setCategories(mapped);
            localStorage.setItem(catCacheKey, JSON.stringify(mapped));
          }
        } catch (err: any) {
          console.error(err);
        } finally {
          setIsLoadingCategories(false);
        }
    } else {
        setIsLoadingCategories(false);
        if (!cachedCats) {
            setCategoryError("لا توجد بيانات محفوظة لهذه الشبكة أوفلاين.");
        }
    }
  };

  const handlePurchase = async () => {
    if (!isOnline) {
        toast({ variant: "destructive", title: "تحتاج إنترنت", description: "شراء الرصيد المباشر يتطلب اتصالاً بالإنترنت." });
        return;
    }
    const selectedCategory = showConfirmPurchase;
    if (!selectedCategory || !selectedNetwork || !user || !firestore) return;

    setIsProcessing(true);
    try {
        const now = new Date().toISOString();
        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', user.uid);
        
        if (selectedNetwork.isLocal) {
            const cardsRef = collection(firestore, `networks/${selectedNetwork.id}/cards`);
            const q = query(cardsRef, where('categoryId', '==', selectedCategory.id), where('status', '==', 'available'), firestoreLimit(1));
            const availableCardsSnapshot = await getDocs(q);

            if (availableCardsSnapshot.empty) throw new Error('لا توجد كروت متاحة حالياً.');
            
            const cardToPurchaseDoc = availableCardsSnapshot.docs[0];
            const cardData = cardToPurchaseDoc.data();
            
            batch.update(cardToPurchaseDoc.ref, { status: 'sold', soldTo: user.uid, soldTimestamp: now });
            batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, transactionDate: now, amount: selectedCategory.price,
                transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة: ${selectedNetwork.name}`,
                cardNumber: cardData.cardNumber,
            });
            await batch.commit();
            setPurchasedCard({ cardID: cardData.cardNumber });
        } else {
            const response = await fetch(`/services/networks-api/order`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedCategory.id })
            });
            if (!response.ok) throw new Error('فشل الشراء من المزود.');
            const result = await response.json();
            const cardData = result.data.order.card;
            
            batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, transactionDate: now, amount: selectedCategory.price,
                transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة: ${selectedNetwork.name}`,
                cardNumber: cardData.cardID,
            });
            await batch.commit();
            setPurchasedCard(cardData);
        }
        audioRef.current?.play().catch(() => {});
    } catch (error: any) {
        toast({ variant: "destructive", title: "فشل العملية", description: error.message });
    } finally { 
        setIsProcessing(false); 
        setShowConfirmPurchase(null);
    }
  };

  const handleBuySms = () => {
    if (!selectedNetwork || !showConfirmPurchase) return;
    const msg = `STAR MOBILE - ${selectedNetwork.name} - ${showConfirmPurchase.name} - ${showConfirmPurchase.price} YER`;
    window.location.href = `sms:770326828?body=${encodeURIComponent(msg)}`;
    setShowConfirmPurchase(null);
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <SimpleHeader title="المفضلة" />
        
        {!isOnline && (
            <div className="mx-4 bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl flex items-center justify-center gap-2 mb-2">
                <WifiOff className="h-3 w-3 text-orange-600" />
                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">وضع العمل بدون إنترنت</span>
            </div>
        )}

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
                    {[1, 2].map(i => <Card key={i} className="p-4 rounded-2xl animate-pulse"><Skeleton className="h-12 w-full rounded-lg" /></Card>)}
                </div>
            ) : filteredFavorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-64 opacity-20">
                    <Heart className="h-16 w-16 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">لا توجد مفضلات</h3>
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
                                <div className="p-3 bg-white/20 rounded-xl shrink-0 backdrop-blur-sm w-12 h-12 flex items-center justify-center overflow-hidden">
                                    <Wifi className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 text-right mx-4 overflow-hidden">
                                    <h4 className="font-bold text-base text-white truncate">{fav.name}</h4>
                                    <p className="text-[10px] opacity-80 text-white/80 truncate">{fav.location}</p>
                                </div>
                                <button onClick={(e) => handleRemoveFavorite(e, fav.id, fav.name)} className="p-2.5 hover:scale-110 transition-transform bg-white/10 rounded-full shrink-0">
                                    <Heart className="h-6 w-6 text-white fill-white" />
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
              <div className="bg-mesh-gradient pt-12 pb-8 px-8 text-white text-center relative overflow-hidden">
                    <div className="bg-white/20 p-3 rounded-2xl w-14 h-14 mx-auto mb-3 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                        <Wifi className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-white drop-shadow-md">{selectedNetwork.name}</h2>
                    <p className="text-[10px] text-white/70 font-bold mt-1 bg-white/10 py-1 px-3 rounded-full border border-white/5 inline-block">{selectedNetwork.location}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900">
                {isLoadingCategories ? ( <div className="flex justify-center py-10"><CustomLoader /></div> ) : categoryError ? (
                  <p className="text-center text-destructive font-bold p-10">{categoryError}</p>
                ) : (
                  <div className="space-y-3">
                    {categories.map((cat, idx) => (
                        <Card 
                            key={cat.id} 
                            className="relative overflow-hidden rounded-[28px] border-none shadow-lg transition-all duration-300 group cursor-pointer active:scale-[0.97] bg-gradient-to-br from-primary/10 to-primary/5 p-1"
                            onClick={() => setShowConfirmPurchase(cat)}
                        >
                            <div className="relative rounded-[24px] p-3.5 flex items-center justify-between gap-4 h-full bg-white dark:bg-slate-900">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-primary text-white">
                                        <Wifi className="h-5 w-5" />
                                    </div>
                                    <div className="text-right">
                                        <h4 className="text-xs font-black text-foreground">{cat.name}</h4>
                                        <div className="flex gap-2.5 mt-1 text-[9px] font-bold text-muted-foreground">
                                            <span className="flex items-center gap-1"><Database className="h-2.5 w-2.5" />{cat.capacity || '-'}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{cat.validity || cat.expirationDate || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-lg font-black text-primary">{cat.price.toLocaleString()}</span>
                                    <Button size="sm" className="h-6 rounded-lg text-[9px] font-black px-4">شراء</Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-white dark:bg-slate-900"><Button variant="outline" className="w-full h-11 rounded-2xl font-black text-sm" onClick={() => setSelectedNetwork(null)}>إغلاق</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showConfirmPurchase} onOpenChange={(open) => !open && setShowConfirmPurchase(null)}>
        <DialogContent className="rounded-[32px] max-sm text-center bg-white dark:bg-slate-950 z-[10000] border-none shadow-2xl outline-none [&>button]:hidden">
          <DialogHeader>
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-10 w-10 text-primary" /></div>
            <DialogTitle className="text-center font-black text-xl">تأكيد عملية الشراء</DialogTitle>
            <DialogDescription className="text-center font-bold">هل أنت متأكد من شراء كرت <span className="text-primary">"{showConfirmPurchase?.name}"</span>؟</DialogDescription>
          </DialogHeader>
          <div className="py-6 bg-muted/30 rounded-[28px] border-2 border-dashed border-primary/10 space-y-2 mt-4 text-center">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">سيتم خصم المبلغ من رصيدك</p>
            <p className="text-3xl font-black text-primary">{showConfirmPurchase?.price.toLocaleString()} <span className="text-sm">ريال</span></p>
          </div>
          <DialogFooter className="grid grid-cols-1 gap-3 mt-6">
            <Button className="w-full h-12 rounded-2xl font-black text-base shadow-lg" onClick={handlePurchase} disabled={isProcessing}>
                شراء مباشر (رصيد)
            </Button>
            <Button className="w-full h-12 rounded-2xl font-black text-base bg-[#00c853] hover:bg-[#00a846] text-white" onClick={handleBuySms}>
                شراء عبر SMS
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-2xl font-black text-base mt-0" onClick={() => setShowConfirmPurchase(null)}>تراجع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  );
}
