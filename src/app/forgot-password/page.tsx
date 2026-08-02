'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Phone, ShieldCheck, Key, ChevronRight, CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { resetPasswordAdmin } from './action';

export const dynamic = 'force-dynamic';

type Step = 'phone' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  // 1. طلب استعادة الحساب (تم تعطيل الـ SMS مؤقتاً للتجربة)
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

      // الانتقال مباشرة لتعيين كلمة المرور (تجاوز الـ OTP مؤقتاً)
      setStep('reset');
      toast({ 
        title: 'تم التحقق', 
        description: 'تم العثور على حسابك بنجاح. يرجى تعيين كلمة مرور جديدة الآن.' 
      });

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setIsLoading(false);
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
            <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <ChevronRight className="h-5 w-5" />
            </Link>
            <h1 className="font-black text-[10px] uppercase tracking-[0.2em] opacity-60">Account Recovery</h1>
            <div className="w-9" />
        </header>

        <div className="px-6 flex flex-col items-center flex-1 justify-center -mt-10">
          
          <div className="mb-8 text-center animate-in zoom-in duration-700">
             <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="absolute inset-0 bg-white/20 rounded-[40px] blur-3xl animate-pulse" />
                <div className="relative w-full h-full bg-white/15 backdrop-blur-xl rounded-[36px] border-4 border-white/30 shadow-2xl flex items-center justify-center overflow-hidden">
                    {step === 'phone' && <HelpCircle className="h-14 w-14 text-white stroke-[2.5px]" />}
                    {step === 'reset' && <ShieldCheck className="h-14 w-14 text-white stroke-[2.5px]" />}
                    {step === 'success' && <CheckCircle2 className="h-14 w-14 text-green-400 animate-in zoom-in-50 duration-500" />}
                </div>
                {step === 'success' && (
                    <div className="absolute -top-2 -right-2 bg-green-500 p-2 rounded-2xl shadow-xl animate-bounce">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                )}
             </div>
            
            {step !== 'success' ? (
                <>
                    <h2 className="text-2xl font-black text-white">استعادة الحساب</h2>
                    <p className="text-white/70 text-[11px] font-bold mt-2 leading-relaxed max-w-[280px] mx-auto">
                        {step === 'phone' 
                            ? "يرجى كتابة رقم جوالك المسجل لتعيين كلمة مرور جديدة (تم تعطيل الرمز مؤقتاً للتجربة)."
                            : "أدخل كلمة المرور الجديدة وتأكد من حفظها جيداً."}
                    </p>
                </>
            ) : (
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
                  <Label className="text-[10px] font-black mr-2 text-white/60 uppercase tracking-widest">رقم الجوال المسجل</Label>
                  <div className="relative">
                    <Input
                      type="tel"
                      className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/30 text-center font-black text-xl rounded-[22px] focus-visible:ring-white/40"
                      placeholder="7xxxxxxxx"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      required
                    />
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 bg-white text-primary font-black text-base rounded-[22px] shadow-xl active:scale-95 transition-transform">
                    تحقق وابدأ الاستعادة
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
                      className="h-14 bg-white/10 border-white/20 text-white rounded-[22px] text-center font-bold text-lg focus-visible:ring-white/40"
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
                      className="h-14 bg-white/10 border-white/20 text-white rounded-[22px] text-center font-bold text-lg focus-visible:ring-white/40"
                      placeholder="********"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 bg-green-500 text-white font-black text-base rounded-[22px] shadow-xl active:scale-95 transition-all">
                    تحديث كلمة المرور
                </Button>
              </form>
            )}

            {step === 'success' && (
                <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                    <Button onClick={() => router.push('/')} className="w-full h-14 bg-white text-primary font-black text-base rounded-[22px] shadow-xl active:scale-95 transition-all">
                        تسجيل الدخول الآن
                    </Button>
                </div>
            )}

          </div>
        </div>

        <footer className="text-center text-[8px] font-bold text-white/30 pb-6 mt-auto">
          <p>© STAR MOBILE - SECURITY SYSTEM</p>
        </footer>
      </div>
      <Toaster />
    </>
  );
}
