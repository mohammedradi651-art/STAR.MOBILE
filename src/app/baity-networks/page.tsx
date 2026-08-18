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

// Types
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

type Favorite = {
    id: string;
    targetId: string;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

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

export default function BaityNetworksPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [networks, setNetworks] = useState<CombinedNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    const fetchNetworks = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/services/networks-api');
        if (response.ok) {
          const data = await response.json();
          setNetworks(data.map((n: any) => ({
            id: String(n.id),
            name: n.name,
            location: n.desc || 'شبكة API',
            isLocal: false,
            logo: n.logo,
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

  const filteredNetworks = useMemo(() => {
    return networks.filter(net => net.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [networks, searchTerm]);

  const handleNetworkClick = async (network: CombinedNetwork) => {
    setSelectedNetwork(network);
    setCategories([]);
    setIsLoadingCategories(true);
    setCategoryError(null);
    setPurchasedCard(null);

    try {
      const response = await fetch(`/services/networks-api/${network.id}/classes`);
      if (!response.ok) throw new Error('فشل تحميل الفئات');
      const data = await response.json();
      setCategories(data.map((c: any) => ({
          id: c.id, name: c.name, price: c.price, dataLimit: c.dataLimit, expirationDate: c.expirationDate
      })));
    } catch (err: any) {
      setCategoryError(err.message);
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
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل الشراء\nيرجى التواصل مع الادارة 770326828');
        }
        
        const result = await response.json();
        const cardData = result.data.order.card;
        const formattedDate = new Date().toLocaleDateString('ar-YE');
        
        const batch = writeBatch(firestore);
        batch.update(userDocRef, { balance: increment(-selectedCategory.price) });
        
        const transactionPayload: any = {
            userId: user.uid, 
            transactionDate: new Date().toISOString(), 
            amount: selectedCategory.price,
            transactionType: `شراء كرت ${selectedCategory.name}`, 
            notes: `شبكة بيتي: ${selectedNetwork?.name}`,
            cardNumber: cardData.cardID,
        };
        
        if (cardData.cardPass && cardData.cardPass !== cardData.cardID) {
            transactionPayload.cardPassword = cardData.cardPass;
        }

        batch.set(doc(collection(firestore, `users/${user.uid}/transactions`)), transactionPayload);
        await batch.commit();
        
        setPurchasedCard(cardData);
        // إغلاق المنبثقات السابقة عند النجاح
        setShowConfirmPurchase(null);
        setSelectedNetwork(null);
        audioRef.current?.play().catch(() => {});

        // --- نظام إشعارات SMS التلقائي ---
        if (userProfile?.phoneNumber) {
            const smsMsg = `ستار موبايل: تم شراء كرت ${selectedCategory.name} لشبكة الخير بنجاح ✅. رقم الكرت: ${cardData.cardID}. شكراً لاستخدامك تطبيقنا 💙`;
            fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: userProfile.phoneNumber.trim(),
                    message: smsMsg
                })
            }).catch(e => console.error("SMS Notify Error", e));
        }

        // --- نظام إرسال الواتساب التلقائي ---
        if (userProfile?.phoneNumber) {
            const waMsg = `⭐ ستار موبايل\n\nمرحباً ${userProfile.displayName || 'عميلنا'}\n\nتم شراء الكرت بنجاح ✅\n\nالشبكة: ${selectedNetwork?.name || 'الخير'}\nالفئة: ${selectedCategory.name}\nرقم الكرت: ${cardData.cardID}\nالتاريخ: ${formattedDate}\n\nشكراً لاستخدام ستار موبايل`;
            
            fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: userProfile.phoneNumber,
                    message: waMsg
                })
            }).catch(e => console.error("WhatsApp Notify Error", e));
        }

    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ", description: error.message || 'فشل الشراء\nيرجى التواصل مع الادارة 770326828' });
    } finally { 
        setIsProcessing(false); 
    }
  };

  const handleCopy = () => {
    if (purchasedCard) {
        navigator.clipboard.writeText(purchasedCard.cardID);
        toast({ title: "تم النسخ" });
    }
  };

  const handleSendSms = () => {
    if (!purchasedCard || !selectedNetwork || !smsRecipient) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى إدخل رقم الزبون.' });
        return;
    }
    const name = userProfile?.displayName || 'عميلنا';
    const balance = (userProfile?.balance ?? 0).toLocaleString('en-US');
    const cardInfo = purchasedCard.cardID;
    
    const msg = `${name} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${selectedNetwork.name}\nالفئة: فئة ${selectedNetwork.name}\nرقم الكرت: ${cardInfo}\n\n*رصيدك:* ${balance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;
    
    window.location.href = `sms:${smsRecipient}?body=${encodeURIComponent(msg)}`;
    setIsSmsDialogOpen(false);
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground">
        <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
        <div className="bg-mesh-gradient pt-12 pb-16 px-6 rounded-b-[40px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="bg-white/20 p-4 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <Megaphone className="h-10 w-10 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white tracking-tight">عروض شبكة الخير</h2>
                    <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full inline-block border border-white/10">
                        <p className="text-[11px] text-white font-bold uppercase tracking-widest">أقوى باقات شبكة الخير فورجي</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 -mt-8">
            <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    type="text" 
                    placeholder="ابحث عن العروض..." 
                    className="w-full pr-12 h-14 rounded-3xl bg-white dark:bg-slate-900 border-none shadow-xl focus-visible:ring-primary" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 space-y-4">
          {isLoading ? ( 
            <div className="flex flex-col items-center justify-center py-20"><CustomLoader /></div> 
          ) : filteredNetworks.length === 0 ? ( 
            <div className="text-center py-16 text-muted-foreground">
                <Globe className="mx-auto h-16 w-16 opacity-20" />
                <p className="mt-4 font-bold">لا توجد عروض حالياً</p>
            </div> 
          ) : (
            filteredNetworks.map((network, index) => (
              <Card 
                key={network.id} 
                className="bg-card cursor-pointer border-none shadow-lg rounded-[32px] overflow-hidden group hover:shadow-xl transition-all animate-in fade-in-0 slide-in-from-bottom-4" 
                style={{ animationDelay: `${index * 100}ms` }} 
                onClick={() => handleNetworkClick(network)}
              >
                <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="p-3 bg-primary/5 rounded-[24px] border border-primary/5 group-hover:bg-primary/10 transition-colors w-14 h-14 flex items-center justify-center overflow-hidden">
                        <Wifi className="h-8 w-8 text-primary" />
                    </div>

                    <div className="flex-1 text-right overflow-hidden">
                        <div className="flex items-center justify-end gap-2 mb-1">
                            <Badge className="bg-orange-500/10 text-orange-600 border-none text-[9px] font-black h-5 rounded-lg">عرض حصري</Badge>
                            <h4 className="font-black text-lg text-foreground truncate">{network.name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground font-bold truncate opacity-70 flex items-center justify-end gap-1">
                            {network.location}
                            <Globe className="h-3 w-3" />
                        </p>
                    </div>

                    <div className="p-2.5 hover:scale-110 transition-transform bg-muted/50 rounded-2xl">
                        <ChevronLeft className="h-5 w-5 text-primary" />
                    </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
            <Button 
                onClick={() => router.push('/login')}
                className="w-full h-14 rounded-3xl bg-mesh-gradient text-white font-black text-lg shadow-2xl pointer-events-auto active:scale-95 transition-transform"
            >
                إغلاق النافذة
            </Button>
        </div>
      </div>

      <Dialog open={!!selectedNetwork} onOpenChange={(open) => !open && !isProcessing && setSelectedNetwork(null)}>
        <DialogContent className="max-w-[95%] sm:max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden bg-[#F8FAFC] dark:bg-slate-950">
          {selectedNetwork && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="bg-mesh-gradient p-0 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                
                <DialogHeader className="pt-12 pb-10 px-8 text-white text-center relative z-10">
                    <div className="bg-white/20 p-4 rounded-[28px] w-16 h-16 mx-auto mb-4 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl overflow-hidden">
                        <Wifi className="h-8 w-8 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-black text-white drop-shadow-md">فئات {selectedNetwork.name}</DialogTitle>
                    <DialogDescription className="text-xs text-white/70 font-bold mt-1 uppercase tracking-widest">اختر الفئة المناسبة وابدأ التصفح الآن</DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isLoadingCategories ? ( 
                    <div className="space-y-4 pt-4">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-[32px]" />)}
                    </div>
                ) : categoryError ? ( 
                    <div className="text-center py-10 space-y-2"><AlertCircle className="h-10 w-10 mx-auto text-destructive" /><p className="text-sm font-bold">{categoryError}</p></div> 
                ) : (
                  <div className="space-y-4 pt-2">
                    {categories.map((cat, idx) => {
                        const isFeatured = idx === 0;
                        return (
                            <Card 
                                key={cat.id} 
                                className={cn(
                                    "relative overflow-hidden rounded-[32px] border-none shadow-lg transition-all duration-300 group cursor-pointer active:scale-[0.97]",
                                    isFeatured ? "ring-2 ring-orange-500/20" : ""
                                )}
                                onClick={() => setShowConfirmPurchase(cat)}
                            >
                                <CardContent className="p-0 flex items-stretch h-36">
                                    <div className="w-[30%] bg-muted/30 flex flex-col items-center justify-center p-3 border-l border-dashed">
                                        <div className="text-center mb-3">
                                            <p className={cn("text-2xl font-black", isFeatured ? "text-orange-600" : "text-primary")}>{cat.price.toLocaleString('en-US')}</p>
                                            <p className="text-[8px] font-black text-muted-foreground uppercase">ريال يمني</p>
                                        </div>
                                        <Button size="sm" className={cn(
                                            "h-8 rounded-xl px-5 text-[10px] font-black shadow-md",
                                            isFeatured ? "bg-orange-500 hover:bg-orange-600" : "bg-primary"
                                        )}>شراء</Button>
                                    </div>

                                    <div className="flex-1 p-4 flex flex-col justify-center text-right space-y-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {isFeatured && <Badge className="bg-orange-500 text-white border-none text-[8px] h-4">عرض خاص</Badge>}
                                            <h4 className="font-black text-base">فئة {cat.price} ريال</h4>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-end gap-2 text-primary">
                                                <span className="text-[10px] font-black">{cat.dataLimit || '5 جيجا'}</span>
                                                <Database className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                                                <span className="text-[10px] font-bold">{cat.expirationDate || 'ساعة واحدة'}</span>
                                                <Clock className="h-3.5 w-3.5" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-[20%] flex items-center justify-center p-4">
                                        <div className={cn(
                                            "h-14 w-14 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br text-white overflow-hidden",
                                            isFeatured ? "from-orange-400 to-orange-600" : "from-blue-400 to-blue-600"
                                        )}>
                                            <Wifi className="h-6 w-6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-white dark:bg-slate-900 border-t">
                <Button 
                    variant="outline" 
                    className="w-full h-14 rounded-3xl font-black text-base border-2" 
                    onClick={() => setSelectedNetwork(null)}
                >
                    إغلاق العروض
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showConfirmPurchase} onOpenChange={(open) => !open && setShowConfirmPurchase(null)}>
        <DialogContent className="rounded-[40px] max-sm text-center bg-white dark:bg-slate-900 z-[10000] border-none shadow-2xl">
          <DialogHeader>
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-primary" />
            </div>
            <DialogTitle className="text-center font-black text-xl">تأكيد الشراء</DialogTitle>
            <DialogDescription className="text-center font-bold">سيتم خصم <span className="text-primary">{showConfirmPurchase?.price.toLocaleString('en-US')} ريال</span> من رصيدك.</DialogDescription>
          </DialogHeader>
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
            <Card className="w-full max-sm text-center shadow-2xl rounded-[48px] overflow-hidden border-none bg-background">
                <CardContent className="p-8 space-y-6">
                    <div className="bg-green-500 p-8 flex justify-center mb-4 rounded-t-[48px] -m-8">
                        <CheckCircle className="h-20 w-20 text-white animate-bounce" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-green-600">تم الشراء بنجاح!</h2>
                        <p className="text-sm text-muted-foreground mt-1">رقم كرتك الجديد</p>
                    </div>
                    <div className="p-6 bg-muted rounded-3xl border-2 border-dashed border-primary/20 space-y-3">
                        <p className="text-4xl font-black font-mono tracking-widest text-foreground">{purchasedCard.cardID}</p>
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

      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 z-[10002] bg-white dark:bg-slate-900 border-none shadow-2xl outline-none">
            <DialogHeader>
                <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="text-primary h-6 w-6" />
                </div>
                <DialogTitle className="text-center text-xl font-black">ارسال كرت لزبون</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-6">
                <div className="space-y-2 text-right">
                    <Label htmlFor="sms-phone" className="text-[10px] font-black text-muted-foreground pr-1 uppercase tracking-widest">رقم جوال الزبون</Label>
                    <Input 
                        id="sms-phone"
                        placeholder="7xxxxxxxx" 
                        type="tel" 
                        value={smsRecipient} 
                        onChange={e => setSmsRecipient(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                        className="text-center text-2xl font-black h-14 rounded-2xl border-2 tracking-widest bg-muted/20" 
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
