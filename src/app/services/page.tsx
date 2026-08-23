'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Wifi, 
  Heart, 
  Database, 
  CheckCircle, 
  Loader2,
  X,
  Clock,
  WifiOff,
  Copy,
  Smartphone,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useUser, 
  useDoc
} from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  getDocs,
  writeBatch,
  increment,
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
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import Lottie from 'lottie-react';
import { useRouter } from 'next/navigation';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

export const dynamic = 'force-dynamic';

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

const CARD_GRADIENTS = [
    "from-blue-400 via-blue-500 to-blue-600",
    "from-emerald-400 via-emerald-500 to-emerald-600",
    "from-rose-400 via-rose-500 to-rose-600",
    "from-amber-400 via-amber-500 to-orange-600",
    "from-violet-400 via-violet-500 to-indigo-600",
];

const AnimatedLogoLoader = () => {
  const [animationData, setAnimationData] = useState<any>(null);
  useEffect(() => {
    fetch('/TH.json').then(res => res.json()).then(data => setAnimationData(data));
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-32 h-32">
          {animationData && <Lottie animationData={animationData} loop={true} />}
      </div>
    </div>
  );
};

export default function CombinedNetworksPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  
  const [apiNetworks, setApiNetworks] = useState<CombinedNetwork[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(true);

  const [selectedNetwork, setSelectedNetwork] = useState<CombinedNetwork | null>(null);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  
  const [purchaseCategory, setPurchaseCategory] = useState<CardCategory | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCardNum, setPurchasedCardNum] = useState<string | null>(null);

  // فحص الإنترنت صامتاً
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
        window.removeEventListener('online', handleStatus);
        window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const localNetworksQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'networks') : null),
    [firestore]
  );
  const { data: localNetworks, isLoading: isLoadingLocal } = useCollection<any>(localNetworksQuery);

  // جلب وتخزين الشبكات في الخلفية
  useEffect(() => {
    const fetchAndCache = async () => {
      try {
        let combined: CombinedNetwork[] = [];
        
        // 1. معالجة الشبكات المحلية
        if (localNetworks) {
            combined = localNetworks.map(n => ({ ...n, isLocal: true }));
        }

        // 2. جلب شبكات API إذا توفر الإنترنت
        if (!isOffline) {
            const response = await fetch('/services/networks-api');
            if (response.ok) {
                const data = await response.json();
                const mappedApi = data.map((n: any) => ({
                    id: String(n.id), name: n.name, location: n.desc || 'شبكة API', isLocal: false, logo: n.logo,
                }));
                setApiNetworks(mappedApi);
                combined = [...combined, ...mappedApi];
            }
            // تخزين صامت في الخلفية
            if (combined.length > 0) {
                localStorage.setItem('star_cached_nets', JSON.stringify(combined));
            }
            setIsLoadingApi(false);
        } else {
            // تحميل من الكاش في وضع الأوفلاين
            const cached = localStorage.getItem('star_cached_nets');
            if (cached) {
                const data = JSON.parse(cached);
                setApiNetworks(data.filter((n: any) => !n.isLocal));
            }
            setIsLoadingApi(false);
        }
      } catch (err) {
        console.error("Cache background error:", err);
        setIsLoadingApi(false);
      }
    };

    fetchAndCache();
  }, [localNetworks, isOffline]);

  const allNetworksCombined = useMemo(() => {
    let list: CombinedNetwork[] = [];
    if (!isOffline) {
        const local = localNetworks ? localNetworks.map(n => ({ ...n, isLocal: true })) : [];
        list = [...local, ...apiNetworks];
    } else {
        const cached = localStorage.getItem('star_cached_nets');
        list = cached ? JSON.parse(cached) : [];
    }
    if (!searchTerm) return list;
    return list.filter((net: any) => net.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [localNetworks, apiNetworks, searchTerm, isOffline]);

  const handleNetworkClick = async (network: CombinedNetwork) => {
    setSelectedNetwork(network);
    setCategories([]);
    setIsLoadingCategories(true);

    const cachedCatsKey = `star_cats_${network.id}`;
    
    // جلب من الكاش فوراً إذا توفر
    const cachedCats = localStorage.getItem(cachedCatsKey);
    if (cachedCats) {
        setCategories(JSON.parse(cachedCats));
        if (isOffline) {
            setIsLoadingCategories(false);
            return;
        }
    }

    if (isOffline && !cachedCats) {
        setIsLoadingCategories(false);
        toast({ variant: 'destructive', title: 'غير متوفر', description: 'بيانات هذه الشبكة غير محفوظة للأوفلاين.' });
        setSelectedNetwork(null);
        return;
    }

    try {
      let catsData: CardCategory[] = [];
      if (network.isLocal && firestore) {
        const catsRef = collection(firestore, `networks/${network.id}/cardCategories`);
        const snapshot = await getDocs(catsRef);
        catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
      } else {
        const response = await fetch(`/services/networks-api/${network.id}/classes`);
        if (response.ok) {
            const data = await response.json();
            catsData = data.map((c: any) => ({ id: c.id, name: c.name, price: c.price, capacity: c.dataLimit, validity: c.expirationDate }));
        }
      }
      
      if (catsData.length > 0) {
          setCategories(catsData);
          localStorage.setItem(cachedCatsKey, JSON.stringify(catsData));
      }
    } catch (err: any) { 
        console.error(err); 
    } finally { 
        setIsLoadingCategories(false); 
    }
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseCategory || !selectedNetwork || !user || !firestore) return;
    
    setIsProcessing(true);
    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDocs(query(collection(firestore, 'users'), where('id', '==', user.uid)));
        const userData = userSnap.docs[0]?.data();
        
        if (!userData || (userData.balance || 0) < purchaseCategory.price) {
            throw new Error('رصيدك غير كافٍ لإتمام الشراء.');
        }

        let finalCardNum = '';
        const now = new Date().toISOString();
        const batch = writeBatch(firestore);

        if (selectedNetwork.isLocal) {
            const cardsRef = collection(firestore, `networks/${selectedNetwork.id}/cards`);
            const q = query(cardsRef, where('categoryId', '==', purchaseCategory.id), where('status', '==', 'available'), firestoreLimit(1));
            const availSnap = await getDocs(q);
            if (availSnap.empty) throw new Error('نفذت الكمية من هذه الفئة حالياً.');
            
            const cardDoc = availSnap.docs[0];
            finalCardNum = cardDoc.data().cardNumber;
            batch.update(cardDoc.ref, { status: 'sold', soldTo: user.uid, soldTimestamp: now });
        } else {
            const res = await fetch('/services/networks-api/order', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: purchaseCategory.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'فشل الشراء من المصدر.');
            finalCardNum = data.data.order.card.cardID;
        }

        batch.update(userDocRef, { balance: increment(-purchaseCategory.price) });
        batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
            userId: user.uid, transactionDate: now, amount: purchaseCategory.price,
            transactionType: `شراء كرت ${purchaseCategory.name}`, notes: `شبكة: ${selectedNetwork.name}`, cardNumber: finalCardNum,
        });

        await batch.commit();
        setPurchasedCardNum(finalCardNum);
        setPurchaseCategory(null);
        audioRef.current?.play().catch(() => {});
        toast({ title: 'نجاح', description: 'تم شراء الكرت بنجاح.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل العملية', description: e.message });
    } finally { setIsProcessing(false); }
  };

  const handleSmsPurchase = (cat: CardCategory) => {
    if (!selectedNetwork) return;
    const msg = `STAR MOBILE - ${selectedNetwork.name} - ${cat.name} - ${cat.price} YER`;
    window.location.href = `sms:770326828?body=${encodeURIComponent(msg)}`;
    setPurchaseCategory(null);
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        {isProcessing && <ProcessingOverlay message="جاري تنفيذ الشراء..." />}
        <SimpleHeader title="الشبكات" />
        
        {isOffline && (
            <div className="mx-4 bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl flex items-center justify-center gap-2 mb-2">
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-[10px] font-black text-orange-700">أنت في وضع الأوفلاين - الشبكات المحفوظة فقط</span>
            </div>
        )}

        <div className="p-4">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input type="text" placeholder="البحث في الشبكات..." className="w-full pr-10 rounded-xl h-12 bg-muted/20 border-2 border-black/5" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 no-scrollbar">
            {(isLoadingLocal || isLoadingApi) && !isOffline ? (
                <AnimatedLogoLoader />
            ) : allNetworksCombined.length === 0 ? (
                <div className="text-center py-20 opacity-40">
                    <Wifi className="h-16 w-16 mx-auto mb-4" />
                    <p className="font-bold">لا توجد شبكات متاحة حالياً</p>
                </div>
            ) : (
                allNetworksCombined.map((net, index) => (
                    <Card key={net.id} className="bg-mesh-gradient cursor-pointer text-white rounded-2xl border-none shadow-md overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2" onClick={() => handleNetworkClick(net)}>
                        <CardContent className="p-4 flex items-center justify-between gap-2">
                            <div className="p-3 bg-white/20 rounded-xl shrink-0"><Wifi className="h-6 w-6 text-white" /></div>
                            <div className="flex-1 text-right mx-2 overflow-hidden">
                                <h4 className="font-black text-base text-white truncate">{net.name}</h4>
                                <p className="text-[10px] text-white/70 font-bold truncate opacity-80">{net.location}</p>
                            </div>
                            <button className="p-2.5 hover:scale-110 transition-transform bg-white/10 rounded-full shrink-0"><Heart className="h-5 w-5 text-white" /></button>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
      </div>

      {/* حوار الفئات */}
      <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && setSelectedNetwork(null)}>
        <DialogContent className="max-w-[95%] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-950 outline-none [&>button]:hidden">
          {selectedNetwork && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="bg-mesh-gradient p-0 relative overflow-hidden">
                <DialogHeader className="pt-12 pb-8 px-8 text-white text-center">
                    <div className="bg-white/20 p-3 rounded-2xl w-14 h-14 mx-auto mb-3"><Wifi className="h-7 w-7 text-white" /></div>
                    <DialogTitle className="text-xl font-black text-white">{selectedNetwork.name}</DialogTitle>
                    <DialogDescription className="text-[10px] text-white/70 font-bold mt-1 uppercase tracking-widest">{selectedNetwork.location}</DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900 no-scrollbar">
                {isLoadingCategories ? ( <AnimatedLogoLoader /> ) : (
                  <div className="space-y-3">
                    {categories.map((cat, idx) => {
                        const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                        return (
                            <Card key={cat.id} className={cn("relative overflow-hidden rounded-[28px] border-none shadow-xl transition-all p-[2px]", "bg-gradient-to-br", gradient)} onClick={() => setPurchaseCategory(cat)}>
                                <div className="relative rounded-[26px] p-3.5 flex items-center justify-between gap-4 h-full bg-white/95 dark:bg-slate-900/95 hover:bg-primary/[0.02] cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-11 w-11 rounded-[18px] flex items-center justify-center text-white", gradient)}><Wifi className="h-5 w-5" /></div>
                                        <div className="text-right">
                                            <h4 className="text-xs font-black text-foreground">{cat.name}</h4>
                                            <div className="flex gap-2 mt-1">
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-primary"><Database className="h-2.5 w-2.5" /><span>{cat.capacity || '-'}</span></div>
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground"><Clock className="h-2.5 w-2.5" /><span>{cat.validity || cat.expirationDate || '-'}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="text-xl font-black text-primary">{cat.price.toLocaleString('en-US')} <span className="text-[7px]">ر.ي</span></span>
                                        <Button size="sm" className="h-7 rounded-lg text-[9px] font-black px-4 bg-primary">شراء</Button>
                                    </div>
                                </div>
                            </Card>
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

      {/* حوار تأكيد الشراء بـ 3 أزرار */}
      <Dialog open={!!purchaseCategory} onOpenChange={(open) => !open && setPurchaseCategory(null)}>
          <DialogContent className="rounded-[32px] max-sm p-0 overflow-hidden border-none shadow-2xl outline-none [&>button]:hidden">
              <div className="bg-mesh-gradient p-8 text-center text-white">
                  <DialogHeader>
                    <DialogTitle className="text-center font-black text-xl text-white">تأكيد عملية الشراء</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold text-xs mt-1">هل أنت متأكد من شراء كرت {purchaseCategory?.name}؟</DialogDescription>
                  </DialogHeader>
              </div>
              <div className="p-6 space-y-4">
                  <div className="bg-muted/50 p-5 rounded-3xl text-center space-y-1">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">المبلغ المطلوب</p>
                      <p className="text-2xl font-black text-primary">{purchaseCategory?.price.toLocaleString()} ر.ي</p>
                  </div>

                  <div className="flex flex-col gap-3">
                      <Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#0048ad] text-white shadow-lg active:scale-95 transition-transform" onClick={handleConfirmPurchase} disabled={isOffline || isProcessing}>
                          {isProcessing ? <Loader2 className="animate-spin" /> : 'شراء من الرصيد'}
                      </Button>
                      <Button className="w-full h-14 rounded-2xl font-black text-lg bg-orange-500 hover:bg-orange-600 text-white shadow-lg active:scale-95 transition-transform" onClick={() => purchaseCategory && handleSmsPurchase(purchaseCategory)}>
                          شراء عبر الرسائل SMS
                      </Button>
                      <Button variant="ghost" className="w-full h-12 rounded-2xl font-bold text-muted-foreground" onClick={() => setPurchaseCategory(null)}>إلغاء</Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* حوار النجاح */}
      <Dialog open={!!purchasedCardNum} onOpenChange={(open) => !open && setPurchasedCardNum(null)}>
          <DialogContent className="rounded-[40px] max-sm p-8 text-center border-none shadow-2xl bg-white dark:bg-slate-900 outline-none">
              <div className="bg-green-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-600 animate-bounce" />
              </div>
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-green-600">مبروك! تم الشراء</DialogTitle>
                  <DialogDescription className="text-sm font-bold text-muted-foreground mt-2">رقم الكرت الخاص بك هو:</DialogDescription>
              </DialogHeader>
              <div className="my-8 p-6 bg-muted rounded-[32px] border-2 border-dashed border-primary/20">
                  <p className="text-4xl font-black font-mono tracking-widest text-foreground">{purchasedCardNum}</p>
              </div>
              <Button className="w-full h-14 rounded-2xl font-black text-lg" onClick={() => setPurchasedCardNum(null)}>إغلاق</Button>
          </DialogContent>
      </Dialog>

      <Toaster />
    </>
  );
}
