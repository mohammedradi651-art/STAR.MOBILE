
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { User, Phone, Lock, MapPin, Crown, ChevronRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';

export const dynamic = 'force-dynamic';

const locations = [
  'سيئون', 'شبام', 'الغرفة', 'تريم', 'ساة', 'القطن', 'الحوطة', 
  'وادي بن علي', 'العقاد', 'وادي عمد', 'وادي العين', 'وادي دوعن', 'بور', 'تاربة', 'الخشعة'
];

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState('');
  const [accountType, setAccountType] = useState('user');
  const [networkName, setNetworkName] = useState('');
  const [networkLocation, setNetworkLocation] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  const sendSmsOtp = async (targetPhone: string, otpCode: string) => {
    const smsMessage = `ستار موبايل: رمز التحقق الخاص بك هو (${otpCode}). يرجى إدخاله لإكمال إنشاء حسابك.`;
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

  const handleSignupInit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!location) {
        toast({ variant: "destructive", title: "بيانات ناقصة", description: "الرجاء اختيار موقعك من القائمة." });
        return;
    }

    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length < 4) {
      toast({ variant: "destructive", title: "خطأ", description: "الرجاء إدخال الاسم الرباعي الكامل." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "خطأ", description: "كلمتا المرور غير متطابقتين." });
      return;
    }

    if (phoneNumber.length !== 9) {
        toast({ variant: "destructive", title: "خطأ", description: "رقم الهاتف يجب أن يتكون من 9 أرقام." });
        return;
    }

    setIsLoading(true);

    try {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        const data = await sendSmsOtp(phoneNumber, otp);

        if (data.success) {
            // تخزين البيانات مؤقتاً للانتقال لصفحة التحقق
            const signupData = {
                fullName,
                phoneNumber,
                password,
                location,
                accountType,
                networkName,
                networkLocation,
                otp
            };
            sessionStorage.setItem('temp_signup_data', JSON.stringify(signupData));
            
            // تأخير خفيف لزيادة الفخامة قبل الانتقال
            setTimeout(() => {
                router.push('/verify-otp');
            }, 800);
        } else {
            throw new Error(data.error || "فشل إرسال رمز التحقق.");
        }

    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ في الإرسال", description: error.message });
        setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-mesh-gradient text-white pb-10 overflow-y-auto no-scrollbar">
        {isLoading && <ProcessingOverlay message="جاري انشاء حسابك..." />}

        <header className="p-4 flex items-center justify-between animate-in fade-in duration-500 shrink-0">
            <Link href="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <ChevronRight className="h-5 w-5" />
            </Link>
            <h1 className="font-black text-sm text-white">سجل حساب جديد</h1>
            <div className="w-9" />
        </header>

        <div className="px-6 flex flex-col items-center">
          <div className="my-6 text-center animate-in zoom-in duration-700">
             <div className="relative w-20 h-20 mx-auto mb-3">
                <div className="absolute inset-0 bg-white/20 rounded-[30px] blur-2xl animate-pulse" />
                <div className="relative w-full h-full overflow-hidden rounded-[28px] border-4 border-white/30 shadow-2xl bg-white">
                    <Image src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" alt="Logo" fill className="object-cover" />
                </div>
             </div>
            <h2 className="text-xl font-black text-white">ستار موبايل</h2>
            <p className="text-white/70 text-[10px] font-bold mt-1 uppercase tracking-widest">سجل الآن واستمتع بالسرعة والأمان</p>
          </div>

          <form onSubmit={handleSignupInit} className="w-full space-y-4 animate-in slide-in-from-bottom-8 duration-1000 pb-10">
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black mr-3 text-white uppercase tracking-tighter">الاسم الرباعي الكامل</Label>
              <div className="relative group">
                <Input
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-11 text-sm rounded-[20px] focus-visible:ring-white/40"
                  placeholder="ادخل اسمك الرباعي"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <User className="absolute right-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-white/60 group-focus-within:text-white transition-colors" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black mr-3 text-white uppercase tracking-tighter">رقم الجوال</Label>
              <div className="relative group">
                <Input
                  type="tel"
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-11 text-center font-black text-base rounded-[20px] focus-visible:ring-white/40"
                  placeholder="7xxxxxxxx"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  maxLength={9}
                  required
                />
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-white/60 group-focus-within:text-white transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black mr-3 text-white uppercase tracking-tighter">كلمة المرور</Label>
                    <Input
                        type="password"
                        className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-4 pl-4 text-sm rounded-[20px] focus-visible:ring-white/40"
                        placeholder="********"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black mr-3 text-white uppercase tracking-tighter">تأكيد المرور</Label>
                    <Input
                        type="password"
                        className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-4 pl-4 text-sm rounded-[20px] focus-visible:ring-white/40"
                        placeholder="********"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 mr-3">
                <MapPin className="h-3.5 w-3.5 text-white/60" />
                <Label className="text-[10px] font-black text-white uppercase tracking-tighter">اختر مدينتك السكنية</Label>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto p-2 scrollbar-hide bg-black/10 rounded-[24px] border border-white/10">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={cn(
                      "h-10 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center text-center px-1",
                      location === loc 
                        ? "bg-white text-[#0048ad] border-white shadow-xl" 
                        : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black mr-3 text-white uppercase tracking-tighter">فئة الحساب المطلوب</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('user')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-[28px] border-2 transition-all gap-2",
                    accountType === 'user' 
                      ? "bg-white text-[#0048ad] border-white shadow-2xl scale-[1.03]" 
                      : "bg-white/5 border-white/10 text-white/60"
                  )}
                >
                  <User className={cn("h-6 w-6", accountType === 'user' ? "text-[#0048ad]" : "text-white/30")} />
                  <span className="text-[11px] font-black uppercase tracking-tight">مشترك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('network-owner')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-[28px] border-2 transition-all gap-2",
                    accountType === 'network-owner' 
                      ? "bg-white text-[#0048ad] border-white shadow-2xl scale-[1.03]" 
                      : "bg-white/5 border-white/10 text-white/60"
                  )}
                >
                  <Crown className={cn("h-6 w-6", accountType === 'network-owner' ? "text-[#0048ad]" : "text-white/30")} />
                  <span className="text-[11px] font-black uppercase tracking-tight">وكيل شبكة</span>
                </button>
              </div>
            </div>
            
            {accountType === 'network-owner' && (
              <div className="space-y-3 pt-3 animate-in fade-in zoom-in-95 duration-500 bg-white/10 p-5 rounded-[28px] border border-white/15 backdrop-blur-md shadow-xl">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black mr-3 text-white">اسم المنظومة أو الشبكة</Label>
                    <Input className="h-11 bg-white/10 border-white/10 text-white placeholder:text-white/40 rounded-xl text-sm" value={networkName} onChange={(e) => setNetworkName(e.target.value)} placeholder="مثال: شبكة الوادي" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black mr-3 text-white">عنوان موقع البث</Label>
                    <Input className="h-11 bg-white/10 border-white/10 text-white placeholder:text-white/40 rounded-xl text-sm" value={networkLocation} onChange={(e) => setNetworkLocation(e.target.value)} placeholder="مثال: وسط السوق" />
                 </div>
              </div>
            )}

            <div className="pt-4">
                <Button 
                    type="submit" 
                    className="w-full h-14 text-base font-black bg-white text-[#0048ad] hover:bg-white/95 rounded-[24px] shadow-2xl shadow-black/20 transition-all active:scale-95 disabled:opacity-50" 
                    disabled={isLoading}
                >
                    انشاء حساب
                </Button>
            </div>
          </form>
        </div>
      </div>
      <Toaster />
    </>
  );
}
