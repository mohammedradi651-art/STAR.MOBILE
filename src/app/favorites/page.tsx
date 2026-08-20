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
};

type CombinedNetwork = {
    id: string;
    name: string;
    location: string;
    isLocal: boolean;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

export default function FavoritesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedNetwork, setSelectedNetwork] = useState<CombinedNetwork | null>(null);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<any>(null);
  const [showConfirmPurchase, setShowConfirmPurchase] = useState<any | null>(null);
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

  const filteredFavorites = useMemo(() => {
    if (!favorites) return [];
    return favorites.filter(fav => fav.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [favorites, searchTerm]);

  const handleNetworkClick = async (fav: Favorite) => {
    setSelectedNetwork({ id: fav.targetId, name: fav.name, location: fav.location, isLocal: !!fav.isLocal });
    setIsLoadingCategories(true);
    setCategories([]);

    try {
      if (fav.isLocal && firestore) {
        const catsRef = collection(firestore, `networks/${fav.targetId}/cardCategories`);
        const snapshot = await getDocs(catsRef);
        const catsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardCategory));
        setCategories(catsData);
      } else {
        const response = await fetch(`/services/networks-api/${fav.targetId}/classes`);
        if (!response.ok) throw new Error('فشل التحميل');
        const data = await response.json();
        setCategories(data.map((c: any) => ({ id: c.id, name: c.name, price: c.price, capacity: c.dataLimit, validity: c.expirationDate })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handlePurchase = async () => {
    const selectedCategory = showConfirmPurchase;
    if (!selectedCategory || !selectedNetwork || !user || !userProfile || !firestore || !userDocRef) return;

    setIsProcessing(true);
    try {
        const now = new Date().toISOString();
        const batch = writeBatch(firestore);
        let finalCardID = '';

        if (selectedNetwork.isLocal) {
            const cardsRef = collection(firestore, `networks/${selectedNetwork.id}/cards`);
            const q = query(cardsRef, where('categoryId', '==', selectedCategory.id), where('status', '==', 'available'), firestoreLimit(1));
            const availableCardsSnapshot = await getDocs(q);
            if (availableCardsSnapshot.empty) throw new Error('لا توجد كروت متاحة.');
            const cardDoc = availableCardsSnapshot.docs[0];
            finalCardID = cardDoc.data().cardNumber;

            batch.update(cardDoc.ref, { status: 'sold', soldTo: user.uid, soldTimestamp: now });
            batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, transactionDate: now, amount: selectedCategory.price,
                transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة: ${selectedNetwork.name}`, cardNumber: finalCardID,
            });
            await batch.commit();
            setPurchasedCard({ cardID: finalCardID });
        } else {
            const response = await fetch(`/services/networks-api/order`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedCategory.id })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'فشل الشراء');
            finalCardID = result.data.order.card.cardID;
            batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
            batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
                userId: user.uid, transactionDate: now, amount: selectedCategory.price,
                transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة: ${selectedNetwork.name}`, cardNumber: finalCardID,
            });
            await batch.commit();
            setPurchasedCard(result.data.order.card);
        }

        // إرسال SMS بصيغة المستخدم الجديدة
        if (userProfile?.phoneNumber) {
            const shortName = getFirstLast(userProfile.displayName);
            const smsMsg = `ستار موبايل\nمرحباً ${shortName}،\n\nتم شراء كرت الإنترنت الخاص بك بنجاح.\n\nالشبكة: ${selectedNetwork.name}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${finalCardID}`;
            fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: userProfile.phoneNumber.trim(), message: smsMsg }) }).catch(() => {});
        }

        setShowConfirmPurchase(null);
        setSelectedNetwork(null);
        audioRef.current?.play().catch(() => {});
    } catch (error: any) {
        toast({ variant: "destructive", title: "فشل", description: error.message });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full bg-background">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <SimpleHeader title="المفضلة" />
        <div className="p-4"><Input placeholder="البحث في المفضلة..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl h-12 bg-muted/20" /></div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
            {isLoading ? <Skeleton className="h-48 w-full" /> : filteredFavorites.length === 0 ? <p className="text-center py-20 opacity-30">لا توجد شبكات مفضلة</p> : (
                <div className="space-y-4">
                    {filteredFavorites.map(fav => (
                        <Card key={fav.id} className="bg-mesh-gradient cursor-pointer text-white rounded-2xl p-4 flex items-center justify-between" onClick={() => handleNetworkClick(fav)}>
                            <div className="flex items-center gap-3"><Wifi className="h-6 w-6" /><div><h4 className="font-bold">{fav.name}</h4><p className="text-xs opacity-80">{fav.location}</p></div></div>
                            <Heart className="fill-white h-5 w-5" />
                        </Card>
                    ))}
                </div>
            )}
        </div>
        <Toaster />
        <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && setSelectedNetwork(null)}>
            <DialogContent className="rounded-3xl p-6">
                <DialogHeader><DialogTitle className="text-center">{selectedNetwork?.name}</DialogTitle></DialogHeader>
                <div className="space-y-3 py-4">
                    {isLoadingCategories ? <Loader2 className="animate-spin mx-auto" /> : categories.map(cat => (
                        <Card key={cat.id} className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50" onClick={() => setShowConfirmPurchase(cat)}>
                            <div><p className="font-bold">{cat.name}</p><p className="text-xs text-primary">{cat.price} ريال</p></div>
                            <Button size="sm">شراء</Button>
                        </Card>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
        <Dialog open={!!showConfirmPurchase} onOpenChange={() => setShowConfirmPurchase(null)}>
            <DialogContent className="rounded-3xl text-center p-6">
                <DialogTitle>تأكيد الشراء</DialogTitle>
                <p className="py-4">هل أنت متأكد من شراء كرت {showConfirmPurchase?.name}؟</p>
                <Button className="w-full h-12 rounded-2xl" onClick={handlePurchase} disabled={isProcessing}>تأكيد</Button>
            </DialogContent>
        </Dialog>
        {purchasedCard && (
            <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4">
                <Card className="w-full max-w-sm text-center p-8 rounded-[40px]">
                    <h2 className="text-2xl font-black text-green-600">تم الشراء!</h2>
                    <p className="text-3xl font-mono my-6 bg-muted p-4 rounded-2xl border-2 border-dashed">{purchasedCard.cardID || purchasedCard.cardNumber}</p>
                    <Button className="w-full h-12 rounded-2xl" onClick={() => { setPurchasedCard(null); router.push('/login'); }}>إغلاق</Button>
                </Card>
            </div>
        )}
    </div>
  );
}