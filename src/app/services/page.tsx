
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Wifi, 
  Heart, 
  AlertCircle, 
  Database, 
  Calendar, 
  CheckCircle, 
  Copy, 
  MessageSquare, 
  Loader2,
  Smartphone,
  X,
  Globe,
  Clock,
  Star,
  Trophy,
  Megaphone,
  ChevronLeft
} from 'lucide-react';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useUser, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  useDoc
} from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  writeBatch, 
  increment, 
  getDocs, 
  limit as firestoreLimit 
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
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
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const dynamic = 'force-dynamic';

// Types
type CombinedNetwork = {
    id: string;
    name: string;
    location: string;
    phoneNumber?: string;
    ownerId?: string;
    isLocal: boolean;
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

type Favorite = {
    id: string;
    targetId: string;
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
    "from-teal-400 via-teal-500 to-cyan-600",
];

const CustomLoader = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-xs font-bold text-muted-foreground animate-pulse">جاري جلب الشبكات...</p>
    </div>
);

export default function CombinedNetworksPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [apiNetworks, setApiNetworks] = useState<CombinedNetwork[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(true);

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

  // Fetch local networks
  const localNetworksQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'networks') : null),
    [firestore]
  );
  const { data: localNetworks, isLoading: isLoadingLocal } = useCollection<any>(localNetworksQuery);

  // Fetch API networks (Baitynet) with robust fetching
  useEffect(() => {
    const fetchApiNetworks = async () => {
      setIsLoadingApi(true);
      try {
        const response = await fetch('/services/networks-api', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const mapped = data.map((n: any) => ({
            id: String(n.id),
            name: n.name,
            location: n.desc || 'شبكة بيتي الخارجية',
            isLocal: false,
            logo: n.logo,
          }));
          setApiNetworks(mapped);
        } else {
            console.error("API Fetch failed with status:", response.status);
        }
      } catch (err) {
        console.error("API Fetch Error:", err);
      } finally {
        setIsLoadingApi(false);
      }
    };
    fetchApiNetworks();
  }, []);

  const allNetworksCombined = useMemo(() => {
    const local = localNetworks ? localNetworks.map(n => ({
        ...n,
        isLocal: true
    })) : [];
    const api = apiNetworks;
    const combined = [...local, ...api];
    
    if (!searchTerm) return combined;
    
    return combined.filter(net => 
        net.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        net.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [localNetworks, apiNetworks, searchTerm]);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const favoritesQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(collection(firestore, 'users', user.uid, 'favorites'), where('favoriteType', '==', 'Network'))
        : null,
    [firestore, user]
  );
  const { data: favorites } = useCollection<Favorite>(favoritesQuery);
  const favoriteNetworkIds = useMemo(() => new Set(favorites?.map(f => f.targetId)), [favorites]);

  const handleNetworkClick = async (network: CombinedNetwork) => {
    setSelectedNetwork(network);
    setCategoryError(null);
    setPurchasedCard(null);
    setCategories([]);
    setIsLoadingCategories(true);

    try {
      if (network.isLocal && firestore) {
        const catsRef = collection(firestore, `networks/${network.id}/cardCategories`);
        const snapshot = await getDocs(catsRef).catch(async (err) => {
            const contextualError = new FirestorePermissionError({
                path: `networks/${network.id}/cardCategories`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', contextualError);
            throw err;
        });
        const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
        setCategories(catsData);
      } else {
        const response = await fetch(`/services/networks-api/${network.id}/classes`, { cache: 'no-store' });
        if (!response.ok) throw new Error('فشل تحميل فئات بيتي');
        const data = await response.json();
        const mapped = data.map((c: any) => ({
            id: c.id, name: c.name, price: c.price, capacity: c.dataLimit, validity: c.expirationDate
        }));
        setCategories(mapped);
      }
    } catch (err: any) {
      if (err.name !== 'FirebaseError') {
        setCategoryError(err.message || 'حدث خطأ أثناء جلب الفئات');
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent, network: CombinedNetwork) => {
    e.preventDefault(); e.stopPropagation();
    if (!user || !firestore) return;
    const isFavorited = favoriteNetworkIds.has(network.id);
    if (isFavorited) {
      const fav = favorites?.find(f => f.targetId === network.id);
      if (fav) deleteDocumentNonBlocking(doc(firestore, 'users', user.uid, 'favorites', fav.id));
    } else {
      addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'favorites'), {
        userId: user.uid, 
        targetId: network.id, 
        name: network.name, 
        location: network.location, 
        favoriteType: 'Network', 
        isLocal: network.isLocal,
        logo: network.logo || ''
      });
    }
  };

  const handlePurchase = async () => {
    const selectedCategory = showConfirmPurchase;
    if (!selectedCategory || !selectedNetwork || !user || !userProfile || !firestore || !userDocRef) return;
    
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
            
            const commission = Math.ceil(selectedCategory.price * 0.10);
            const payoutAmount = selectedCategory.price - commission;
            const ownerId = selectedNetwork.ownerId || 'admin';

            batch.update(cardToPurchaseDoc.ref, { status: 'sold', soldTo: user.uid, soldTimestamp: now });
            batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, 
                transactionDate: now, 
                amount: selectedCategory.price,
                transactionType: `شراء كرت ${selectedCategory.name}`, 
                notes: `شبكة: ${selectedNetwork.name}`,
                cardNumber: cardData.cardNumber,
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
                payoutStatus: 'pending'
            });

            await batch.commit();
            setPurchasedCard({ cardID: cardData.cardNumber });
        } else {
            const response = await fetch(`/services/networks-api/order`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedCategory.id, userId: user.uid })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل الشراء من بيتي');
            }
            
            const result = await response.json();
            const cardData = result.data.order.card;
            finalCardID = cardData.cardID;
            
            batch.update(userDocRef, { balance: increment(-categoryPrice) });
            
            const transactionPayload: any = {
                userId: user.uid, transactionDate: now, amount: categoryPrice,
                transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة بيتي: ${selectedNetwork.name}`,
                cardNumber: cardData.cardID,
                uuidOrder: result.data.order.uuidOrder
            };
            
            if (cardData.cardPass && cardData.cardPass !== cardData.cardID) {
                transactionPayload.cardPassword = cardData.cardPass;
            }

            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), transactionPayload);
            await batch.commit();
            setPurchasedCard(cardData);
        }
        
        if (userProfile?.phoneNumber) {
            const waMsg = `⭐ ستار موبايل\n\nمرحباً ${userProfile.displayName || 'عميلنا'}\n\nتم شراء الكرت بنجاح ✅\n\nالشبكة: ${selectedNetwork?.name}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${finalCardID}\nالتاريخ: ${formattedDate}\n\nشكراً لاستخدام ستار موبايل`;
            
            await fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userProfile.phoneNumber, message: waMsg })
            }).catch(e => console.error("WA Error", e));
        }

        setShowConfirmPurchase(null);
        setSelectedNetwork(null);
        audioRef.current?.play().catch(() => {});
    } catch (error: any) {
        toast({ variant: "destructive", title: "فشل العملية", description: error.message || 'يرجى التواصل مع الادارة 770326828' });
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

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => a.price - b.price);
  }, [categories]);

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <SimpleHeader title="الشبكات" />
        <div className="p-4">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    type="text" 
                    placeholder="ابحث في كافة الشبكات..." 
                    className="w-full pr-10 rounded-xl h-12 bg-muted/20 border-2 border-black/10 focus-visible:ring-primary shadow-sm" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 no-scrollbar">
            {(isLoadingLocal && isLoadingApi) ? (
                <div className="flex justify-center py-20"><CustomLoader /></div>
            ) : allNetworksCombined.length === 0 ? (
                <div className="text-center py-20 opacity-40"><Wifi className="h-16 w-16 mx-auto mb-4" /><p className="font-bold">لا توجد شبكات متاحة حالياً</p></div>
            ) : (
                allNetworksCombined.map((net, index) => (
                    <Card 
                        key={net.id} 
                        className="bg-mesh-gradient cursor-pointer text-white rounded-[28px] border-none shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2"
                        style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                        onClick={() => handleNetworkClick(net)}
                    >
                        <CardContent className="p-4 flex items-center justify-between gap-2 relative">
                            <div className="p-3 bg-white/20 rounded-[20px] shrink-0 backdrop-blur-md border border-white/10 w-14 h-14 flex items-center justify-center overflow-hidden shadow-inner">
                                <Wifi className="h-7 w-7 text-white" />
                            </div>
                            
                            <div className="flex-1 text-right mx-2 space-y-0.5 overflow-hidden">
                                <div className="flex items-center justify-end gap-2">
                                    {!net.isLocal && <Badge className="bg-white/20 text-white border-none text-[8px] h-4">بيتي</Badge>}
                                    <h4 className="font-black text-base text-white truncate">{net.name}</h4>
                                </div>
                                <p className="text-[10px] text-white/70 font-bold truncate opacity-80 flex items-center justify-end gap-1">
                                    {net.location}
                                    <Globe className="h-3 w-3" />
                                </p>
                            </div>
                            
                            <div className="flex flex-col items-center gap-2">
                                <button onClick={(e) => handleFavoriteClick(e, net)} className="p-2.5 hover:scale-110 transition-transform bg-white/10 rounded-full shrink-0">
                                    <Heart className={cn("h-5 w-5 text-white", favoriteNetworkIds.has(net.id) && 'fill-white')} />
                                </button>
                                <ChevronLeft className="h-4 w-4 text-white opacity-40" />
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
      </div>

      <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && !isProcessing && setSelectedNetwork(null)}>
        <DialogContent className="max-w-[95%] sm:max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden bg-white dark:bg-slate-950">
          {selectedNetwork && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="bg-mesh-gradient p-0 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <DialogHeader className="pt-12 pb-8 px-8 text-white text-center relative z-10">
                    <div className="bg-white/20 p-3 rounded-2xl w-14 h-14 mx-auto mb-3 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                        <Wifi className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-white drop-shadow-md">{selectedNetwork.name}</h2>
                    <p className="text-[10px] text-white/70 font-bold mt-1 bg-white/10 py-1 px-3 rounded-full border border-white/5 inline-block">{selectedNetwork.location}</p>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-[#F4F7F9] dark:bg-slate-900 no-scrollbar">
                {isLoadingCategories ? ( <CustomLoader /> ) : categoryError ? ( <p className="text-center text-destructive font-bold p-4 bg-destructive/10 rounded-2xl">{categoryError}</p> ) : (
                  <div className="space-y-3">
                    {sortedCategories.map((cat, idx) => {
                        const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                        return (
                            <div key={cat.id} className="animate-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 80}ms` }}>
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
                                            <div className="flex flex-col items-end leading-tight">
                                                <span className="text-xl font-black tracking-tighter text-primary">{cat.price.toLocaleString('en-US')}</span>
                                                <span className="text-[7px] font-black text-muted-foreground uppercase opacity-60">ريال</span>
                                            </div>
                                            <Button size="sm" className="h-7 rounded-lg text-[9px] font-black px-4 bg-primary shadow-md">شراء</Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        );
                    })}
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-white dark:bg-slate-950"><Button variant="outline" className="w-full h-12 rounded-2xl font-black text-sm" onClick={() => setSelectedNetwork(null)}>إغلاق</Button></div>
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
            <DialogDescription className="text-center font-bold">
              هل أنت متأكد من شراء كرت <span className="text-primary">"{showConfirmPurchase?.name}"</span>؟
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 bg-muted/30 rounded-[28px] border-2 border-dashed border-primary/10 space-y-2 mt-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">سيتم خصم المبلغ من رصيدك</p>
            <p className="text-3xl font-black text-primary">{showConfirmPurchase?.price.toLocaleString('en-US')} <span className="text-sm">ريال</span></p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-6">
            <Button className="w-full h-12 rounded-2xl font-black text-base shadow-lg" onClick={handlePurchase} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد الشراء'}
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-2xl font-black text-base mt-0" onClick={() => setShowConfirmPurchase(null)}>تراجع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {purchasedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 animate-in fade-in-0">
            <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-background">
                <CardContent className="p-8 space-y-6">
                    <div className="bg-green-500 p-8 flex justify-center mb-4 rounded-t-[40px] -m-8">
                        <CheckCircle className="h-20 w-20 text-white animate-bounce" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-green-600 mt-4">تم الشراء بنجاح!</h2>
                        <p className="text-sm text-muted-foreground mt-1">احتفظ برقم الكرت جيداً</p>
                    </div>
                    <div className="p-6 bg-muted rounded-[24px] border-2 border-dashed border-primary/20">
                        <p className="text-3xl font-black font-mono tracking-tighter text-foreground">
                            {purchasedCard.cardID || purchasedCard.cardNumber}
                        </p>
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

      {isProcessing && <ProcessingOverlay />}
      <Toaster />
    </>
  );
}

