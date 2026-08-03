'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Phone, ShieldCheck, Key, ChevronRight, CheckCircle2, AlertTriangle, Loader2, Sparkles, Clock } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { resetPasswordAdmin } from './action';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

type Step = 'phone' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  // منطق زر الرجوع الذكي
  const handleBack = () => {
    if (step === 'verify') {
      setStep('phone');
    } else if (step === 'reset') {
      setStep('verify');
    } else if (step === 'success') {
      router.push('/');
    } else {
      router.push('/');
    }
  };

  // 1. طلب استعادة الحساب وإرسال OTP
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length !== 9) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'رقم الهاتف يجب أن يتكون من 9 أرقام.' });
      return;
    }

    setIsLoading(true);
    try {
      if (!firestore) throw new Error("Firebase is not initialized");

      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'غير مسجل', description: 'هذا الرقم غير مسجل لدينا في النظام.' });
        setIsLoading(false);
        return;
      }

      // توليد وإرسال الـ OTP فعلياً عبر الجوال
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const smsMessage = `ستار موبايل: رمز التحقق الخاص بك لاستعادة كلمة المرور هو (${generatedOtp}).`;
      
      const response = await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              phoneNumber: phoneNumber.trim(),
              message: smsMessage
          })
      });
      const data = await response.json();

      if (data.success) {
          setOtp(generatedOtp);
          setStep('verify');
          toast({ 
            title: 'تم إرسال الرمز', 
            description: 'يرجى إدخال رمز التحقق المرسل إلى هاتفك.' 
          });
      } else {
          throw new Error(data.error || "فشل إرسال رمز التحقق.");
      }

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // 2. التحقق من الرمز المدخل
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (userOtpInput === otp) {
        setStep('reset');
        toast({ title: "تم التحقق", description: "الآن قم بتعيين كلمة المرور الجديدة." });
    } else {
        toast({ variant: 'destructive', title: 'خطأ', description: 'رمز التحقق غير صحيح، يرجى التأكد والمحاولة مجدداً.' });
    }
  };

  // 3. تحديث كلمة المرور فعلياً
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'كلمة المرور قصيرة جداً.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'كلمتا المرور غير متطابقتين.' });
      return;
    }

    setIsLoading(true);
    try {
        const result = await resetPasswordAdmin(phoneNumber, newPassword);
        if (result.success) {
            setIsDemoMode(!!result.demo);
            setStep('success');
        } else {
            throw new Error(result.error);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'فشل التحديث', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-mesh-gradient text-white overflow-y-auto no-scrollbar pb-10">
        {isLoading && <ProcessingOverlay message="جاري المعالجة..." />}

        <header className="p-4 flex items-center justify-between animate-in fade-in duration-500 shrink-0">
            <button 
              onClick={handleBack}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
            <div className="flex-1" />
            <div className="w-9" />
        </header>

        <div className="px-6 flex flex-col items-center flex-1 justify-center -mt-10">
          
          <div className="mb-8 text-center animate-in zoom-in duration-700">
             <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-white/20 rounded-[40px] blur-3xl animate-pulse" />
                <div className="relative w-full h-full bg-white/15 backdrop-blur-xl rounded-[36px] border-4 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden">
                    {step === 'phone' && <HelpCircle className="h-10 w-10 text-white stroke-[2.5px]" />}
                    {step === 'verify' && <Clock className="h-10 w-10 text-white stroke-[2.5px] animate-spin-slow" />}
                    {step === 'reset' && <ShieldCheck className="h-10 w-10 text-white stroke-[2.5px]" />}
                    {step === 'success' && <CheckCircle2 className="h-10 w-10 text-green-400 animate-in zoom-in-50 duration-500" />}
                </div>
             </div>
            
            {step === 'phone' && (
                <>
                    <h2 className="text-2xl font-black text-white">نسيت كلمة السر؟</h2>
                    <p className="text-white/70 text-[11px] font-bold mt-2 leading-relaxed max-w-[280px] mx-auto">
                        يرجى كتابة رقم جوالك لطلب كلمة المرور وسيتم ارسال لك كود التحقق الى رقم جوال في حال كنت مسجلاً لدينا ..
                    </p>
                </>
            )}

            {step === 'verify' && (
                <>
                    <h2 className="text-2xl font-black text-white">رمز التحقق</h2>
                    <p className="text-white/70 text-[11px] font-bold mt-2 leading-relaxed max-w-[280px] mx-auto">
                        أدخل الرمز المكون من 4 أرقام المرسل إلى الرقم <span className="text-white font-black">{phoneNumber}</span>
                    </p>
                </>
            )}

            {step === 'reset' && (
                <>
                    <h2 className="text-2xl font-black text-white">تغيير المرور</h2>
                    <p className="text-white/70 text-[11px] font-bold mt-2 leading-relaxed max-w-[280px] mx-auto">
                        أدخل كلمة المرور الجديدة وتأكد من حفظها جيداً.
                    </p>
                </>
            )}

            {step === 'success' && (
                <>
                    <h2 className="text-2xl font-black text-white">تم التحديث بنجاح!</h2>
                    <p className="text-white/70 text-[11px] font-bold mt-2 leading-relaxed max-w-[280px] mx-auto">
                        لقد تم تغيير كلمة المرور بنجاح. يمكنك الآن العودة لصفحة الدخول واستخدام كلمة المرور الجديدة.
                    </p>
                </>
            )}
          </div>

          <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-8 duration-1000">
            
            {step === 'phone' && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2 text-right">
                  <Label className="text-[10px] font-black mr-2 text-white/60 uppercase tracking-widest">ادخل رقم جوالك</Label>
                  <div className="relative group">
                    <Input
                      type="tel"
                      className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/30 text-center font-black text-base rounded-[20px] focus-visible:ring-white/40 shadow-inner"
                      placeholder="7xxxxxxxx"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      required
                    />
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-white text-[#0048ad] font-black text-base rounded-[20px] shadow-xl active:opacity-80 transition-all">
                    ارسال رمز التحقق
                </Button>
              </form>
            )}

            {step === 'verify' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2 text-right">
                        <Label className="text-[10px] font-black text-center block text-white/60 uppercase">أدخل الرمز المستلم</Label>
                        <Input
                            type="tel"
                            maxLength={4}
                            className="h-14 bg-white/10 border-white/20 text-white text-center text-3xl font-black tracking-[0.5em] rounded-[20px]"
                            placeholder="••••"
                            value={userOtpInput}
                            onChange={e => setUserOtpInput(e.target.value.replace(/\D/g, ''))}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full h-11 bg-white text-[#0048ad] font-black text-base rounded-[20px] shadow-xl active:opacity-80 transition-all">
                        تأكيد الرمز
                    </Button>
                </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black mr-2 text-white/60 uppercase tracking-widest">كلمة السر الجديدة</Label>
                    <Input
                      type="password"
                      className="h-11 bg-white/10 border-white/20 text-white rounded-[20px] text-center font-bold text-base focus-visible:ring-white/40 shadow-inner"
                      placeholder="********"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black mr-2 text-white/60 uppercase tracking-widest">تأكيد كلمة السر</Label>
                    <Input
                      type="password"
                      className="h-11 bg-white/10 border-white/20 text-white rounded-[20px] text-center font-bold text-base focus-visible:ring-white/40 shadow-inner"
                      placeholder="********"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-white text-[#0048ad] font-black text-base rounded-[20px] shadow-xl active:opacity-80 transition-all">
                    تحديث كلمة المرور
                </Button>
              </form>
            )}

            {step === 'success' && (
                <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                    <Button onClick={() => router.push('/')} className="w-full h-11 bg-white text-[#0048ad] font-black text-base rounded-[20px] shadow-xl active:opacity-80 transition-all">
                        تسجيل الدخول الآن
                    </Button>
                </div>
            )}

          </div>
        </div>

        <footer className="text-center text-[9px] font-black text-white/30 pb-6 mt-auto">
          <p>مطور التطبيق " محمد راضي باشادي</p>
        </footer>
      </div>
      <Toaster />
    </>
  );
}
