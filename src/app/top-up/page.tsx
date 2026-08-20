'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where, getDocs, limit, writeBatch, increment } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Copy, 
    Wallet, 
    CheckCircle2,
    Loader2,
    Smartphone,
    CheckCircle,
    Zap,
    Calendar,
    Clock,
    ShieldCheck,
    CreditCard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Lottie from 'lottie-react';

export const dynamic = 'force-dynamic';

type PaymentMethod = {
  id: string;
  name: string;
  accountHolderName: string;
  accountNumber: string;
  logoUrl?: string;
};

type UserProfile = {
    id: string;
    displayName?: string;
    phoneNumber?: string;
    balance?: number;
};

const TopUpMovingLoader = () => {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    fetch('/TH.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Lottie load error:", err));
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/10 backdrop-blur-[2px] pointer-events-auto animate-in fade-in duration-300">
      <div className="relative w-32 h-32 flex items-center justify-center overflow-hidden animate-in zoom-in-95 duration-500">
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

const getLogoSrc = (url?: string) => {
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      return url;
    }
    return 'https://placehold.co/100x100/e2e8f0/e2e8f0'; 
};

export default function TopUpPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const router = useRouter();
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [alomqyAccount, setAlomqyAccount] = useState('');
    const [kuraimiReference, setKuraimiReference] = useState('');
    const [bankAmount, setBankAmount] = useState('');
    const [isVerifyingBank, setIsVerifyingBank] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastTxDetails, setLastTxDetails] = useState<any>(null);

    const userDocRef = useMemoFirebase(
      () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);
    
    const methodsCollection = useMemoFirebase(
        () => (firestore ? collection(firestore, 'paymentMethods') : null),
        [firestore]
    );
    const { data: paymentMethods, isLoading: isLoadingMethods } = useCollection<PaymentMethod>(methodsCollection);

    const getFirstLast = (name?: string) => {
        if (!name) return 'عميلنا';
        const parts = name.trim().split(/\s+/);
        if (parts.length <= 1) return name;
        return `${parts[0]} ${parts[parts.length - 1]}`;
    };

    useEffect(() => {
        if (!selectedMethod && paymentMethods && paymentMethods.length > 0) {
            setSelectedMethod(paymentMethods[0]);
        }
    }, [paymentMethods, selectedMethod]);

    const handleCopy = (accountNumber: string) => {
        navigator.clipboard.writeText(accountNumber);
        toast({ title: "تم النسخ" });
    };

    const handleConfirmBankDeposit = async (bankType: 'alomqy' | 'kuraimi' | 'amjad') => {
        if (!bankAmount || !firestore || !userProfile || !userDocRef) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء إدخال كافة البيانات المطلوبة.' });
            return;
        }

        const amt = parseFloat(bankAmount);
        setIsVerifyingBank(true);
        try {
            const notifsRef = collection(firestore, 'bankNotifications');
            let q;
            
            if (bankType === 'alomqy') {
                q = query(notifsRef, 
                    where('bank', '==', 'alomqy'),
                    where('account', '==', alomqyAccount.trim()), 
                    where('amount', '==', amt),
                    where('status', '==', 'unpaid'),
                    limit(1)
                );
            } else if (bankType === 'kuraimi') {
                q = query(notifsRef, 
                    where('bank', '==', 'kuraimi'),
                    where('reference', '==', kuraimiReference.trim()), 
                    where('amount', '==', amt),
                    where('status', '==', 'unpaid'),
                    limit(1)
                );
            } else {
                q = query(notifsRef,
                    where('bank', '==', 'amjad'),
                    where('amount', '==', amt),
                    where('senderName', '==', userProfile.displayName?.trim()),
                    where('status', '==', 'unpaid'),
                    limit(1)
                );
            }
            
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ 
                    variant: 'destructive', 
                    title: 'لم يتم العثور على الإيداع', 
                    description: bankType === 'amjad' 
                        ? 'عذراً، لم نجد حوالة مطابقة لاسمك ومبلغك في النظام.'
                        : 'نعتذر، لم يتم العثور على إيصال مطابق للعملية في النظام.' 
                });
            } else {
                const notifDoc = querySnapshot.docs[0];
                const notifData = notifDoc.data();
                
                const batch = writeBatch(firestore);
                const now = new Date().toISOString();

                batch.update(userDocRef, { balance: increment(notifData.amount) });
                batch.update(notifDoc.ref, { status: 'paid', paidTo: userProfile.id, paidAt: now });

                const txRef = doc(collection(firestore, `users/${userProfile.id}/transactions`));
                batch.set(txRef, {
                    userId: userProfile.id,
                    transactionDate: now,
                    amount: notifData.amount,
                    transactionType: `تغذية آلي - ${bankType === 'alomqy' ? 'العمقي' : bankType === 'kuraimi' ? 'الكريمي' : 'بنك أمجاد'}`,
                    notes: `مطابقة آلية. الوسيلة: ${selectedMethod?.name}`,
                    status: 'success'
                });

                await batch.commit();

                // إرسال رسالة التبليغ بصيغة المستخدم الجديدة
                if (userProfile.phoneNumber) {
                    const currentBalance = (userProfile.balance || 0) + notifData.amount;
                    const shortName = getFirstLast(userProfile.displayName);
                    
                    const smsMessage = `ستار موبايل\nمرحباً ${shortName}،\nتم ايداع مبلغ ${notifData.amount.toLocaleString('en-US')} ريال إلى حسابك\n\nالرصيد الحالي: ${currentBalance.toLocaleString('en-US')} ريال`;
                    
                    fetch('/api/sms', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ 
                            phoneNumber: userProfile.phoneNumber.trim(), 
                            message: smsMessage 
                        }) 
                    }).catch(e => console.error("SMS Confirmation Error:", e));
                }

                setLastTxDetails({
                    account: bankType === 'alomqy' ? alomqyAccount : bankType === 'kuraimi' ? kuraimiReference : 'مطابقة بالاسم',
                    amount: notifData.amount,
                    date: now,
                    bank: bankType
                });
                
                setShowSuccess(true);
                audioRef.current?.play().catch(() => {});
            }
        } catch (error: any) {
            console.error("Bank Deposit Processing Error:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'حدث خطأ تقني.' });
        } finally {
            setIsVerifyingBank(false);
        }
    };

    const methodName = selectedMethod?.name || '';
    const isAlOmqy = methodName.includes('العمقي');
    const isKuraimi = methodName.includes('الكريمي');
    const isAmjad = methodName.includes('امجاد') || methodName.includes('أمجاد');

    if (showSuccess && lastTxDetails) {
        return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px] animate-in fade-in-0 duration-500">
                <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
                <Card className="w-full max-w-[340px] text-center shadow-[0_30px_90px_rgba(0,0,0,0.15)] rounded-[40px] overflow-hidden border border-white bg-white animate-in zoom-in-95">
                    <div className="bg-green-50/50 p-8 flex justify-center border-b border-green-100/50">
                        <div className="bg-green-500/10 p-4 rounded-full">
                            <CheckCircle className="h-12 w-12 text-green-500 animate-bounce" />
                        </div>
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <p className="text-base font-black text-foreground/80 leading-relaxed">
                                تم اضافة مبلغ <span className="text-green-600 underline underline-offset-4">{lastTxDetails.amount.toLocaleString()}</span> في حسابك بنجاح
                            </p>
                        </div>
                        <Button 
                            className="w-full h-12 rounded-2xl font-black bg-mesh-gradient text-white shadow-lg active:scale-95 transition-transform border-none" 
                            onClick={() => router.push('/login')}
                        >
                            حسناً
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="تغذية الحساب" />
            
            {isVerifyingBank && <TopUpMovingLoader />}

            <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
                
                <div className="bg-mesh-gradient pt-4 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-6">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex flex-col items-center text-center space-y-3">
                        <div className="relative w-20 h-20 mb-2">
                            <div className="absolute inset-0 bg-white/20 rounded-[30px] blur-xl animate-pulse" />
                            <div className="relative w-full h-full overflow-hidden rounded-[26px] border-4 border-white/30 shadow-2xl bg-white p-1">
                                <Image 
                                    src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                                    alt="Star Mobile Logo" 
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">تغذية حسابي</h2>
                        <div className="bg-white/10 backdrop-blur-md px-10 py-2.5 rounded-full border border-white/10 shadow-inner">
                            <p className="text-[16px] text-white font-black uppercase tracking-[0.1em]">عبر البنوك وشبكات الصرافة</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 pb-10">
                    <div className="px-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {isLoadingMethods ? (
                                [1, 2].map(i => <div key={i} className="h-32 rounded-[32px] bg-muted animate-pulse" />)
                            ) : (
                                paymentMethods?.map(method => (
                                    <div 
                                        key={method.id} 
                                        onClick={() => setSelectedMethod(method)} 
                                        className={cn(
                                            "group flex flex-col items-center justify-center space-y-3 rounded-[32px] p-5 aspect-square cursor-pointer transition-all duration-500 border-2 relative overflow-hidden shadow-sm", 
                                            selectedMethod?.id === method.id 
                                                ? 'border-[#0048ad] bg-primary/5 shadow-xl shadow-primary/10 scale-[1.03]' 
                                                : 'border-transparent bg-white dark:bg-slate-900 hover:border-primary/20'
                                        )}
                                    >
                                        <div className="w-16 h-16 rounded-[22px] relative shadow-md overflow-hidden bg-white p-1 border border-muted">
                                            <Image src={getLogoSrc(method.logoUrl)} alt={method.name} fill className="object-contain" />
                                        </div>
                                        <p className={cn(
                                            "text-center text-[11px] font-black transition-colors truncate w-full", 
                                            selectedMethod?.id === method.id ? "text-[#0048ad]" : "text-foreground/70"
                                        )}>
                                            {method.name}
                                        </p>
                                        {selectedMethod?.id === method.id && (
                                            <div className="absolute top-3 left-3 animate-in zoom-in-50 duration-300">
                                                <CheckCircle2 className="w-5 h-5 text-[#0048ad] fill-primary/10" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {selectedMethod && (
                        <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 px-4">
                            
                            <div className="bg-mesh-gradient py-6 px-8 rounded-[48px] border-2 border-dashed border-white/20 flex flex-col items-center gap-3 text-white shadow-2xl w-full text-center">
                                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">حول إلى هذا الحساب</p>
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl font-black font-mono tracking-widest text-white drop-shadow-lg">{selectedMethod.accountNumber}</span>
                                    <button 
                                        onClick={() => handleCopy(selectedMethod.accountNumber)} 
                                        className="p-2.5 bg-white/20 text-white rounded-xl shadow-xl active:scale-90 transition-transform backdrop-blur-md border border-white/10"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="bg-white/15 px-6 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
                                    <p className="text-[12px] font-black text-white uppercase tracking-tight">باسم: {selectedMethod.accountHolderName}</p>
                                </div>
                            </div>

                            <div className="px-0">
                                {(isAlOmqy || isKuraimi || isAmjad) && (
                                    <div className="space-y-8 pt-4 animate-in fade-in duration-500">
                                        <div className="grid grid-cols-2 gap-5">
                                            {!isAmjad && (
                                                <div className="space-y-2 text-right">
                                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">
                                                        {isAlOmqy ? 'حسابك بالعمقي' : 'رقم المرجع'}
                                                    </Label>
                                                    <Input 
                                                        value={isAlOmqy ? alomqyAccount : kuraimiReference} 
                                                        onChange={e => isAlOmqy ? setAlomqyAccount(e.target.value.replace(/\D/g, '')) : setKuraimiReference(e.target.value.replace(/\D/g, ''))} 
                                                        placeholder={isAlOmqy ? "25******" : "الرقم"} 
                                                        className="h-14 bg-primary/5 border-2 border-solid border-[#0048ad]/40 rounded-2xl text-center font-black text-lg focus-visible:ring-0 placeholder:text-primary/20 tracking-widest w-full shadow-inner"
                                                        style={{ direction: 'ltr' }}
                                                    />
                                                </div>
                                            )}

                                            <div className={cn("space-y-2 text-right", isAmjad ? "col-span-2" : "col-span-1")}>
                                                <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">المبلغ المودع</Label>
                                                <Input 
                                                    type="number" 
                                                    value={bankAmount} 
                                                    onChange={e => setBankAmount(e.target.value)} 
                                                    placeholder="0.00" 
                                                    className="h-14 bg-primary/5 border-2 border-solid border-[#0048ad]/40 rounded-2xl text-center font-black text-xl text-[#0048ad] placeholder:text-[#0048ad]/10 w-full shadow-inner" 
                                                />
                                            </div>
                                        </div>

                                        <Button 
                                            onClick={() => handleConfirmBankDeposit(isAlOmqy ? 'alomqy' : isKuraimi ? 'kuraimi' : 'amjad')} 
                                            disabled={isVerifyingBank} 
                                            className="w-full h-14 rounded-3xl bg-[#0048ad] hover:bg-[#003a8c] text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all border-none"
                                        >
                                            {isVerifyingBank ? (
                                                <Loader2 className="animate-spin h-6 w-6" />
                                            ) : (
                                                "اضافة المبلغ الى حسابي"
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {!isAlOmqy && !isKuraimi && !isAmjad && (
                                    <div className="pt-4">
                                        <Button 
                                            onClick={() => window.open(`https://api.whatsapp.com/send?phone=967770326828`, '_blank')} 
                                            className="w-full h-14 rounded-3xl bg-mesh-gradient text-white font-black text-lg shadow-2xl active:scale-95 transition-all border-none"
                                        >
                                            أرسل الإيصال عبر واتساب
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <Toaster />
        </div>
    );
}
