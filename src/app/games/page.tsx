'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Wallet, 
  Loader2, 
  User,
  Gamepad2,
  Zap,
  ShieldCheck,
  Star,
  AlertCircle,
  Hash,
  Calendar,
  History,
  ChevronLeft,
  Gem,
  Trophy,
  Database,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, increment, collection as firestoreCollection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import Image from 'next/image';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type GameOffer = {
    amount: string;
    price: number;
    code: string;
    description?: string;
};

const PUBG_PACKAGES: GameOffer[] = [
    { amount: '10 شدة', price: 500, code: '10' },
    { amount: '60 شدة', price: 1800, code: '60' },
    { amount: '325 شدة', price: 8000, code: '325' },
    { amount: '385 شدة', price: 9000, code: '385' },
    { amount: '660 شدة', price: 15000, code: '660' },
    { amount: '720 شدة', price: 17500, code: '720' },
    { amount: '1800 شدة', price: 39000, code: '1800' },
];

const FF_PACKAGES: GameOffer[] = [
    { amount: '100 جوهرة', price: 2000, code: '100' },
    { amount: '210 جوهرة', price: 3500, code: '210' },
    { amount: '530 جوهرة', price: 8000, code: '530' },
    { amount: 'عضوية اسبوعية', price: 1500, code: 'weekly' },
    { amount: 'عضوية شهرية', price: 6500, code: 'monthly' },
    { amount: 'بوياه باس', price: 2200, code: 'booyah' },
    { amount: '1080 جوهرة', price: 16500, code: '1080' },
    { amount: '2200 جوهرة', price: 32000, code: '2200' },
];

const GAMES = [
    { id: 'pubg', name: 'ببجي موبايل', icon: 'https://i.postimg.cc/XYP5H9vQ/2J2L4wpmxzn-Xwg-CUwx-IV9y-L9w2NGG9RQd3I1Bu-KW.png', banner: 'https://i.postimg.cc/K8pPdgWg/112750758-whatsubject.jpg' },
    { id: 'freefire', name: 'فري فاير', icon: 'https://i.postimg.cc/Pqdhw9QC/R.png', banner: 'https://i.postimg.cc/xTqXkJ1Q/2024-Free-Fire.jpg' }
];

