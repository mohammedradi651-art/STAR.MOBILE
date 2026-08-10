'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where, getDocs, limit, writeBatch, increment } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
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
    User as UserIcon,
    Building2,
    CreditCard,
    Zap
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

                if (userProfile.phoneNumber) {
                    const newBalance = (userProfile.balance || 0) + notifData.amount;
                    const smsMessage = `ستار موبايل: تم إيداع (${notifData.amount.toLocaleString('en-US')}) ريال لحسابك بنجاح. رصيدك الآن: (${newBalance.toLocaleString('en-US')}) ريال.`;
                    fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: userProfile.phoneNumber, message: smsMessage }) }).catch(() => {});
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
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in-0">
                <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
                <Card className="w-full max-w-[320px] text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card/95 backdrop-blur-xl">
                    <div className="bg-green-500 p-8 flex justify-center">
                        <CheckCircle className="h-12 w-12 text-white animate-bounce" />
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-black text-green-600">تم الإيداع بنجاح</h2>
                            <p className="text-xs text-muted-foreground mt-1 font-bold">تغذية آلية عبر {lastTxDetails.bank === 'alomqy' ? 'العمقي' : 'الكريمي'}</p>
                        </div>
                        <div className="w-full space-y-3 text-sm bg-muted/40 backdrop-blur-md p-5 rounded-[24px] text-right border-2 border-dashed border-primary/10">
                            <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> الحساب/المرجع:</span>
                                <span className="font-mono font-bold tracking-widest">{lastTxDetails.account}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المضاف:</span>
                                <span className="font-black text-green-600">{lastTxDetails.amount.toLocaleString()} ر.ي</span>
                            </div>
                        </div>
                        <Button className="w-full h-12 rounded-2xl font-black bg-[#0048ad] text-white shadow-lg active:scale-95 transition-transform" onClick={() => router.push('/login')}>العودة للرئيسية</Button>
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
                        <h2 className="text-2xl font-black text-white tracking-tight">إيداع رصيد جديد</h2>
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">مطابقة آلية لإيداعات العمقي والكريمي</p>
                    </div>
                </div>

                <div className="px-4 space-y-8 pb-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">1</div>
                            <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">اختر طريقة التحويل</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {isLoadingMethods ? (
                                [1, 2].map(i => <div key={i} className="aspect-square rounded-[32px] bg-muted animate-pulse" />)
                            ) : (
                                paymentMethods?.map(method => (
                                    <div key={method.id} onClick={() => setSelectedMethod(method)} className={cn("group flex flex-col items-center justify-center space-y-3 rounded-[32px] p-4 aspect-square cursor-pointer transition-all duration-300 border-2 relative overflow-hidden", selectedMethod?.id === method.id ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10 scale-[1.02]' : 'border-transparent bg-white dark:bg-slate-900 shadow-sm hover:border-primary/20')}>
                                        <div className="w-16 h-16 rounded-2xl relative shadow-sm overflow-hidden"><Image src={getLogoSrc(method.logoUrl)} alt={method.name} fill className="object-cover" /></div>
                                        <p className={cn("text-center text-xs font-black transition-colors", selectedMethod?.id === method.id ? "text-primary" : "text-foreground/70")}>{method.name}</p>
                                        {selectedMethod?.id === method.id && <div className="absolute top-2 left-2 animate-in zoom-in-50 duration-300"><CheckCircle2 className="w-5 h-5 text-primary" /></div>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {selectedMethod && (
                        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">2</div>
                                <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">بيانات التحويل والمطابقة</h3>
                            </div>

                            <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-white dark:bg-slate-900">
                                <CardContent className="p-6 text-center space-y-5">
                                    <div className="bg-primary/5 p-4 rounded-[24px] border-2 border-dashed border-primary/10 flex flex-col items-center gap-2">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">رقم حساب الإدارة للمستلم</p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-black font-mono tracking-wider text-primary">{selectedMethod.accountNumber}</span>
                                            <button onClick={() => handleCopy(selectedMethod.accountNumber)} className="p-2 bg-primary text-white rounded-xl shadow-md active:scale-90 transition-transform"><Copy className="w-4 h-4" /></button>
                                        </div>
                                        <p className="text-[10px] font-bold text-muted-foreground mt-1">بإسم: {selectedMethod.accountHolderName}</p>
                                    </div>

                                    {isAlOmqy && (
                                        <div className="pt-4 space-y-4 border-t border-dashed border-primary/10 mt-4 animate-in fade-in-0">
                                            <div className="space-y-2 text-right">
                                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم حسابك في العمقي</Label>
                                                <Input value={alomqyAccount} onChange={e => setAlomqyAccount(e.target.value.replace(/\D/g, ''))} placeholder="25*******" className="h-12 rounded-2xl bg-white border-2 border-primary/20 text-center font-bold text-lg shadow-sm" />
                                            </div>
                                            <div className="space-y-2 text-right">
                                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">المبلغ المودع</Label>
                                                <Input type="number" value={bankAmount} onChange={e => setBankAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl bg-white border-2 border-primary/20 text-center font-black text-xl shadow-sm" />
                                            </div>
                                            <Button onClick={() => handleConfirmBankDeposit('alomqy')} disabled={isVerifyingBank} className="w-full h-12 rounded-2xl bg-primary text-white font-black shadow-lg active:scale-95 transition-all">
                                                {isVerifyingBank ? <Loader2 className="animate-spin h-5 w-5" /> : "تأكيد ومطابقة الإيداع"}
                                            </Button>
                                        </div>
                                    )}

                                    {isKuraimi && (
                                        <div className="pt-4 space-y-4 border-t border-dashed border-primary/10 mt-4 animate-in fade-in-0">
                                            <div className="space-y-2 text-right">
                                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">رقم المرجع (العملية)</Label>
                                                <Input value={kuraimiReference} onChange={e => setKuraimiReference(e.target.value.replace(/\D/g, ''))} placeholder="أدخل رقم المرجع هنا" className="h-12 rounded-2xl bg-white border-2 border-primary/20 text-center font-bold text-lg shadow-sm" />
                                            </div>
                                            <div className="space-y-2 text-right">
                                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1">المبلغ المودع</Label>
                                                <Input type="number" value={bankAmount} onChange={e => setBankAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl bg-white border-2 border-primary/20 text-center font-black text-xl shadow-sm" />
                                            </div>
                                            <Button onClick={() => handleConfirmBankDeposit('kuraimi')} disabled={isVerifyingBank} className="w-full h-12 rounded-2xl bg-primary text-white font-black shadow-lg active:scale-95 transition-all">
                                                {isVerifyingBank ? <Loader2 className="animate-spin h-5 w-5" /> : "تأكيد ومطابقة الإيداع"}
                                            </Button>
                                        </div>
                                    )}

                                    {!isAlOmqy && !isKuraimi && (
                                        <div className="pt-4">
                                            <Button onClick={() => window.open(`https://api.whatsapp.com/send?phone=967770326828`, '_blank')} className="w-full h-12 rounded-2xl bg-mesh-gradient text-white font-black shadow-xl active:scale-95 transition-all border-none">أرسل الإيصال عبر واتساب</Button>
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
