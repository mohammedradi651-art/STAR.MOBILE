'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch, increment } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Copy, 
    Wallet, 
    MapPin, 
    ExternalLink, 
    HelpCircle, 
    PhoneCall, 
    QrCode, 
    ChevronDown,
    CircleDollarSign,
    CheckCircle2,
    Info,
    Scan,
    ImageUp,
    Sparkles,
    Loader2,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { processBankReceipt } from '@/ai/flows/process-bank-receipt-flow';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

export const dynamic = 'force-dynamic';

type PaymentMethod = {
  id: string;
  name: string;
  accountHolderName: string;
  accountNumber: string;
  logoUrl?: string;
};

type AppSettings = {
    supportPhoneNumber: string;
};

type UserProfile = {
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

const QutaibiDirectForm = ({ onToggleTransactions }: { onToggleTransactions: () => void }) => {
    return (
        <div className="bg-[#A3D133] rounded-[40px] p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-500 max-w-sm mx-auto border-t-4 border-white/10">
            <div className="flex justify-between items-center px-1">
                <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-md cursor-pointer hover:bg-white/30 transition-colors">
                    <HelpCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-3">
                    <h3 className="font-black text-base text-white drop-shadow-md">بنك القطيبي (ريال جديد)</h3>
                    <div className="bg-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg overflow-hidden border-2 border-white">
                        <div className="relative w-full h-full">
                            <Image src="https://i.postimg.cc/QN4zjX32/Asset-24x-8.png" alt="Qutaibi" fill className="object-cover" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="relative group">
                    <Input className="h-14 bg-[#E6F4D7] border-2 border-black/80 rounded-2xl text-right font-black text-lg text-black pr-12 focus-visible:ring-black placeholder:text-black/30 shadow-inner" placeholder="رقم الحساب" />
                    <PhoneCall className="absolute right-4 top-1/2 -translate-y-1/2 text-black w-5 h-5 opacity-70" />
                </div>
                <div className="relative group">
                    <Input className="h-14 bg-[#E6F4D7] border-2 border-black/80 rounded-2xl text-right font-black text-lg text-black pr-12 focus-visible:ring-black placeholder:text-black/30 shadow-inner" placeholder="كود الشراء" />
                    <QrCode className="absolute right-4 top-1/2 -translate-y-1/2 text-black w-5 h-5 opacity-70" />
                </div>
                <div className="relative group">
                    <Input className="h-14 bg-[#E6F4D7] border-2 border-black/80 rounded-2xl text-right font-black text-lg text-black pr-12 focus-visible:ring-black placeholder:text-black/30 shadow-inner" placeholder="المبلغ" type="number" />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-black font-black text-2xl opacity-70">$</div>
                </div>
            </div>

            <div className="pt-2">
                <Button className="w-full h-14 bg-[#8EBC24] hover:bg-[#7DA81F] text-white font-black text-lg rounded-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] border-b-4 border-black/30 active:translate-y-1 active:border-b-0 transition-all">
                    طلب رمز التأكيد
                </Button>
            </div>

            <div className="flex justify-between items-center px-4 pt-3 cursor-pointer group" onClick={onToggleTransactions}>
                <div className="bg-black/10 p-1 rounded-full group-hover:bg-black/20 transition-colors">
                    <ChevronDown className="w-5 h-5 text-black" />
                </div>
                <span className="font-black text-white text-base drop-shadow-sm group-hover:underline">عرض العمليات</span>
            </div>
        </div>
    );
};

export default function TopUpPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    const userDocRef = useMemoFirebase(
      () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const settingsDocRef = useMemoFirebase(
        () => (firestore ? doc(firestore, 'appSettings', 'global') : null),
        [firestore]
    );
    const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);
    
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

    const handleSendManualRequest = () => {
        const phone = appSettings?.supportPhoneNumber;
        if (!phone) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'رقم الدعم غير متوفر حالياً.' });
            return;
        }
        window.open(`https://api.whatsapp.com/send?phone=${phone}`, '_blank');
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAiProcessing(true);
        setAiResult(null);

        try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            const dataUri = await base64Promise;

            // استدعاء محرك الذكاء الاصطناعي
            const result = await processBankReceipt({ receiptImage: dataUri });
            
            if (!result.isValid) {
                throw new Error("عذراً، لم نتمكن من التعرف على هذا الإيصال كحوالة صحيحة للعمقي أو الكريمي.");
            }

            // التحقق من عدم تكرار الإيصال
            if (firestore && user) {
                const q = query(collection(firestore, 'users', user.uid, 'transactions'), where('receiptReference', '==', result.receiptNumber));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    throw new Error("هذا الإيصال تم استخدامه مسبقاً في عملية شحن أخرى.");
                }
            }

            setAiResult(result);
            toast({ title: "تم التحليل بنجاح", description: "يرجى مراجعة البيانات قبل التأكيد." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "فشل التحليل", description: error.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleConfirmAiTopUp = async () => {
        if (!user || !userProfile || !aiResult || !firestore || !userDocRef) return;

        setIsAiProcessing(true);
        const amount = aiResult.amount;
        const now = new Date().toISOString();

        try {
            const batch = writeBatch(firestore);
            
            // 1. تحديث الرصيد
            batch.update(userDocRef, { balance: increment(amount) });

            // 2. تسجيل العملية
            const txRef = doc(collection(firestore, `users/${user.uid}/transactions`));
            batch.set(txRef, {
                userId: user.uid,
                transactionDate: now,
                amount: amount,
                transactionType: 'تغذية رصيد (بالذكاء)',
                notes: `شحن آلي لإيصال ${aiResult.bankName}: ${aiResult.receiptNumber}`,
                receiptReference: aiResult.receiptNumber,
                status: 'success'
            });

            // 3. إشعار
            const notifRef = doc(collection(firestore, `users/${user.uid}/notifications`));
            batch.set(notifRef, {
                title: 'تم شحن حسابك آلياً ✅',
                body: `تم إيداع ${amount.toLocaleString()} ريال بنجاح بعد فحص إيصال ${aiResult.bankName}.`,
                timestamp: now
            });

            await batch.commit();
            setAiResult(null);
            toast({ title: "مبروك!", description: "تم إيداع الرصيد في حسابك فوراً." });
            router.push('/login');
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ في الإيداع", description: "حدث خطأ أثناء تحديث الرصيد." });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const isAiSupported = selectedMethod?.name.includes('العمقي') || selectedMethod?.name.includes('الكريمي');
    const isQutaibiSelected = selectedMethod?.name.includes('القطيبي');

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="تغذية الحساب" />
            
            <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
                {isAiProcessing && <ProcessingOverlay message="جاري فحص الإيصال بالذكاء الاصطناعي..." />}

                <div className="bg-mesh-gradient pt-6 pb-12 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex flex-col items-center text-center space-y-4">
                        <div className="bg-white/20 p-3 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                            <CircleDollarSign className="h-8 w-8 text-white" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-white tracking-tight">تغذية المحفظة</h2>
                            <p className="text-[10px] text-white/70 font-bold uppercase tracking-[0.2em]">اختر طريقة الشحن المناسبة لك</p>
                        </div>
                    </div>
                </div>

                <div className="px-4 space-y-8 pb-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg">1</div>
                            <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">طريقة التحويل</h3>
                        </div>
                        {renderPaymentMethods()}
                    </div>

                    {selectedMethod && (
                        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg">2</div>
                                <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">التفاصيل</h3>
                            </div>

                            {isQutaibiSelected ? (
                                <QutaibiDirectForm onToggleTransactions={() => router.push('/transactions')} />
                            ) : (
                                <div className="space-y-4">
                                    <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-white dark:bg-slate-900">
                                        <CardContent className="p-6 text-center space-y-5">
                                            <div className="flex items-center justify-center gap-4">
                                                <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md border-2 border-primary/5">
                                                    <Image src={getLogoSrc(selectedMethod.logoUrl)} alt={selectedMethod.name} fill className="object-cover" />
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">اسم صاحب الحساب</p>
                                                    <p className="text-base font-black text-foreground">{selectedMethod.accountHolderName}</p>
                                                </div>
                                            </div>
                                            <div className="bg-primary/5 p-4 rounded-[24px] border-2 border-dashed border-primary/10 flex flex-col items-center gap-2">
                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">رقم الحساب</p>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl font-black font-mono tracking-wider text-primary">{selectedMethod.accountNumber}</span>
                                                    <button onClick={() => handleCopy(selectedMethod.accountNumber)} className="p-2 bg-primary text-white rounded-xl shadow-md active:scale-90 transition-transform"><Copy className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* نظام المسح الذكي للعمقي والكريمي */}
                                    {isAiSupported ? (
                                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-700">
                                            <div className="bg-orange-50 border border-orange-200 rounded-[32px] p-6 text-center space-y-4">
                                                <div className="bg-orange-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                                    <Sparkles className="h-8 w-8 text-orange-600 animate-pulse" />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-orange-700">شحن آلي بالذكاء الاصطناعي</h3>
                                                    <p className="text-[10px] text-orange-600/80 font-bold">ارفع صورة الإيصال وسيقوم النظام بإيداع الرصيد فوراً</p>
                                                </div>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    ref={fileInputRef} 
                                                    onChange={handleFileSelect}
                                                />
                                                <Button 
                                                    className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black shadow-xl"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Scan className="ml-2 h-5 w-5" />
                                                    اختيار الإيصال والمسح
                                                </Button>
                                            </div>

                                            {/* نتائج التحليل الذكي */}
                                            {aiResult && (
                                                <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border-t-4 border-green-500 animate-in zoom-in-95 duration-500">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                        <h4 className="font-black text-sm">تم استخراج البيانات بنجاح</h4>
                                                    </div>
                                                    <div className="space-y-3 mb-6">
                                                        <div className="flex justify-between items-center text-xs py-2 border-b border-dashed">
                                                            <span className="text-muted-foreground">البنك:</span>
                                                            <span className="font-black">{aiResult.bankName === 'Al-Omqy' ? 'العمقي للصرافة' : 'بنك الكريمي'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs py-2 border-b border-dashed">
                                                            <span className="text-muted-foreground">رقم العملية:</span>
                                                            <span className="font-mono font-black">{aiResult.receiptNumber}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2">
                                                            <span className="text-muted-foreground text-xs font-bold">المبلغ الصافي:</span>
                                                            <span className="text-2xl font-black text-primary">{aiResult.amount.toLocaleString()} <span className="text-xs">ر.ي</span></span>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full h-12 rounded-xl font-black" onClick={handleConfirmAiTopUp}>
                                                        تأكيد الإيداع الآن
                                                    </Button>
                                                    <Button variant="ghost" className="w-full mt-2 text-xs font-bold" onClick={() => setAiResult(null)}>إلغاء</Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-card">
                                            <CardContent className="p-4">
                                                <Button className="w-full h-11 rounded-2xl bg-mesh-gradient text-white font-black text-sm shadow-xl" onClick={handleSendManualRequest}>
                                                    أرسل الإيصال عبر واتساب
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* معلومات الوكيل */}
                    <div className="pt-10 border-t border-muted-foreground/10">
                        <h2 className="text-lg font-black text-primary text-center mb-4">الوكيل الرسمي (حضرموت)</h2>
                        <Card className="border-none shadow-xl bg-mesh-gradient text-white rounded-[32px] overflow-hidden">
                            <CardContent className="p-6 space-y-6 text-center">
                                <div className="relative w-24 h-24 mx-auto mb-2 overflow-hidden rounded-2xl border-2 border-white/30 shadow-lg bg-white/10">
                                    <Image src="https://i.postimg.cc/fLVNsBZx/967-770-326-828-20260218-132606.jpg" alt="Official Agent" fill className="object-cover" />
                                </div>
                                <h3 className="text-xl font-black">مكتب ستار ميديا</h3>
                                <p className="text-xs font-bold opacity-80">حضرموت - شبام - بجانب سوبر ماركت البر</p>
                                <Button className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-white/90 font-black" onClick={() => window.open('https://maps.app.goo.gl/Qs6cNBxMutA6SsvH6', '_blank')}>
                                    <ExternalLink className="ml-2 h-5 w-5" /> عرض الموقع على الخريطة
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <Toaster />
        </div>
    );

    function renderPaymentMethods() {
        if (isLoadingMethods) return <div className="grid grid-cols-2 gap-4">{[1, 2].map(i => <Skeleton key={i} className="h-36 w-full rounded-[32px]" />)}</div>;
        return (
            <div className="grid grid-cols-2 gap-4">
                {paymentMethods?.map(method => (
                    <div key={method.id} onClick={() => setSelectedMethod(method)} className={cn(
                        "group flex flex-col items-center justify-center space-y-3 rounded-[32px] p-4 aspect-square cursor-pointer transition-all duration-300 border-2 relative overflow-hidden",
                        selectedMethod?.id === method.id ? 'border-primary bg-primary/5 shadow-xl scale-[1.02]' : 'border-transparent bg-white dark:bg-slate-900 shadow-sm hover:border-primary/20'
                    )}>
                        <div className="w-16 h-16 rounded-2xl relative shadow-sm"><Image src={getLogoSrc(method.logoUrl)} alt={method.name} fill className="object-cover" /></div>
                        <p className={cn("text-center text-xs font-black", selectedMethod?.id === method.id ? "text-primary" : "text-foreground/70")}>{method.name}</p>
                        {selectedMethod?.id === method.id && <div className="absolute top-2 left-2 animate-in zoom-in-50"><CheckCircle2 className="w-5 h-5 text-primary" /></div>}
                    </div>
                ))}
            </div>
        );
    }
}
