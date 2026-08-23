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
  WifiOff
} from 'lucide-react';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useUser, 
  deleteDocumentNonBlocking,
  useDoc,
  addDocumentNonBlocking
} from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  getDocs
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import Lottie from 'lottie-react';

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

type Favorite = {
    id: string;
    targetId: string;
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

/**
 * مكون التحميل المتحرك الرسمي
 */
const AnimatedLogoLoader = () => {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    fetch('/TH.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Lottie load error:", err));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
      <div className="relative w-32 h-32 flex items-center justify-center overflow-hidden">
          {animationData && (
            <Lottie 
                animationData={animationData} 
                loop={true} 
                style={{ width: '100%', height: '100%' }} 
            />
          )}
      </div>
    </div>
  );
};

export default function CombinedNetworksPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  
  const [apiNetworks, setApiNetworks] = useState<CombinedNetwork[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(true);

  const [selectedNetwork, setSelectedNetwork] = useState<CombinedNetwork | null>(null);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // فحص حالة الإنترنت والتخزين المحلي
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    
    // محاولة جلب الشبكات من التخزين المحلي فوراً في حال عدم وجود نت
    if (!navigator.onLine) {
        const cached = localStorage.getItem('cached_networks_all');
        if (cached) {
            setApiNetworks(JSON.parse(cached));
            setIsLoadingApi(false);
        }
    }

    return () => {
        window.removeEventListener('online', handleStatus);
        window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const localNetworksQuery = useMemoFirebase(
    () => (firestore && !isOffline ? collection(firestore, 'networks') : null),
    [firestore, isOffline]
  );
  const { data: localNetworks, isLoading: isLoadingLocal } = useCollection<any>(localNetworksQuery);

  useEffect(() => {
    const fetchApiNetworks = async () => {
      if (isOffline) return;
      
      try {
        const response = await fetch('/services/networks-api');
        if (response.ok) {
          const data = await response.json();
          const mapped = data.map((n: any) => ({
            id: String(n.id),
            name: n.name,
            location: n.desc || 'شبكة API',
            isLocal: false,
            logo: n.logo,
          }));
          setApiNetworks(mapped);
          // تحديث الكاش
          localStorage.setItem('cached_networks_all', JSON.stringify(mapped));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingApi(false);
      }
    };
    fetchApiNetworks();
  }, [isOffline]);

  const allNetworksCombined = useMemo(() => {
    const local = localNetworks ? localNetworks.map(n => ({ ...n, isLocal: true })) : [];
    const api = apiNetworks;
    const combined = [...local, ...api];
    
    // حفظ النسخة المدمجة للطوارئ
    if (combined.length > 0 && !isOffline) {
        localStorage.setItem('cached_combined_list', JSON.stringify(combined));
    }

    const listToFilter = combined.length > 0 ? combined : (isOffline ? JSON.parse(localStorage.getItem('cached_combined_list') || '[]') : []);

    if (!searchTerm) return listToFilter;
    return listToFilter.filter((net: any) => net.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [localNetworks, apiNetworks, searchTerm, isOffline]);

  const favoritesQuery = useMemoFirebase(
    () => user && firestore && !isOffline ? query(collection(firestore, 'users', user.uid, 'favorites'), where('favoriteType', '==', 'Network')) : null,
    [firestore, user, isOffline]
  );
  const { data: favorites } = useCollection<Favorite>(favoritesQuery);
  const favoriteNetworkIds = useMemo(() => new Set(favorites?.map(f => f.targetId)), [favorites]);

  const handleNetworkClick = async (network: CombinedNetwork) => {
    setSelectedNetwork(network);
    setCategories([]);
    setIsLoadingCategories(true);

    // محاولة جلب الفئات من الكاش أولاً في وضع الـ Offline
    if (isOffline) {
        const cachedCats = localStorage.getItem(`cats_${network.id}`);
        if (cachedCats) {
            setCategories(JSON.parse(cachedCats));
            setIsLoadingCategories(false);
            return;
        }
        setIsLoadingCategories(false);
        toast({ variant: 'destructive', title: 'غير متوفر', description: 'هذه الشبكة غير محفوظة محلياً. يرجى الاتصال بالإنترنت أولاً.' });
        setSelectedNetwork(null);
        return;
    }

    try {
      if (network.isLocal && firestore) {
        const catsRef = collection(firestore, `networks/${network.id}/cardCategories`);
        const snapshot = await getDocs(catsRef);
        const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
        setCategories(catsData);
        localStorage.setItem(`cats_${network.id}`, JSON.stringify(catsData));
      } else {
        const response = await fetch(`/services/networks-api/${network.id}/classes`);
        if (!response.ok) throw new Error('فشل تحميل الفئات');
        const data = await response.json();
        const mapped = data.map((c: any) => ({ id: c.id, name: c.name, price: c.price, capacity: c.dataLimit, validity: c.expirationDate }));
        setCategories(mapped);
        localStorage.setItem(`cats_${network.id}`, JSON.stringify(mapped));
      }
    } catch (err: any) {
        console.error(err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleSmsPurchase = (cat: CardCategory) => {
    if (!selectedNetwork) return;
    const msg = `STAR MOBILE - ${selectedNetwork.name} - ${cat.name} - ${cat.price} YER`;
    window.location.href = `sms:770326828?body=${encodeURIComponent(msg)}`;
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <SimpleHeader title="الشبكات" />
        
        {isOffline && (
            <div className="mx-4 bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl flex items-center justify-center gap-2 mb-2 animate-in fade-in-0 duration-500">
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-[10px] font-black text-orange-700">أنت الآن في وضع الأوفلاين (الشبكات المحفوظة فقط)</span>
            </div>
        )}

        <div className="p-4">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input type="text" placeholder="البحث في الشبكات..." className="w-full pr-10 rounded-xl h-12 bg-muted/20 border-2 border-black/10 focus-visible:ring-primary shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 no-scrollbar">
            {(isLoadingLocal || isLoadingApi) && !isOffline ? (
                <AnimatedLogoLoader />
            ) : allNetworksCombined.length === 0 ? (
                <div className="text-center py-20 opacity-40">
                    <Wifi className="h-16 w-16 mx-auto mb-4" />
                    <p className="font-bold">لا توجد شبكات متاحة حالياً</p>
                    {isOffline && <p className="text-[10px] mt-2">يرجى الاتصال بالإنترنت مرة واحدة لتحميل البيانات.</p>}
                </div>
            ) : (
                allNetworksCombined.map((net, index) => (
                    <Card key={net.id} className="bg-mesh-gradient cursor-pointer text-white rounded-2xl border-none shadow-md overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }} onClick={() => handleNetworkClick(net)}>
                        <CardContent className="p-4 flex items-center justify-between gap-2">
                            <div className="p-3 bg-white/20 rounded-xl shrink-0 backdrop-blur-sm border border-white/10 w-12 h-12 flex items-center justify-center overflow-hidden"><Wifi className="h-6 w-6 text-white" /></div>
                            <div className="flex-1 text-right mx-2 space-y-0.5 overflow-hidden">
                                <h4 className="font-black text-base text-white truncate">{net.name}</h4>
                                <p className="text-[10px] text-white/70 font-bold truncate opacity-80">{net.location}</p>
                            </div>
                            <button className="p-2.5 hover:scale-110 transition-transform bg-white/10 rounded-full shrink-0">
                                <Heart className={cn("h-5 w-5 text-white", favoriteNetworkIds.has(net.id) && 'fill-white')} />
                            </button>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
      </div>

      <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && !isProcessing && setSelectedNetwork(null)}>
        <DialogContent className="max-w-[95%] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden bg-white dark:bg-slate-950">
          {selectedNetwork && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="bg-mesh-gradient p-0 relative overflow-hidden">
                <DialogHeader className="pt-12 pb-8 px-8 text-white text-center relative z-10">
                    <div className="bg-white/20 p-3 rounded-2xl w-14 h-14 mx-auto mb-3 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl overflow-hidden"><Wifi className="h-7 w-7 text-white" /></div>
                    <DialogTitle className="text-xl font-black text-white drop-shadow-md">{selectedNetwork.name}</DialogTitle>
                    <DialogDescription className="text-[10px] text-white/70 font-bold mt-1 bg-white/10 py-1 px-3 rounded-full border border-white/5 inline-block">{selectedNetwork.location}</DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900 no-scrollbar">
                {isLoadingCategories ? ( <AnimatedLogoLoader /> ) : (
                  <div className="space-y-3">
                    {categories.map((cat, idx) => {
                        const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                        return (
                            <Card key={cat.id} className={cn("relative overflow-hidden rounded-[28px] border-none shadow-xl transition-all duration-300 group cursor-pointer active:scale-[0.97]", "bg-gradient-to-br p-[2px]", gradient)}>
                                <div className="relative rounded-[26px] p-3.5 flex items-center justify-between gap-4 h-full transition-colors bg-white/95 dark:bg-slate-900/95 hover:bg-primary/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-11 w-11 rounded-[18px] flex items-center justify-center shrink-0 shadow-lg bg-gradient-to-br text-white overflow-hidden", gradient)}><Wifi className="h-5 w-5" /></div>
                                        <div className="text-right space-y-0.5">
                                            <h4 className="text-xs font-black text-foreground">{cat.name}</h4>
                                            <div className="flex gap-2.5 mt-1">
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-primary"><Database className="h-2.5 w-2.5" /><span>{cat.capacity || '-'}</span></div>
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground"><Clock className="h-2.5 w-2.5" /><span>{cat.validity || cat.expirationDate || '-'}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="text-xl font-black text-primary">{cat.price.toLocaleString('en-US')} <span className="text-[7px]">ر.ي</span></span>
                                        {isOffline ? (
                                            <Button size="sm" className="h-7 rounded-lg text-[8px] font-black px-3 bg-amber-500 hover:bg-amber-600 border-none shadow-sm" onClick={() => handleSmsPurchase(cat)}>شراء عبر SMS</Button>
                                        ) : (
                                            <Button size="sm" className="h-7 rounded-lg text-[9px] font-black px-4 bg-primary" onClick={() => {
                                                window.location.href = `/network-cards/${selectedNetwork.id}?name=${encodeURIComponent(selectedNetwork.name)}`;
                                            }}>شراء</Button>
                                        )}
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

      <Toaster />
    </>
  );
}
