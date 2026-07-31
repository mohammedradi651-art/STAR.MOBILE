'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertTriangle, Phone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth) {
      toast({ 
        variant: 'destructive', 
        title: 'خطأ في الاتصال', 
        description: 'تحذير: لم يتم اكتشاف إعدادات Firebase.' 
      });
      return;
    }

    if (!phoneNumber || !password) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال رقم الهاتف وكلمة المرور.' });
      return;
    }
    
    setIsLoading(true);
    const email = `${phoneNumber.trim()}@shabakat.com`;
    try {
      await signInWithEmailAndPassword(auth, email, password.trim());
    } catch (error: any) {
      console.error("Login error:", error);
      toast({ variant: 'destructive', title: 'فشل الدخول', description: 'رقم الهاتف أو كلمة المرور غير صحيحة.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || user) return null;

  return (
    <>
      <div className="flex flex-col h-full bg-mesh-gradient text-white overflow-y-auto no-scrollbar">
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto py-12">
          
          <div className="mb-8 text-center animate-in fade-in zoom-in duration-700">
            <div className="relative w-28 h-28 mx-auto mb-4">
                <div className="absolute inset-0 bg-white/20 rounded-[40px] blur-2xl animate-pulse" />
                <div className="relative w-full h-full overflow-hidden rounded-[36px] border-4 border-white/30 shadow-2xl bg-white">
                    <Image 
                        src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                        alt="Star Mobile Logo" 
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">ستار موبايل</h1>
            <p className="text-white/80 text-xs font-bold mt-1.5">عالم من الخدمات الرقمية بين يديك</p>
          </div>

          {!auth && (
            <div className="bg-destructive/20 border border-white/20 p-4 rounded-3xl mb-6 text-white text-xs flex items-start gap-3 backdrop-blur-md">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>تحذير: لم يتم اكتشاف إعدادات Firebase.</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-4 animate-in slide-in-from-bottom-8 duration-1000">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-[10px] font-black mr-2 text-white uppercase tracking-widest">رقم الهاتف</Label>
              <div className="relative group">
                <Input
                  id="phone"
                  type="tel"
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/70 text-center font-black text-base rounded-[20px] focus-visible:ring-white/40 transition-all group-hover:bg-white/15 pr-12"
                  placeholder="7xxxxxxxx"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 group-focus-within:text-white transition-colors" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" title="كلمة المرور" className="text-[10px] font-black mr-2 text-white uppercase tracking-widest">كلمة المرور</Label>
              <div className="relative group">
                <Input
                  id="password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder="********"
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/70 text-center font-black text-base rounded-[20px] focus-visible:ring-white/40 transition-all group-hover:bg-white/15 pr-12 pl-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 group-focus-within:text-white transition-colors" />
                <button 
                  type="button" 
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)} 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
                <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-black bg-white text-primary hover:bg-white/90 rounded-[20px] shadow-xl transition-all active:scale-95 disabled:opacity-50" 
                    disabled={isLoading}
                >
                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'دخول'}
                </Button>
            </div>
          </form>

          <div className="mt-6 text-center animate-in fade-in duration-1000 delay-500">
            <p className="text-white/70 text-xs font-bold">ليس لديك حساب؟</p>
            <Link href="/signup" className="mt-2 inline-block py-1.5 px-5 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all font-black text-white text-[11px]">انضم إلينا الآن</Link>
          </div>
        </div>

        <footer className="text-center text-[9px] font-bold text-white/50 pb-6 animate-in fade-in duration-1000">
          <p>© ستار موبايل - تطوير محمد راضي باشادي</p>
        </footer>
      </div>
      <Toaster />
    </>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
    <svg className={cn("animate-spin", className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);