'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { ShieldCheck, Clock, RotateCcw, ChevronRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

export const dynamic = 'force-dynamic';

export default function VerifyOtpPage() {
    const [signupData, setSignupData] = useState<any>(null);
    const [userOtpInput, setUserOtpInput] = useState('');
    const [timer, setTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const router = useRouter();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    // استعادة البيانات عند التحميل
    useEffect(() => {
        const data = sessionStorage.getItem('temp_signup_data');
        if (!data) {
            router.replace('/signup');
            return;
        }
        setSignupData(JSON.parse(data));
    }, [router]);

    // منطق المؤقت
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const sendSmsOtp = async (targetPhone: string, otpCode: string) => {
        const smsMessage = `ستار موبايل: رمز التحقق الجديد الخاص بك هو (${otpCode}). يرجى إدخاله لإكمال إنشاء حسابك.`;
        const response = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: targetPhone.trim(),
                message: smsMessage
            })
        });
        return response.json();
    };

    const handleResendOtp = async () => {
        if (!canResend || !signupData) return;
        
        setIsResending(true);
        try {
            const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
            const data = await sendSmsOtp(signupData.phoneNumber, newOtp);

            if (data.success) {
                const updatedData = { ...signupData, otp: newOtp };
                sessionStorage.setItem('temp_signup_data', JSON.stringify(updatedData));
                setSignupData(updatedData);
                setTimer(60);
                setCanResend(false);
                setUserOtpInput('');
                toast({ title: "تم التجديد", description: "أرسلنا لك رمز تحقق جديد بنجاح." });
            } else {
                throw new Error(data.error || "فشل إعادة الإرسال.");
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ", description: error.message });
        } finally {
            setIsResending(false);
        }
    };

    const handleVerifyAndComplete = async () => {
        if (!signupData) return;

        if (userOtpInput !== signupData.otp) {
            toast({ variant: "destructive", title: "الرمز غير صحيح", description: "تأكد من الرمز المرسل لجوالك وحاول مجدداً." });
            return;
        }

        setIsVerifying(true);
        try {
            const { fullName, phoneNumber, password, location, accountType, networkName, networkLocation } = signupData;
            const email = `${phoneNumber.trim()}@shabakat.com`;
            
            const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
            const user = userCredential.user;

            if (user) {
                await updateProfile(user, { displayName: fullName.trim() });
                const batch = writeBatch(firestore!);
                const userRef = doc(firestore!, 'users', user.uid);
                const nameParts = fullName.trim().split(/\s+/);

                batch.set(userRef, {
                    id: user.uid,
                    displayName: fullName.trim(),
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' '),
                    phoneNumber: phoneNumber.trim(),
                    email: user.email,
                    location: location,
                    registrationDate: new Date().toISOString(),
                    balance: 0,
                    accountType: accountType,
                    photoURL: `https://i.postimg.cc/SNgTrrW2/default-avatar.jpg`
                });
                
                if (accountType === 'network-owner') {
                    const networkRef = doc(collection(firestore!, 'networks'));
                    batch.set(networkRef, {
                        name: networkName,
                        location: networkLocation,
                        ownerId: user.uid,
                        phoneNumber: phoneNumber.trim()
                    });
                }
                await batch.commit();
            }

            setIsSuccess(true);
            sessionStorage.removeItem('temp_signup_data');
            toast({ title: "تم انشاء حسابك", description: "أهلاً بك في تطبيق ستار موبايل." });
            
            setTimeout(() => {
                router.replace('/login');
            }, 2000);

        } catch (error: any) {
            toast({ variant: "destructive", title: "فشل انشاء حسابك", description: "هذا الرقم مسجل لدينا - سجل دخولك مباشرة." });
            setIsVerifying(false);
        }
    };

    if (!signupData) return null;

    return (
        <div className="flex flex-col h-full bg-mesh-gradient text-white overflow-hidden">
            {isVerifying && !isSuccess && <ProcessingOverlay message="جاري انشاء حسابك" />}
            
            {/* Header */}
            <header className="p-6 flex items-center justify-between animate-in fade-in duration-500">
                <Link href="/signup" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                </Link>
                <h1 className="font-black text-xs uppercase tracking-widest text-white/80">توثيق الحساب</h1>
                <div className="w-9" />
            </header>

            <div className="flex-1 flex flex-col items-center px-8 py-10 space-y-10 overflow-y-auto no-scrollbar">
                
                {/* Hero Icon */}
                <div className="relative text-center space-y-4 animate-in zoom-in duration-700">
                    <div className="relative w-28 h-28 mx-auto">
                        <div className="absolute inset-0 bg-white/20 rounded-[40px] blur-3xl animate-pulse" />
                        <div className="relative w-full h-full bg-white/15 backdrop-blur-xl rounded-[36px] border border-white/20 flex items-center justify-center shadow-2xl">
                            {isSuccess ? (
                                <CheckCircle2 className="h-14 w-14 text-green-400 animate-in zoom-in duration-500" />
                            ) : (
                                <ShieldCheck className="h-14 w-14 text-white" />
                            )}
                        </div>
                        {!isSuccess && (
                            <div className="absolute -bottom-2 -right-2 bg-primary p-2 rounded-2xl shadow-xl border border-white/20 animate-bounce">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-1.5">
                        <h2 className="text-2xl font-black text-white">تحقق من الكود</h2>
                        <p className="text-[11px] font-bold text-white/60 leading-relaxed max-w-[240px] mx-auto">
                            لقد أرسلنا رمزاً خاصاً إلى الرقم <span className="text-white font-black" dir="ltr">{signupData.phoneNumber}</span>
                        </p>
                    </div>
                </div>

                {/* OTP Input Section */}
                <div className="w-full max-w-[280px] space-y-8 animate-in slide-in-from-bottom-8 duration-1000">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] text-center block">أدخل الرمز المكون من 4 أرقام</Label>
                        <div className="relative">
                            <Input 
                                type="tel"
                                maxLength={4}
                                placeholder="• • • •"
                                value={userOtpInput}
                                onChange={(e) => setUserOtpInput(e.target.value.replace(/\D/g, ''))}
                                className="h-16 bg-white/10 border-2 border-white/20 text-white placeholder:text-white/20 text-center text-3xl font-black tracking-[0.6em] rounded-[24px] focus-visible:ring-white/40 focus-visible:border-white/40 transition-all shadow-inner"
                                disabled={isVerifying || isSuccess}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-4">
                        <Button 
                            onClick={handleVerifyAndComplete}
                            className={cn(
                                "w-full h-14 rounded-[22px] font-black text-base shadow-2xl transition-all active:scale-95",
                                isSuccess ? "bg-green-50 text-white" : "bg-white text-[#0048ad] hover:bg-white/95"
                            )}
                            disabled={isVerifying || userOtpInput.length < 4 || isSuccess}
                        >
                            {isVerifying ? <Loader2 className="animate-spin h-5 w-5" /> : isSuccess ? "تم التوثيق بنجاح" : "تأكيد وإنشاء الحساب"}
                        </Button>

                        <div className="flex flex-col items-center gap-4 pt-2">
                            {timer > 0 ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/10 border border-white/5 backdrop-blur-sm">
                                    <Clock className="w-3.5 h-3.5 text-white/50" />
                                    <span className="text-[10px] font-bold text-white/70">إعادة الإرسال خلال: 00:{timer < 10 ? `0${timer}` : timer}</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleResendOtp}
                                    className="group flex items-center gap-2 text-[12px] font-black text-white hover:text-white/80 transition-all active:scale-95"
                                    disabled={isResending || isSuccess}
                                >
                                    {isResending ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />}
                                    <span>أرسل رمزاً جديداً الآن</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Branding */}
                <div className="mt-auto pt-10 pb-6 opacity-30 flex flex-col items-center gap-2">
                    <div className="h-[1px] w-20 bg-white/50" />
                    <p className="text-[8px] font-black uppercase tracking-[0.3em]">مطور التطبيق " محمد راضي باشادي</p>
                </div>
            </div>
            
            <Toaster />
        </div>
    );
}
