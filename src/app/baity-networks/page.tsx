'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Globe, 
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
  Wifi,
  Clock,
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
import { collection, query, where, doc, writeBatch, increment, getDocs, limit as firestoreLimit } from 'firebase/firestore';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

type CombinedNetwork = {
    id: string;
    name: string;
    location: string;
    isLocal: boolean;
    logo?: string;
};

type CardCategory = {
    id: string | number;
    name: string;
    price: number;
    dataLimit?: string;
    expirationDate?: string;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

export default function BaityNetworksPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [networks, setNetworks] = useState<CombinedNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const response = await fetch('/services/networks-api');
        if (response.ok) {
          const data = await response.json();
          setNetworks(data.map((n: any) => ({
            id: String(n.id), name: n.name, location: n.desc || 'شبكة الخير', isLocal: false, logo: n.logo,
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNetworks();
  }, []);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const handleNetworkClick = async (network: CombinedNetwork) => {
    setSelectedNetwork(network);
    setIsLoadingCategories(true);
    try {
      const response = await fetch(`/services/networks-api/${network.id}/classes`);
      if (!response.ok) throw new Error('فشل تحميل الفئات');
      const data = await response.json();
      setCategories(data.map((c: any) => ({ id: c.id, name: c.name, price: c.price, dataLimit: c.dataLimit, expirationDate: c.expirationDate })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handlePurchase = async () => {
    const selectedCategory = showConfirmPurchase;
    if (!selectedCategory || !user || !userProfile || !firestore || !userDocRef) return;
    
    setIsProcessing(true);
    try {
        const response = await fetch(`/services/networks-api/order`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId: selectedCategory.id })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'فشل الشراء');
        
        const cardData = result.data.order.card;
        const batch = writeBatch(firestore);
        batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
        batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), {
            userId: user.uid, transactionDate: new Date().toISOString(), amount: selectedCategory.price,
            transactionType: `شراء كرت ${selectedCategory.name}`, notes: `شبكة: ${selectedNetwork?.name}`, cardNumber: cardData.cardID,
        });
        await batch.commit();
        
        setPurchasedCard(cardData);
        setShowConfirmPurchase(null);
        setSelectedNetwork(null);
        audioRef.current?.play().catch(() => {});

        // إرسال SMS بصيغة المستخدم الجديدة
        if (userProfile?.phoneNumber) {
            const shortName = getFirstLast(userProfile.displayName);
            const smsMsg = `ستار موبايل\nمرحباً ${shortName}،\n\nتم شراء كرت الإنترنت الخاص بك بنجاح.\n\nالشبكة: ${selectedNetwork?.name || 'الخير'}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${cardData.cardID}`;
            fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: userProfile.phoneNumber.trim(), message: smsMsg }) }).catch(() => {});
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <SimpleHeader title="عروض شبكة الخير" />
        <div className="p-4"><Input placeholder="ابحث عن العروض..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl h-12 bg-muted/20" /></div>
        <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4">
            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : networks.map(net => (
                <Card key={net.id} className="bg-mesh-gradient text-white p-4 rounded-2xl cursor-pointer" onClick={() => handleNetworkClick(net)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3"><Wifi className="h-6 w-6" /><div><h4 className="font-bold">{net.name}</h4><p className="text-xs opacity-80">{net.location}</p></div></div>
                        <ChevronLeft className="h-5 w-5" />
                    </div>
                </Card>
            ))}
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
                <Card className="w-full max-w-sm text-center p-8 rounded-[48px]">
                    <h2 className="text-2xl font-black text-green-600">تم الشراء!</h2>
                    <p className="text-3xl font-mono my-6 bg-muted p-4 rounded-2xl border-2 border-dashed">{purchasedCard.cardID}</p>
                    <Button className="w-full h-12 rounded-2xl" onClick={() => { setPurchasedCard(null); router.push('/login'); }}>إغلاق</Button>
                </Card>
            </div>
        )}
        {isProcessing && <ProcessingOverlay />}
    </div>
  );
}