export default function GamesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const [activeGame, setActiveGame] = useState<'pubg' | 'freefire' | null>(null);
    const [selectedOffer, setSelectedOffer] = useState<GameOffer | null>(null);
    const [playerId, setPlayerId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTransid, setLastTransid] = useState('');
    const [lastTotalAmount, setLastTotalAmount] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userProfile } = useDoc<any>(userDocRef);

    useEffect(() => {
        if (showSuccess && audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        }
    }, [showSuccess]);

    const handlePurchase = async () => {
        if (!selectedOffer || !playerId || !user || !userDocRef || !firestore || !activeGame) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى إدخال رقم اللاعب.' });
            return;
        }

        const totalToDeduct = selectedOffer.price;

        if ((userProfile?.balance ?? 0) < totalToDeduct) {
            toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام هذه العملية.' });
            return;
        }

        setIsProcessing(true);
        try {
            const transid = Date.now().toString().slice(-8);
            setLastTransid(transid);
            setLastTotalAmount(totalToDeduct);
            
            const response = await fetch('/api/telecom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    service: 'games',
                    type: activeGame,
                    uniqcode: selectedOffer.code,
                    playerid: playerId,
                    mobile: userProfile?.phoneNumber || '000',
                    transid: transid 
                })
            });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || result.resultDesc || 'فشل تنفيذ الطلب من المصدر.');
            }

            const isSuccess = result.resultCode === "0" || result.resultCode === 0;
            const isPending = result.resultCode === "-2" || result.resultCode === -2;

            if (!isSuccess && !isPending) {
                throw new Error(result.resultDesc || 'تم رفض العملية من قبل مزود الخدمة.');
            }

            const batch = writeBatch(firestore);
            batch.update(userDocRef, { balance: increment(-totalToDeduct) });
            batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
                userId: user.uid, 
                transactionDate: new Date().toISOString(), 
                amount: totalToDeduct,
                transactionType: `شحن ${activeGame === 'pubg' ? 'شدات' : 'جواهر'}: ${selectedOffer.amount}`, 
                notes: `رقم اللاعب: ${playerId}. اللعبة: ${activeGame === 'pubg' ? 'ببجي' : 'فري فاير'}`, 
                recipientPhoneNumber: playerId,
                transid: transid
            });
            await batch.commit();
            
            setShowSuccess(true);
        } catch (e: any) {
            toast({ 
                variant: "destructive", 
                title: "فشل في عملية الشحن", 
                description: e.message 
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="flex flex-col h-full bg-background">
                <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/10/13/audio_a141b2c45e.mp3" preload="auto" />
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in-0 p-4">
                    <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                        <div className="bg-green-500 p-8 flex justify-center">
                            <div className="bg-white/20 p-4 rounded-full animate-bounce">
                                <CheckCircle className="h-16 w-16 text-white" />
                            </div>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-green-600">تم الشحن بنجاح</h2>
                                <p className="text-sm text-muted-foreground mt-1">وصلت الطلبية لحساب اللاعب</p>
                            </div>

                            <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> رقم العملية:</span>
                                    <span className="font-mono font-black text-primary">{lastTransid}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Trophy className="w-3.5 h-3.5" /> اللعبة:</span>
                                    <span className="font-bold">{activeGame === 'pubg' ? 'ببجي موبايل' : 'فري فاير'}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> فئة الشحن:</span>
                                    <span className="font-bold">{selectedOffer?.amount}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><User className="w-3.5 h-3.5" /> رقم اللاعب (ID):</span>
                                    <span className="font-mono font-bold tracking-widest">{playerId}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-muted pb-2">
                                    <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المخصوم:</span>
                                    <span className="font-black text-primary">{lastTotalAmount.toLocaleString('en-US')} ريال</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span>
                                    <span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => router.push('/login')}>الرئيسية</Button>
                                <Button className="rounded-2xl h-12 font-bold" onClick={() => router.push('/transactions')}>
                                    <History className="ml-2 h-4 w-4" /> العمليات
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const currentPackages = activeGame === 'pubg' ? PUBG_PACKAGES : FF_PACKAGES;
    const currentGameInfo = GAMES.find(g => g.id === activeGame);

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            {isProcessing && <ProcessingOverlay message="جاري معالجة طلبك..." />}
            
            <SimpleHeader title={activeGame ? (activeGame === 'pubg' ? 'شدات ببجي' : 'جواهر فري فاير') : 'معرض الألعاب'} />
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {!activeGame ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="text-center space-y-2 mb-2">
                            <div className="bg-primary/10 w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-4 border border-primary/5 shadow-inner">
                                <Gamepad2 className="h-8 w-8 text-primary" />
                            </div>
                            <h1 className="text-xl font-black text-foreground">متجر شحن الألعاب</h1>
                            <p className="text-xs text-muted-foreground font-bold">اختر لعبتك المفضلة وابدأ الشحن فوراً</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {GAMES.map((game) => (
                                <Card 
                                    key={game.id} 
                                    className="cursor-pointer overflow-hidden rounded-[32px] border-none shadow-lg active:scale-[0.98] transition-all group"
                                    onClick={() => setActiveGame(game.id as any)}
                                >
                                    <div className="relative h-48 w-full">
                                        <Image src={game.banner} alt={game.name} fill className="object-cover transition-transform group-hover:scale-105 duration-700" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                                            <div className="flex items-center gap-4 w-full">
                                                <div className="relative h-14 w-14 rounded-2xl overflow-hidden border-2 border-white shadow-xl shrink-0">
                                                    <Image src={game.icon} alt={game.name} fill className="object-cover" />
                                                </div>
                                                <div className="flex-1 text-right">
                                                    <h3 className="text-xl font-black text-white">{game.name}</h3>
                                                    <p className="text-xs text-white/70 font-bold">شحن مباشر وسريع</p>
                                                </div>
                                                <div className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                                                    <ChevronLeft className="h-5 w-5 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in-0 duration-500 pb-10">
                        {/* Game Banner Header */}
                        <Card className="overflow-hidden rounded-[32px] shadow-xl border-none h-48 relative">
                            <Image 
                                src={currentGameInfo?.banner || ''} 
                                alt={currentGameInfo?.name || ''} 
                                fill 
                                className="object-cover" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                                <div className="flex justify-between items-center w-full">
                                    <div className="text-right">
                                        <h2 className="text-xl font-black text-white">{currentGameInfo?.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                            <p className="text-[10px] font-bold text-white/80">شحن فوري متاح</p>
                                        </div>
                                    </div>
                                    <div className="text-left bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                                        <p className="text-[8px] font-bold text-white/70 uppercase">رصيدك</p>
                                        <p className="text-base font-black text-white">{userProfile?.balance?.toLocaleString() || '0'} ر.ي</p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">اختر فئة الشحن</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {currentPackages.map((pkg) => (
                                    <Card 
                                        key={pkg.code} 
                                        className="cursor-pointer hover:bg-primary/5 transition-all active:scale-[0.98] border-none shadow-sm rounded-3xl overflow-hidden group"
                                        onClick={() => setSelectedOffer(pkg)}
                                    >
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="relative h-12 w-12 shrink-0 rounded-2xl overflow-hidden bg-muted p-1 group-hover:scale-110 transition-transform">
                                                    <Image 
                                                        src={currentGameInfo?.icon || ''}
                                                        alt="Icon"
                                                        fill
                                                        className="object-contain"
                                                    />
                                                </div>
                                                <div className="text-right">
                                                    <h4 className="font-black text-sm text-foreground">{pkg.amount}</h4>
                                                    <p className="text-[10px] font-bold text-muted-foreground">تفعيل فوري</p>
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <div className="flex items-baseline gap-1 justify-end">
                                                    <span className="text-lg font-black text-primary">{pkg.price.toLocaleString('en-US')}</span>
                                                    <span className="text-[10px] font-bold text-primary opacity-70">ر.ي</span>
                                                </div>
                                                <Button size="sm" className="h-7 rounded-lg text-[10px] font-black px-4 mt-1">شراء</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Toaster />

            <Dialog open={!!selectedOffer && !showSuccess} onOpenChange={() => setSelectedOffer(null)}>
                <DialogContent className="rounded-[32px] max-w-sm border-none shadow-2xl overflow-hidden p-0">
                    <div className="bg-mesh-gradient p-8 text-center relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
                        <div className="relative w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl">
                            <Image 
                                src={currentGameInfo?.icon || ''}
                                alt="Icon"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <h3 className="text-white font-black text-xl drop-shadow-md">تأكيد عملية الشحن</h3>
                        <p className="text-white/70 text-xs font-bold mt-1 uppercase tracking-widest">{selectedOffer?.amount}</p>
                    </div>
                    
                    <div className="p-6 space-y-6 bg-card">
                        <div className="space-y-2">
                            <Label htmlFor="playerid" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم اللاعب (Player ID)</Label>
                            <div className="relative">
                                <Input 
                                    id="playerid"
                                    placeholder="أدخل الـ ID الخاص بك" 
                                    type="tel"
                                    value={playerId} 
                                    onChange={e => setPlayerId(e.target.value.replace(/\D/g, ''))}
                                    className="rounded-2xl h-14 text-center text-2xl font-black border-none bg-muted/20 focus-visible:ring-primary tracking-widest"
                                />
                                <User className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-30" />
                            </div>
                        </div>

                        <div className="bg-muted/50 p-5 rounded-[28px] border-2 border-dashed border-primary/10 space-y-2 text-center">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">المبلغ المخصوم من رصيدك</p>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-3xl font-black text-primary">{selectedOffer?.price.toLocaleString('en-US')}</span>
                                <span className="text-xs font-bold text-primary/70">ريال</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button className="h-12 rounded-2xl font-black text-base shadow-xl shadow-primary/20" onClick={handlePurchase} disabled={isProcessing || !playerId}>
                                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد وشحن'}
                            </Button>
                            <Button variant="outline" className="h-12 rounded-2xl font-bold" onClick={() => setSelectedOffer(null)}>إلغاء</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
