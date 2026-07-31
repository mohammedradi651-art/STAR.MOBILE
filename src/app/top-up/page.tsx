'use client';

import React, { useState, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
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
    Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

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
};

const getLogoSrc = (url?: string) => {
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      return url;
    }
    return 'https://placehold.co/100x100/e2e8f0/e2e8f0'; 
};

// مكون واجهة القطيبي المباشرة بتصميم متناسق
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
                            <Image 
                                src="https://i.postimg.cc/QN4zjX32/Asset-24x-8.png" 
                                alt="Qutaibi" 
                                fill 
                                className="object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="relative group">
                    <Input 
                        className="h-14 bg-[#E6F4D7] border-2 border-black/80 rounded-2xl text-right font-black text-lg text-black pr-12 focus-visible:ring-black placeholder:text-black/30 shadow-inner" 
                        placeholder="رقم الحساب" 
                    />
                    <PhoneCall className="absolute right-4 top-1/2 -translate-y-1/2 text-black w-5 h-5 opacity-70" />
                </div>
                <div className="relative group">
                    <Input 
                        className="h-14 bg-[#E6F4D7] border-2 border-black/80 rounded-2xl text-right font-black text-lg text-black pr-12 focus-visible:ring-black placeholder:text-black/30 shadow-inner" 
                        placeholder="كود الشراء" 
                    />
                    <QrCode className="absolute right-4 top-1/2 -translate-y-1/2 text-black w-5 h-5 opacity-70" />
                </div>
                <div className="relative group">
                    <Input 
                        className="h-14 bg-[#E6F4D7] border-2 border-black/80 rounded-2xl text-right font-black text-lg text-black pr-12 focus-visible:ring-black placeholder:text-black/30 shadow-inner" 
                        placeholder="المبلغ" 
                        type="number"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-black font-black text-2xl opacity-70">$</div>
                </div>
            </div>

            <div className="pt-2">
                <Button className="w-full h-14 bg-[#8EBC24] hover:bg-[#7DA81F] text-white font-black text-lg rounded-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] border-b-4 border-black/30 active:translate-y-1 active:border-b-0 transition-all">
                    طلب رمز التأكيد
                </Button>
            </div>

            <div 
                className="flex justify-between items-center px-4 pt-3 cursor-pointer group"
                onClick={onToggleTransactions}
            >
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
    
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

    const userDocRef = useMemoFirebase(
      () => (user ? doc(firestore, 'users', user.uid) : null),
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
        toast({
            title: "تم النسخ",
            description: "تم نسخ رقم الحساب بنجاح.",
        });
    };

    const handleSendRequest = () => {
        const phone = appSettings?.supportPhoneNumber;
        if (!phone) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'رقم الدعم غير متوفر حالياً.' });
            return;
        }

        const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}`;
        window.open(whatsappUrl, '_blank');
    };

    const isQutaibiSelected = selectedMethod?.name.includes('القطيبي');

    const renderPaymentMethods = () => {
        if (isLoadingMethods) {
            return (
                <div className="grid grid-cols-2 gap-4">
                    {[...Array(2)].map((_, i) => (
                         <div key={i} className="flex flex-col items-center justify-center space-y-2 rounded-3xl bg-card p-4 aspect-square border-2 border-border/50 animate-pulse">
                            <div className="h-12 w-12 rounded-2xl bg-muted" />
                            <div className="h-3 w-20 bg-muted rounded" />
                        </div>
                    ))}
                </div>
            );
        }

        if (!paymentMethods || paymentMethods.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center text-center py-10 opacity-40">
                    <Info className="h-12 w-12" />
                    <p className="mt-2 text-sm font-bold">لا توجد طرق دفع متاحة حالياً</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 gap-4">
                {paymentMethods.map(method => (
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
                        <div className={cn(
                            "w-16 h-16 rounded-2xl transition-all duration-300 overflow-hidden relative shadow-sm",
                            selectedMethod?.id === method.id ? "" : "bg-muted/50"
                        )}>
                            <Image 
                                src={getLogoSrc(method.logoUrl)} 
                                alt={method.name} 
                                fill
                                className="object-cover" 
                            />
                        </div>
                        <p className={cn(
                            "text-center text-xs font-black transition-colors",
                            selectedMethod?.id === method.id ? "text-primary" : "text-foreground/70"
                        )}>{method.name}</p>
                        
                        {selectedMethod?.id === method.id && (
                            <div className="absolute top-2 left-2 animate-in zoom-in-50 duration-300">
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

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
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-white tracking-tight">إيداع رصيد جديد</h2>
                            <p className="text-[10px] text-white/70 font-bold uppercase tracking-[0.2em]">قم بتغذية محفظتك لتستمتع بخدماتنا</p>
                        </div>
                    </div>
                </div>

                <div className="px-4 space-y-8 pb-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">1</div>
                            <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">اختر طريقة التحويل</h3>
                        </div>
                        {renderPaymentMethods()}
                    </div>

                    {selectedMethod && (
                        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">2</div>
                                <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">بيانات التحويل</h3>
                            </div>

                            {isQutaibiSelected ? (
                                <QutaibiDirectForm onToggleTransactions={() => router.push('/transactions')} />
                            ) : (
                                <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-white dark:bg-slate-900">
                                    <CardContent className="p-6 text-center space-y-5">
                                        <div className="flex items-center justify-center gap-4">
                                            <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md border-2 border-primary/5">
                                                <Image 
                                                    src={getLogoSrc(selectedMethod.logoUrl)} 
                                                    alt={selectedMethod.name} 
                                                    fill
                                                    className="object-cover" 
                                                />
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
                                                <button 
                                                    onClick={() => handleCopy(selectedMethod.accountNumber)}
                                                    className="p-2 bg-primary text-white rounded-xl active:scale-90 transition-transform shadow-md"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {selectedMethod && !isQutaibiSelected && (
                        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">3</div>
                                <h3 className="text-sm font-black text-foreground/80 uppercase tracking-widest">تأكيد الإيداع</h3>
                            </div>

                            <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-card">
                                <CardContent className="p-4">
                                    <Button 
                                        className="w-full h-11 rounded-2xl bg-mesh-gradient text-white font-black text-sm shadow-xl active:scale-95 transition-transform border-none"
                                        onClick={handleSendRequest} 
                                    >
                                        أرسل الإيصال عبر واتساب
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <div className="pt-10 border-t border-muted-foreground/10">
                        <div className="px-0 pb-10 space-y-4">
                            <h2 className="text-lg font-black text-primary text-center">غذي حسابك عبر الوكيل الرسمي</h2>
                            <Card className="border-none shadow-xl bg-mesh-gradient text-white rounded-[32px] overflow-hidden">
                                <CardContent className="p-6 space-y-6">
                                    <div className="flex flex-col items-center text-center gap-2">
                                        <div className="relative w-24 h-24 mb-2 overflow-hidden rounded-2xl border-2 border-white/30 shadow-lg bg-white/10 backdrop-blur-md">
                                            <Image 
                                                src="https://i.postimg.cc/fLVNsBZx/967-770-326-828-20260218-132606.jpg"
                                                alt="Official Agent Logo"
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <h3 className="text-xl font-black text-white">مكتب ستار ميديا للاعلان والتسويق</h3>
                                        <div className="flex items-center gap-2 opacity-80">
                                            <MapPin className="h-4 w-4 text-white" />
                                            <p className="text-xs font-bold text-white">حضرموت - شبام - بجانب سوبر ماركت البر</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Button 
                                            className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-white/90 font-black text-base shadow-lg"
                                            onClick={() => window.open('https://maps.app.goo.gl/Qs6cNBxMutA6SsvH6', '_blank')}
                                        >
                                            <ExternalLink className="ml-2 h-5 w-5" />
                                            عرض الموقع على الخريطة
                                        </Button>
                                        <div className="bg-black/10 rounded-2xl p-4 text-center">
                                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1 text-white">ساعات العمل</p>
                                            <p className="text-base font-black leading-relaxed text-white">
                                                الفترة الصباحية: 8:00 صباحاً - 12:30 ظهراً<br/>
                                                الفترة المسائية: 4:00 عصراً - 9:00 مساءً
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            <Toaster />
        </div>
    );
}