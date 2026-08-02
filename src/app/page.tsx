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
  // هذا يمنع "الوميض" (Flicker) المزعج عند فتح التطبيق
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto py-8">
          
          <div className="mb-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 bg-white/20 rounded-[35px] blur-xl" />
                <div className="relative w-full h-full overflow-hidden rounded-[30px] border-4 border-white/30 shadow-2xl bg-white">
                    <Image 
                        src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                        alt="Star Mobile Logo" 
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
            <h1 className="text-2xl font-black text-white">ستار موبايل</h1>
            <p className="text-white/70 text-[10px] font-bold mt-1 uppercase tracking-widest">عالم من الخدمات الرقمية</p>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[10px] font-black mr-2 text-white/60 uppercase">رقم الهاتف</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    className="h-12 bg-white/10 border-white/20 text-white text-center font-black text-base rounded-[20px] pr-11"
                    placeholder="7xxxxxxxx"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                  />
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[10px] font-black mr-2 text-white/60 uppercase">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    placeholder="********"
                    className="h-12 bg-white/10 border-white/20 text-white text-center font-black text-base rounded-[20px] px-11"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                    {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="text-right px-2 pt-1">
                  <Link href="/forgot-password" title="نسيت كلمة السر" className="text-[10px] font-black text-white/80 hover:text-white underline underline-offset-4 decoration-white/20">نسيت كلمة السر؟</Link>
                </div>
              </div>

              <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-black bg-white text-primary rounded-[20px] shadow-xl transition-transform active:scale-95" 
                  disabled={isLoading}
              >
                {isLoading ? <LoaderIcon className="animate-spin h-5 w-5" /> : 'دخول'}
              </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-white/50 text-[10px] font-bold">ليس لديك حساب؟</p>
            <Link href="/signup" className="mt-2 inline-block py-1.5 px-6 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 font-black text-white text-[11px]">انضم إلينا</Link>
          </div>
        </div>

        <footer className="text-center text-[8px] font-bold text-white/30 pb-6 mt-auto">
          <p>© STAR MOBILE - V1.6.4</p>
        </footer>
      </div>
      <Toaster />
    </>
  );
}
