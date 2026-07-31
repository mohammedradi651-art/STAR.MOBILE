'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Banknote, 
    User as UserIcon, 
    Wallet, 
    Send, 
    Building, 
    CheckCircle, 
    Loader2, 
    ChevronLeft, 
    ArrowUpFromLine,
    ShieldCheck,
    CreditCard,
    Smartphone
} from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, writeBatch, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

export const dynamic = 'force-dynamic';

type UserProfile = {
  displayName?: string;
  phoneNumber?: string;
  balance?: number;
};

type PaymentMethod = {
    id: string;
    name: string;
    logoUrl?: string;
    accountHolderName: string;
    accountNumber: string;
};

const getLogoSrc = (url?: string) => {
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      return url;
    }
    return 'https://placehold.co/100x100/e2e8f0/e2e8f0'; 
};

export default function WithdrawPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const audioRef = useRef<HTMLAudioElement>(null);

    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [recipientName, setRecipientName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [amount, setAmount] = useState('');
    
    const [isConfirming, setIsConfirming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const userDocRef = useMemoFirebase(
      () => (user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const methodsCollection = useMemoFirebase(
        () => (firestore ? collection(firestore, 'paymentMethods') : null),
        [firestore]
    );
    const { data: withdrawalMethods, isLoading: isLoadingMethods } = useCollection<PaymentMethod>(methodsCollection);
    
    useEffect(() => {
        if (!selectedMethod && withdrawalMethods && withdrawalMethods.length > 0) {
            setSelectedMethod(withdrawalMethods[0]);
        }
    }, [withdrawalMethods, selectedMethod]);
    
    const isLoading = isUserLoading || isProfileLoading || isLoadingMethods;
    const numericAmount = parseFloat(amount);
    const userBalance = userProfile?.balance ?? 0;
    const isAmountInvalid = isNaN(numericAmount) || numericAmount <= 0;
    const isBalanceInsufficient = numericAmount > userBalance;
    const isButtonDisabled = isAmountInvalid || isBalanceInsufficient || !recipientName || !accountNumber || !selectedMethod;

    const handleConfirmRequest = () => {
        if (!selectedMethod || !recipientName || !accountNumber || isAmountInvalid) {
            toast({ variant: "destructive", title: "بيانات غير مكتملة", description: "الرجاء تعبئة جميع الحقول بشكل صحيح." });
            return;
        }
        if (isBalanceInsufficient) {
            toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "رصيدك الحالي لا يكفي لطلب هذا المبلغ." });
            return;
        }
        setIsConfirming(true);
    };

    const handleFinalConfirmation = async () => {
        if (!user || !userProfile || !selectedMethod || !firestore || isProcessing || isAmountInvalid || !userProfile.displayName || !userProfile.phoneNumber || !userDocRef) return;

        setIsProcessing(true);

        const requestData = {
            ownerId: user.uid,
            ownerName: userProfile.displayName,
            ownerPhoneNumber: userProfile.phoneNumber,
            amount: numericAmount,
            paymentMethodName: selectedMethod.name,
            paymentMethodLogo: selectedMethod.logoUrl || '',
            recipientName,
            accountNumber,
            status: 'pending',
            requestTimestamp: new Date().toISOString()
        };

        try {
            const requestsCollection = collection(firestore, 'withdrawalRequests');
            await addDocumentNonBlocking(requestsCollection, requestData);

            setShowSuccess(true);
            audioRef.current?.play().catch(() => {});
        } catch (error) {
            console.error("Failed to create withdrawal request:", error);
            toast({ variant: "destructive", title: "خطأ", description: "فشل إنشاء طلب السحب. الرجاء المحاولة لاحقاً." });
        } finally {
            setIsProcessing(false);
            setIsConfirming(false);
        }
    };
    
    if (showSuccess) {
      return (
        <div className="fixed inset-0 bg-background z-[100] flex items-center justify-center animate-in fade-in-0 p-4">
            <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
            <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                <div className="bg-green-500 p-8 flex justify-center">
                    <div className="bg-white/20 p-4 rounded-full animate-bounce">
                        <CheckCircle className="h-16 w-16 text-white" />
                    </div>
                </div>
                <CardContent className="p-8 space-y-6">
                    <div>
                        <h2 className="text-2xl font-black text-green-600">تم إرسال الطلب</h2>
                        <p className="text-sm text-muted-foreground mt-1">سيتم مراجعة طلب السحب من قبل الإدارة</p>
                    </div>

                    <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2"><Banknote className="w-3.5 h-3.5" /> المبلغ المطلوب:</span>
                            <span className="font-black text-primary text-base">{numericAmount.toLocaleString('en-US')} ر.ي</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2"><Building className="w-3.5 h-3.5" /> الوسيلة:</span>
                            <span className="font-bold">{selectedMethod?.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> الاسم:</span>
                            <span className="font-bold truncate max-w-[120px]">{recipientName}</span>
                        </div>
                    </div>

                    <Button 
                        className="w-full h-14 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform" 
                        onClick={() => router.push('/my-network')}
                    >
                        العودة للرئيسية
                    </Button>
                </CardContent>
            </Card>
        </div>
      );
    }

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            {isProcessing && <ProcessingOverlay message="جاري إرسال طلبك..." />}
            <SimpleHeader title="سحب الأرباح" />
            
            <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
                {/* Hero Section */}
                <div className="bg-mesh-gradient pt-6 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex flex-col items-center text-center space-y-4">
                        <div className="bg-white/20 p-3 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                            <ArrowUpFromLine className="h-8 w-8 text-white" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-white tracking-tight">تحويل أرباحك</h2>
                            <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">اسحب رصيدك المتوفر إلى حسابك البنكي</p>
                        </div>
                    </div>
                </div>

                <div className="px-4 space-y-8">
                    {/* Balance Card */}
                    <Card className="overflow-hidden rounded-[32px] shadow-xl border-none bg-white dark:bg-slate-900 -mt-16 relative z-10 mx-2">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">إجمالي الأرباح المتاحة</p>
                                <div className="flex items-baseline gap-1">
                                    <h2 className="text-3xl font-black text-primary">
                                        {isLoading ? <Skeleton className="h-8 w-24 rounded-lg" /> : userBalance.toLocaleString('en-US')}
                                    </h2>
                                    <span className="text-[10px] font-bold text-primary opacity-70">ريال يمني</span>
                                </div>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/5 shadow-inner">
                                <Wallet className="h-7 w-7 text-primary" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Methods */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg">1</div>
                            <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">اختر طريقة الاستلام</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {isLoadingMethods ? (
                                <>
                                    <Skeleton className="h-36 w-full rounded-[32px]" />
                                    <Skeleton className="h-36 w-full rounded-[32px]" />
                                </>
                            ) : (
                                withdrawalMethods?.map((method) => (
                                    <div
                                        key={method.id}
                                        onClick={() => setSelectedMethod(method)}
                                        className={cn(
                                            "group flex flex-col items-center justify-center space-y-3 rounded-[32px] p-4 aspect-square cursor-pointer transition-all duration-300 border-2 relative overflow-hidden",
                                            selectedMethod?.id === method.id 
                                                ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10 scale-[1.02]' 
                                                : 'border-transparent bg-white dark:bg-slate-900 shadow-sm hover:border-primary/20'
                                        )}
                                    >
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden relative shadow-sm border border-muted-foreground/10 bg-white p-1">
                                            <Image 
                                                src={getLogoSrc(method.logoUrl)} 
                                                alt={method.name} 
                                                fill
                                                className="object-contain" 
                                            />
                                        </div>
                                        <p className={cn(
                                            "text-center text-[11px] font-black transition-colors",
                                            selectedMethod?.id === method.id ? "text-primary" : "text-foreground/70"
                                        )}>{method.name}</p>
                                        
                                        {selectedMethod?.id === method.id && (
                                            <div className="absolute top-3 left-3 animate-in zoom-in-50 duration-300">
                                                <CheckCircle className="w-4 h-4 text-primary fill-primary/10" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Details Card */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg">2</div>
                            <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">تفاصيل السحب</h3>
                        </div>

                        <Card className="rounded-[36px] border-none shadow-lg bg-white dark:bg-slate-900">
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="recipientName" className="text-[10px] font-black text-muted-foreground pr-1 uppercase tracking-widest">اسم المستلم الرباعي</Label>
                                    <div className="relative group">
                                        <Input 
                                            id="recipientName" 
                                            value={recipientName} 
                                            onChange={e => setRecipientName(e.target.value)} 
                                            placeholder="اكتب الاسم كما في الحساب" 
                                            className="h-12 bg-muted/20 border border-primary/5 rounded-2xl pr-11 font-bold focus-visible:ring-0 focus-visible:border-primary/40 transition-colors text-right"
                                        />
                                        <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="accountNumber" className="text-[10px] font-black text-muted-foreground pr-1 uppercase tracking-widest">رقم الحساب</Label>
                                    <div className="relative group">
                                        <Input 
                                            id="accountNumber" 
                                            type="tel"
                                            value={accountNumber} 
                                            onChange={e => setAccountNumber(e.target.value)} 
                                            placeholder="أدخل رقم الحساب أو الجوال" 
                                            className="h-12 bg-muted/20 border border-primary/5 rounded-2xl pr-11 text-right font-bold font-mono tracking-wider focus-visible:ring-0 focus-visible:border-primary/40 transition-colors"
                                        />
                                        <Building className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center pr-1">
                                        <Label htmlFor="amount" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">المبلغ المراد سحبه</Label>
                                        {isBalanceInsufficient && <span className="text-[9px] font-black text-destructive animate-pulse">رصيد غير كافٍ!</span>}
                                    </div>
                                    <div className="relative group">
                                        <Input 
                                            id="amount" 
                                            type="number" 
                                            value={amount} 
                                            onChange={e => setAmount(e.target.value)} 
                                            placeholder="0.00" 
                                            className={cn(
                                                "h-12 bg-muted/20 border border-primary/5 rounded-2xl pr-11 font-bold text-right transition-all focus-visible:ring-0 focus-visible:border-primary/40",
                                                isBalanceInsufficient ? "text-destructive border-destructive/20 focus-visible:border-destructive/40" : "text-foreground"
                                            )}
                                        />
                                        <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="pt-4">
                        <Button 
                            className="w-full h-14 rounded-3xl text-lg font-black bg-mesh-gradient text-white shadow-xl shadow-primary/20 active:scale-95 transition-all border-none"
                            onClick={handleConfirmRequest} 
                            disabled={isButtonDisabled}
                        >
                            <Send className="ml-2 h-5 w-5" />
                            تأكيد وإرسال الطلب
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground font-bold mt-4 opacity-60">تخضع جميع الطلبات للمراجعة والتدقيق الأمني</p>
                    </div>
                </div>
            </div>

            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-mesh-gradient p-8 text-center text-white relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-center font-black text-2xl text-white drop-shadow-md">مراجعة طلب السحب</AlertDialogTitle>
                        </AlertDialogHeader>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="bg-muted/50 rounded-[28px] p-6 space-y-4 text-sm">
                            <div className="flex justify-between items-center border-b border-dashed border-muted-foreground/20 pb-3">
                                <span className="text-muted-foreground font-bold flex items-center gap-2"><CreditCard className="w-4 h-4" /> الوسيلة:</span>
                                <span className="font-black text-foreground">{selectedMethod?.name}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-dashed border-muted-foreground/20 pb-3">
                                <span className="text-muted-foreground font-bold flex items-center gap-2"><UserIcon className="w-4 h-4" /> الاسم:</span>
                                <span className="font-black text-foreground">{recipientName}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="font-black text-primary text-base">المبلغ النهائي:</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="font-black text-primary text-2xl">{numericAmount.toLocaleString()}</span>
                                    <span className="text-[10px] font-bold text-primary">ر.ي</span>
                                </div>
                            </div>
                        </div>

                        <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                            <AlertDialogAction 
                                onClick={handleFinalConfirmation} 
                                className="w-full rounded-2xl h-12 font-black shadow-lg"
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Loader2 className="animate-spin" /> : 'تأكيد السحب'}
                            </AlertDialogAction>
                            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-bold" disabled={isProcessing}>تراجع</AlertDialogCancel>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            <Toaster />
        </div>
    );
}
