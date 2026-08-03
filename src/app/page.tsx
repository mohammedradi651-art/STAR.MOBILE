'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Phone, Lock, Loader2 as LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  // منع ظهور هذه الصفحة نهائياً إذا كان المستخدم مسجلاً بالفعل
  if (!isUserLoading && user) {
    return null; 
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    if (!phoneNumber || !password) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال رقم الهاتف وكلمة المرور.' });
      return;
    }
    
    setIsLoading(true);
    const email = `${phoneNumber.trim()}@shabakat.com`;
    try {
      await signInWithEmailAndPassword(auth, email, password.trim());
      router.push('/login');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'فشل الدخول', description: 'تأكد من بياناتك وحاول مجدداً.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-mesh-gradient text-white overflow-y-auto no-scrollbar">
        {/* أنيميشن دخول فخم للمحتوى بالكامل: ظهور متدرج من الأسفل للأعلى */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto py-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="mb-8 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-white/20 rounded-[40px] blur-2xl" />
                <div className="relative w-full h-full overflow-hidden rounded-[32px] border-4 border-white/30 shadow-2xl bg-white">
                    <Image 
                        src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                        alt="Star Mobile Logo" 
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">ستار موبايل</h1>
            <p className="text-white/80 text-[11px] font-bold mt-2 uppercase tracking-[0.2em]">عالم من الخدمات الرقمية</p>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-5 pb-8">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-black mr-3 text-white/70 uppercase tracking-widest">رقم الهاتف</Label>
                <div className="relative group">
                  <Input
                    id="phone"
                    type="tel"
                    className="h-11 bg-white/10 border-2 border-white/20 text-white placeholder:text-white text-center font-black text-base rounded-[20px] pr-12 focus-visible:ring-white/40 focus-visible:border-white/40 transition-all shadow-inner"
                    placeholder="7xxxxxxxx"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                  />
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-white transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black mr-3 text-white/70 uppercase tracking-widest">كلمة المرور</Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    placeholder="********"
                    className="h-11 bg-white/10 border-2 border-white/20 text-white placeholder:text-white text-center font-black text-base rounded-[20px] px-12 focus-visible:ring-white/40 focus-visible:border-white/40 transition-all shadow-inner"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-white transition-colors" />
                  <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                    {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div className="text-right px-3 pt-1">
                  <Link href="/forgot-password" title="نسيت كلمة السر" className="text-[11px] font-black text-white/80 hover:text-white underline underline-offset-4 decoration-white/20 transition-all">نسيت كلمة السر؟</Link>
                </div>
              </div>

              <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-black bg-white text-[#0048ad] hover:bg-white/95 rounded-[20px] shadow-2xl shadow-black/20 transition-all active:opacity-80 disabled:opacity-50" 
                  disabled={isLoading}
              >
                {isLoading ? <LoaderIcon className="animate-spin h-6 w-6" /> : 'دخول'}
              </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">ليس لديك حساب؟</p>
            <Link href="/signup" className="mt-3 inline-block py-2 px-10 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 font-black text-white text-[12px] transition-all active:opacity-80">انضم إلينا الآن</Link>
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
