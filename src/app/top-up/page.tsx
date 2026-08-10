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
    CircleDollarSign,
    CheckCircle2,
    Loader2,
    Smartphone,
    CheckCircle,
    Building2,
    CreditCard,
    Zap,
    Hash,
    Clock,
    MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

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

    useEffect(() => {
        if (!selectedMethod && paymentMethods && paymentMethods.length > 0) {
            setSelectedMethod(paymentMethods[0]);
        }
    }, [paymentMethods, selectedMethod]);

    const handleCopy = (accountNumber: string) => {
        navigator.clipboard.writeText(accountNumber);
        toast({ title: "تم النسخ", description: "تم نسخ رقم الحساب بنجاح." });
    };

    const handleConfirmBankDeposit = async (bankType: 'alomqy' | 'kuraimi') => {
        if (!bankAmount || !firestore || !userProfile || !userDocRef) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء إدخال كافة البيانات المطلوبة.' });
            return;
        }

        if (bankType === 'alomqy' && !alomqyAccount) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء إدخال رقم حسابك في العمقي.' });
            return;
        }

        if (bankType === 'kuraimi' && !kuraimiReference) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء إدخال رقم المرجع.' });
            return;
        }

        setIsVerifyingBank(true);
        try {
            const notifsRef = collection(firestore, 'bankNotifications');
            let q;
            
            if (bankType === 'alomqy') {
                q = query(notifsRef, 
                    where('bank', '==', 'alomqy'),
                    where('account', '==', alomqyAccount.trim()), 
                    where('amount', '==', parseFloat(bankAmount)),
                    where('status', '==', 'unpaid'),
                    limit(1)
                );
            } else {
                q = query(notifsRef, 
                    where('bank', '==', 'kuraimi'),
                    where('reference', '==', kuraimiReference.trim()), 
                    where('amount', '==', parseFloat(bankAmount)),
                    where('status', '==', 'unpaid'),
                    limit(1)
                );
            }
            
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ 
                    variant: 'destructive', 
                    title: 'فشل المطابقة', 
                    description: 'نعتذر، لم يتم العثور على إيصال مطابق للعملية المرسلة في النظام.' 
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
                    transactionType: `تغذية آلي - ${bankType === 'alomqy' ? 'العمقي' : 'الكريمي'}`,
                    notes: `مطابقة آلية لـ ${bankType === 'alomqy' ? 'حساب' : 'مرجع'}: ${bankType === 'alomqy' ? alomqyAccount : kuraimiReference}`,
                    status: 'success'
                });

                await batch.commit();

                setLastTxDetails({
                    account: bankType === 'alomqy' ? alomqyAccount : kuraimiReference,
                    amount: notifData.amount,
                    date: now,
                    bank: bankType
                });
                
                setShowSuccess(true);
                audioRef.current?.play().catch(() => {});

                // إرسال SMS لنجاح العملية (سواء كريمي أو عمقي)
                if (userProfile.phoneNumber) {
                    const newBalance = (userProfile.balance || 0) + notifData.amount;
                    const smsMessage = `ستار موبايل: تم إيداع (${notifData.amount.toLocaleString('en-US')}) ريال لحسابك بنجاح. رصيدك الآن: (${newBalance.toLocaleString('en-US')}) ريال.`;
                    fetch('/api/sms', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ 
                            phoneNumber: userProfile.phoneNumber, 
                            message: smsMessage 
                        }) 
                    }).catch(e => console.error("SMS Notify Error:", e));
                }
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'حدث خطأ غير متوقع أثناء معالجة الطلب.' });
        } finally {
            setIsVerifyingBank(false);
        }
    };

    const isAlOmqy = selectedMethod?.name.includes('العمقي');
    const isKuraimi = selectedMethod?.name.includes('الكريمي');

    if (showSuccess && lastTxDetails) {
        return (
            <div className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 animate-in fade-in-0 duration-500">
                <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
                <Card className="w-full max-w-[320px] text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card/95 backdrop-blur-xl animate-in zoom-in-95">
                    <div className="bg-green-500 p-8 flex justify-center">
                        <CheckCircle className="h-14 w-14 text-white animate-bounce" />
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-black text-green-600">تم الإيداع بنجاح</h2>
                            <p className="text-[10px] text-muted-foreground mt-1 font-bold">تغذية آلية عبر {lastTxDetails.bank === 'alomqy' ? 'العمقي' : 'الكريمي'}</p>
                        </div>
                        <div className="w-full space-y-3 text-sm bg-muted/40 backdrop-blur-md p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                            <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                <span className="text-muted-foreground text-[10px] flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> الحساب/المرجع:</span>
                                <span className="font-mono font-black tracking-widest text-[#0048ad]">{lastTxDetails.account}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-muted-foreground text-[10px] flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المضاف:</span>
                                <span className="font-black text-green-600 text-lg">{lastTxDetails.amount.toLocaleString()} ر.ي</span>
                            </div>
                        </div>
                        <Button className="w-full h-12 rounded-2xl font-black bg-[#0048ad] text-white shadow-lg active:scale-95 transition-transform" onClick={() => router.push('/login')}>إغلاق</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="تغذية الحساب" />
            <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
                
                <div className="bg-mesh-gradient pt-6 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex flex-col items-center text-center space-y-4">
                        <div className="bg-white/20 p-3 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                            <CircleDollarSign className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">إيداع رصيد فوري</h2>
                        <div className="bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
                            <p className="text-[10px] text-white font-bold uppercase tracking-[0.2em]">مطابقة آلية للعمقي والكريمي</p>
                        </div>
                    </div>
                </div>

                <div className="px-4 space-y-8 pb-10">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                             <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                 <Building2 className="w-4 h-4 text-primary" />
                                 اختر وسيلة التحويل
                             </h3>
                        </div>

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
                        <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                            
                            <Card className="border-none shadow-xl rounded-[40px] overflow-hidden bg-white dark:bg-slate-900 border border-primary/5">
                                <CardContent className="p-8 text-center space-y-6">
                                    <div className="bg-primary/5 p-5 rounded-3xl border-2 border-dashed border-primary/10 flex flex-col items-center gap-3">
                                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">حول إلى هذا الحساب</p>
                                        <div className="flex items-center gap-4">
                                            <span className="text-3xl font-black font-mono tracking-tighter text-[#0048ad]">{selectedMethod.accountNumber}</span>
                                            <button 
                                                onClick={() => handleCopy(selectedMethod.accountNumber)} 
                                                className="p-2.5 bg-[#0048ad] text-white rounded-2xl shadow-lg active:scale-90 transition-transform"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="bg-white/50 px-4 py-1.5 rounded-full border border-primary/5">
                                            <p className="text-[11px] font-black text-foreground/80">باسم: {selectedMethod.accountHolderName}</p>
                                        </div>
                                    </div>

                                    {(isAlOmqy || isKuraimi) && (
                                        <div className="space-y-6 pt-2 animate-in fade-in duration-500">
                                            <div className="relative group text-right">
                                                <Label className="text-[10px] font-black text-muted-foreground uppercase pr-2 mb-1 block">
                                                    {isAlOmqy ? 'رقم حسابك في العمقي' : 'رقم المرجع (العملية)'}
                                                </Label>
                                                <div className="relative" dir="ltr">
                                                    <Input 
                                                        value={isAlOmqy ? alomqyAccount : kuraimiReference} 
                                                        onChange={e => isAlOmqy ? setAlomqyAccount(e.target.value.replace(/\D/g, '')) : setKuraimiReference(e.target.value.replace(/\D/g, ''))} 
                                                        placeholder={isAlOmqy ? "25**********" : "أدخل رقم المرجع هنا"} 
                                                        className="h-14 rounded-2xl bg-muted/20 border-2 border-primary/5 text-center font-black text-xl shadow-inner focus-visible:ring-2 focus-visible:ring-[#0048ad]/30" 
                                                        style={{ direction: 'ltr' }}
                                                    />
                                                    {isAlOmqy ? (
                                                        <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B32C4C] opacity-20" />
                                                    ) : (
                                                        <Hash className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#51B14E] opacity-20" />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="relative text-right">
                                                <Label className="text-[10px] font-black text-muted-foreground uppercase pr-2 mb-1 block">المبلغ المودع</Label>
                                                <div className="relative">
                                                    <Input 
                                                        type="number" 
                                                        value={bankAmount} 
                                                        onChange={e => setBankAmount(e.target.value)} 
                                                        placeholder="0.00" 
                                                        className="h-16 rounded-[24px] bg-muted/20 border-2 border-primary/5 text-center font-black text-3xl shadow-inner text-[#0048ad] focus-visible:ring-2 focus-visible:ring-[#0048ad]/30" 
                                                    />
                                                    <Wallet className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0048ad] opacity-10" />
                                                </div>
                                            </div>

                                            <Button 
                                                onClick={() => handleConfirmBankDeposit(isAlOmqy ? 'alomqy' : 'kuraimi')} 
                                                disabled={isVerifyingBank} 
                                                className="w-full h-14 rounded-3xl bg-[#0048ad] hover:bg-[#003a8c] text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all border-none"
                                            >
                                                {isVerifyingBank ? (
                                                    <div className="flex items-center gap-3">
                                                        <Loader2 className="animate-spin h-5 w-5" />
                                                        <span>جاري المطابقة...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <CheckCircle2 className="h-5 w-5" />
                                                        <span>اضافة المبلغ الى حسابي</span>
                                                    </div>
                                                )}
                                            </Button>
                                        </div>
                                    )}

                                    {!isAlOmqy && !isKuraimi && (
                                        <div className="pt-4">
                                            <Button 
                                                onClick={() => window.open(`https://api.whatsapp.com/send?phone=967770326828`, '_blank')} 
                                                className="w-full h-14 rounded-3xl bg-mesh-gradient text-white font-black text-base shadow-xl active:scale-95 transition-all border-none"
                                            >
                                                أرسل الإيصال عبر واتساب
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
            <Toaster />
        </div>
    );
}
