'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Download, PlayCircle, Star, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

/**
 * صفحة تحميل التطبيق التعريفية (Star Mobile Download Page)
 * تم دمج التصميم الموجود في index.html لضمان الجمالية والوظيفة.
 */
export default function DownloadPage() {
  const { toast } = useToast();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstallApp = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    
    if (deferredPrompt) {
      setIsInstalling(true);
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast({ title: "شكراً لك", description: "جاري تثبيت تطبيق ستار موبايل على جهازك." });
      }
      (window as any).deferredPrompt = null;
      setIsInstalling(false);
    } else {
      // If prompt is not available, provide manual instructions
      toast({ 
        title: "تنبيه", 
        description: "التطبيق مثبت بالفعل أو يرجى استخدام متصفح كروم والضغط على 'إضافة إلى الشاشة الرئيسية' من القائمة." 
      });
    }
  };

  const services = [
    { title: "سداد الاتصالات", desc: "اشحن وسدد جميع خدمات يمن موبايل، يو، عدن نت.", icon: "⌁", color: "bg-primary" },
    { title: "كروت الإنترنت", desc: "أكثر من 150 شبكة إنترنت محلية لشراء الكروت.", icon: "▣", color: "bg-blue-600" },
    { title: "الألعاب والترفيه", desc: "سدد واشحن ألعابك المفضلة فوراً بدون تعقيد.", icon: "◈", color: "bg-orange-500" },
    { title: "منظومة الوادي", desc: "استعلم وجدد كروت منظومة الوادي بضغطة واحدة.", icon: "↻", color: "bg-indigo-600" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#172744] font-sans selection:bg-primary/10 overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_77%_8%,rgba(7,88,174,0.08),transparent_20%)] pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-6 h-20 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg border border-white">
                <Image src="/logo.jpeg" alt="Star Mobile" fill className="object-cover" />
            </div>
            <span className="font-black text-lg tracking-tight text-primary">ستار موبايل</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-8 pb-20">
        <div className="flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-top-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">أكثر من 10,000 مستخدم يثقون بنا</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            خدماتك كلها،<br />
            <span className="text-primary italic">بلمسة ستار.</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground font-bold leading-relaxed max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            سدد، اشحن، واستعلم عن كل خدمات الاتصالات والألعاب والإنترنت في اليمن من تطبيق واحد. سريع، موثوق، ومصمم لك.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <Button 
                onClick={handleInstallApp}
                className="h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex-1"
                disabled={isInstalling}
            >
              <Download className="ml-2 h-5 w-5" />
              تحميل التطبيق
            </Button>
            <Button 
                variant="outline"
                onClick={() => window.open('https://star26.vercel.app', '_blank')}
                className="h-14 rounded-2xl border-[#dfe7f1] text-[#122d5b] font-black text-lg bg-white shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex-1"
            >
              <PlayCircle className="ml-2 h-5 w-5 text-primary" />
              فتح نسخة الويب
            </Button>
          </div>

          <div className="pt-6 flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-500">
            <div className="flex -space-x-3 rtl:space-x-reverse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden relative">
                        <Image src={`https://picsum.photos/seed/${i+10}/100/100`} alt="user" fill />
                    </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[10px] font-black text-white">+10K</div>
            </div>
            <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 text-yellow-400">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                    <span className="text-[#172744] font-black mr-1 text-sm">4.9</span>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">تقييم المستخدمين</span>
            </div>
          </div>
        </div>

        {/* Visual Preview */}
        <div className="mt-16 relative max-w-[300px] mx-auto animate-in zoom-in-95 duration-1000 delay-300">
            <div className="absolute inset-0 bg-primary/10 rounded-[50px] blur-3xl transform rotate-6 scale-110" />
            <div className="relative bg-[#1a234d] p-2 rounded-[40px] shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-700">
                <div className="relative aspect-[9/18.5] w-full rounded-[34px] overflow-hidden border-2 border-white/10 bg-slate-100">
                    <Image 
                        src="/don/preview.png" 
                        alt="Star Mobile Preview" 
                        fill 
                        className="object-cover"
                        onError={(e: any) => e.target.src = "https://i.postimg.cc/SNtjK4ZZ/IMG-20260224-WA0012.jpg"}
                    />
                </div>
            </div>
            
            {/* Floating Cards */}
            <div className="absolute -right-12 top-1/4 bg-white p-3 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce duration-[3000ms] hidden sm:flex">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
                <div className="text-right">
                    <p className="text-[10px] font-black">عملية ناجحة</p>
                    <p className="text-[8px] font-bold text-muted-foreground">تم السداد بنجاح</p>
                </div>
            </div>
        </div>

        {/* Services Section */}
        <section className="mt-32 space-y-10">
            <div className="text-center space-y-3">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Star Services</span>
                <h2 className="text-3xl font-black text-[#122d5b]">كل خدماتك في مكان واحد</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {services.map((s, idx) => (
                    <Card key={idx} className="group p-6 rounded-[30px] border-[#dfe7f1] bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden relative">
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full border border-slate-100 group-hover:scale-150 transition-transform duration-700" />
                        <div className="relative z-10">
                            <span className="text-[10px] font-black text-muted-foreground/40 mb-4 block">0{idx+1}</span>
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl text-white mb-6 shadow-lg", s.color)}>
                                {s.icon}
                            </div>
                            <h3 className="font-black text-lg mb-2 text-[#122d5b]">{s.title}</h3>
                            <p className="text-xs font-bold text-muted-foreground leading-relaxed">{s.desc}</p>
                            <div className="w-8 h-1 bg-primary mt-6 rounded-full opacity-30 group-hover:w-16 transition-all" />
                        </div>
                    </Card>
                ))}
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-slate-200 flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2 opacity-50 grayscale">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                <Image src="/logo.jpeg" alt="Star Mobile" fill />
            </div>
            <span className="font-black text-sm tracking-tight">ستار موبايل</span>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            © 2026 ستار موبايل | خدماتك كلها، بلمسة ستار.
        </p>
      </footer>

      <Toaster />
    </div>
  );
}
