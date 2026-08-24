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
    CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';

export const dynamic = 'force-dynamic';

type PaymentMethod = {
  id: string;
  name: string;
  accountHolderName: string;
  accountNumber: string;
  logoUrl?: string;
};

const TopUpMovingLoader = () => {
  const [animationData, setAnimationData] = useState<any>(null);
  useEffect(() => {
    fetch('/TH.json').then(res => res.json()).then(data => setAnimationData(data));
  }, []);
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
      <div className="relative w-32 h-32 flex items-center justify-center">
          {animationData && <Lottie animationData={animationData} loop={true} style={{ width: '100%', height: '100%' }} />}
      </div>
    </div>
  );
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

    const userDocRef = useMemoFirebase(
      () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userProfile } = useDoc<any>(userDocRef);
    const { data: paymentMethods } = useCollection<PaymentMethod>(useMemoFirebase(() => (firestore ? collection(firestore, 'paymentMethods') : null), [firestore]));

    const getFirstLast = (name?: string) => {
        if (!name) return 'عميلنا';
        const parts = name.trim().split(/\s+/);
        if (parts.length <= 1) return name;
        return `${parts[0]} ${parts[parts.length - 1]}`;
    };

    const handleConfirmBankDeposit = async (bankType: 'alomqy' | 'kuraimi' | 'amjad') => {
        if (!bankAmount || !firestore || !userProfile || !userDocRef) return;
        const amt = parseFloat(bankAmount);
        setIsVerifyingBank(true);
        try {
            const notifsRef = collection(firestore, 'bankNotifications');
            let q;
            if (bankType === 'alomqy') {
                q = query(notifsRef, where('bank', '==', 'alomqy'), where('account', '==', alomqyAccount.trim()), where('amount', '==', amt), where('status', '==', 'unpaid'), limit(1));
            } else if (bankType === 'kuraimi') {
                q = query(notifsRef, where('bank', '==', 'kuraimi'), where('reference', '==', kuraimiReference.trim()), where('amount', '==', amt), where('status', '==', 'unpaid'), limit(1));
            } else {
                q = query(notifsRef, where('bank', '==', 'amjad'), where('amount', '==', amt), where('senderName', '==', userProfile.displayName?.trim()), where('status', '==', 'unpaid'), limit(1));
            }
            
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'لم يتم العثور على الإيداع' });
            } else {
                const notifDoc = querySnapshot.docs[0];
                const notifData = notifDoc.data();
                const batch = writeBatch(firestore);
                const now = new Date().toISOString();

                batch.update(userDocRef, { balance: increment(notifData.amount) });
                batch.update(notifDoc.ref, { status: 'paid', paidTo: userProfile.id, paidAt: now });
                batch.set(doc(collection(firestore, `users/${userProfile.id}/transactions`)), {
                    userId: userProfile.id, transactionDate: now, amount: notifData.amount,
                    transactionType: `تغذية آلي - ${bankType}`, notes: `مطابقة آلية`, status: 'success'
                });
                await batch.commit();

                if (userProfile.phoneNumber) {
                    const currentBalance = (userProfile.balance || 0) + notifData.amount;
                    const shortName = getFirstLast(userProfile.displayName);
                    const smsMessage = `ستار موبايل\nمرحباً ${shortName}،\nتم ايداع مبلغ ${notifData.amount.toLocaleString('en-US')} ريال إلى حسابك\n\nالرصيد الحالي: ${currentBalance.toLocaleString('en-US')} ريال`;
                    fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: userProfile.phoneNumber.trim(), message: smsMessage }) }).catch(() => {});
                }
                setShowSuccess(true);
                audioRef.current?.play().catch(() => {});
            }
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); } finally { setIsVerifyingBank(false); }
    };

    if (showSuccess) {
        return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-white animate-in fade-in-0 duration-500">
                <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
                <div className="text-center space-y-6">
                    <CheckCircle className="h-20 w-20 text-green-500 mx-auto animate-bounce" />
                    <h2 className="text-2xl font-black">تم الإيداع بنجاح</h2>
                    <Button className="w-full h-12 rounded-2xl font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="تغذية الحساب" />
            {isVerifyingBank && <TopUpMovingLoader />}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-20">
                <div className="grid grid-cols-2 gap-4">
                    {paymentMethods?.map(m => (
                        <Card key={m.id} className={cn("p-4 cursor-pointer rounded-3xl border-2 transition-all", selectedMethod?.id === m.id ? 'border-primary bg-primary/5' : 'border-transparent bg-white')} onClick={() => setSelectedMethod(m)}>
                            <p className="text-center font-black text-xs">{m.name}</p>
                        </Card>
                    ))}
                </div>

                {selectedMethod && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4">
                        <Card className="bg-mesh-gradient text-white p-6 rounded-[32px] text-center">
                            <p className="text-[10px] font-bold uppercase mb-2">رقم الحساب</p>
                            <p className="text-2xl font-black font-mono">{selectedMethod.accountNumber}</p>
                            <p className="text-xs mt-2 opacity-80">{selectedMethod.accountHolderName}</p>
                        </Card>

                        <div className="space-y-4">
                            <Input placeholder="المبلغ المودع" type="number" value={bankAmount} onChange={e => setBankAmount(e.target.value)} className="h-12 rounded-2xl text-center font-black text-lg" />
                            {(selectedMethod.name.includes('العمقي') || selectedMethod.name.includes('الكريمي')) && (
                                <Input placeholder={selectedMethod.name.includes('العمقي') ? "حسابك بالعمقي" : "رقم المرجع"} value={selectedMethod.name.includes('العمقي') ? alomqyAccount : kuraimiReference} onChange={e => selectedMethod.name.includes('العمقي') ? setAlomqyAccount(e.target.value) : setKuraimiReference(e.target.value)} className="h-12 rounded-2xl text-center font-bold" />
                            )}
                            <Button className="w-full h-14 rounded-3xl font-black text-lg" onClick={() => handleConfirmBankDeposit(selectedMethod.name.includes('العمقي') ? 'alomqy' : selectedMethod.name.includes('الكريمي') ? 'kuraimi' : 'amjad')}>تأكيد الإيداع الآن</Button>
                        </div>
                    </div>
                )}
            </div>
            <Toaster />
        </div>
    );
}
