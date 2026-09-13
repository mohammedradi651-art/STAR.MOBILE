'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

/**
 * @fileOverview صفحة التحميل التعريفية (نسخة مطابقة للأصل 100%)
 * تقوم بعرض التصميم الأصلي الموجود في ملفات don مع تفعيل ميزة التثبيت PWA.
 */
export default function DownloadPage() {
  const { toast } = useToast();

  useEffect(() => {
    // التمرير السلس للروابط
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.hash && link.hash.startsWith('#')) {
        const targetElement = document.querySelector(link.hash);
        if (targetElement) {
          event.preventDefault();
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  const handleInstallApp = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast({ title: "شكراً لك", description: "جاري تثبيت تطبيق ستار موبايل على جهازك." });
      }
      (window as any).deferredPrompt = null;
    } else {
      toast({ 
        title: "تنبيه", 
        description: "التطبيق مثبت بالفعل أو يرجى الضغط على 'إضافة إلى الشاشة الرئيسية' من قائمة المتصفح." 
      });
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800;900&family=Manrope:wght@500;600;700;800&display=swap');
        
        /* الأنماط المأخوذة من ملف styles.css و index.html الأصلي */
        .don-page-root { 
            font-family: 'Alexandria', sans-serif; 
            background: #f5f7fb; 
            color: #182044; 
            direction: rtl;
            overflow-x: hidden;
            min-height: 100vh;
        }
        .site-shell {
            background: radial-gradient(circle at 77% 8%,rgba(255,148,119,.12),transparent 20%),
                        radial-gradient(circle at 9% 38%,rgba(93,123,224,.08),transparent 24%),
                        linear-gradient(135deg,#f7f9fd 0%,#fff 52%,#f6f8fc 100%);
        }
        .container { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
        .topbar { height: 82px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(190,205,223,.55); }
        .brand-logo { width: 126px; height: 52px; object-fit: contain; }
        .hero { display: grid; grid-template-columns: 1.02fr .98fr; gap: 72px; padding-top: 40px; min-height: 620px; }
        .eyebrow { color: #0758ae; font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #0758ae; box-shadow: 0 0 0 5px rgba(7,88,174,.1); }
        h1 { font-size: clamp(43px, 5.8vw, 70px); line-height: 1.28; letter-spacing: -1.8px; color: #122d5b; margin: 22px 0 20px; font-weight: 900; }
        h1 em { font-style: normal; color: #0758ae; }
        .hero-text { color: #71809a; font-size: 12px; line-height: 2.15; max-width: 475px; margin-bottom: 29px; }
        .hero-actions { display: flex; gap: 12px; }
        .primary-btn { 
            height: 50px; border-radius: 10px; padding: 0 24px; cursor: pointer; border: none;
            background: #0758ae; color: #fff; font-weight: 800; font-size: 14px;
            box-shadow: 0 8px 18px rgba(7,88,174,0.2); transition: all 0.3s;
        }
        .primary-btn:active { transform: scale(0.95); }
        .secondary-btn { 
            height: 50px; border-radius: 10px; padding: 0 24px; text-decoration: none; display: inline-flex; align-items: center;
            border: 1px solid #dfe7f1; color: #122d5b; background: #fff; font-weight: 800; font-size: 14px;
        }
        .hero-visual { position: relative; height: 550px; }
        .phone { 
            width: 275px; height: 530px; background: #1a234d; border-radius: 34px; padding: 8px; 
            transform: rotate(2.5deg); box-shadow: 0 28px 50px rgba(26,65,113,.22); 
            position: relative; z-index: 2; margin: 0 auto;
        }
        .phone-screen { height: 100%; border-radius: 28px; background: #dfe6ef; overflow: hidden; }
        .phone-preview-image { width: 100%; height: 100%; object-fit: cover; }
        .hero-brand { 
            position: absolute; left: 0; top: 35px; z-index: 4; width: 118px; height: 118px; 
            padding: 14px; background: #fff; border-radius: 27px; box-shadow: 0 18px 32px rgba(28,62,102,.14);
            transform: rotate(-7deg);
        }
        .hero-brand img { width: 100%; height: 100%; object-fit: contain; border-radius: 16px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: #fff; border: 1px solid #dfe7f1; border-radius: 14px; margin-top: 20px; }
        .stats > div { padding: 22px 10px; border-left: 1px solid #dfe7f1; text-align: center; }
        .stats > div:last-child { border-left: none; }
        .stats strong { display: block; font-size: 25px; color: #0758ae; font-family: 'Manrope', sans-serif; }
        .stats small { color: #71809a; font-size: 9px; }
        .services-section { padding: 100px 0; }
        .service-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .feature-card { 
            min-height: 286px; padding: 25px 27px; border-radius: 20px; background: #fff; 
            border: 1px solid #e5ebf2; box-shadow: 0 15px 35px rgba(33,66,105,0.05);
        }
        .feature-card.featured { background: linear-gradient(145deg, #0b4d9f, #0965bd); color: #fff; }
        .footer { padding: 40px 0; border-top: 1px solid #dfe7f1; text-align: center; display: flex; flex-direction: column; gap: 12px; }
        
        @media(max-width: 650px) {
            .hero { grid-template-columns: 1fr; gap: 40px; text-align: center; }
            .hero-actions { justify-content: center; flex-direction: column; }
            .phone { width: 240px; height: 464px; }
            .stats { grid-template-columns: repeat(2, 1fr); }
            .stats > div:nth-child(2) { border-left: none; }
            .stats > div:nth-child(3), .stats > div:nth-child(4) { border-top: 1px solid #dfe7f1; }
            .service-cards { grid-template-columns: 1fr; }
        }
      ` }} />

      <div className="don-page-root site-shell">
        <header className="topbar container">
          <div className="brand">
            <img src="/don/Untitled-1.png" alt="Star Mobile" className="brand-logo" />
          </div>
          <nav className="desktop-nav" style={{ display: 'flex', gap: '30px' }}>
            <a href="#home" style={{ fontSize: '13px', fontWeight: 'bold', color: '#122d5b', textDecoration: 'none' }}>الرئيسية</a>
            <a href="#services" style={{ fontSize: '13px', fontWeight: 'bold', color: '#71809a', textDecoration: 'none' }}>الخدمات</a>
          </nav>
        </header>

        <main id="home">
          <section className="hero container">
            <div className="hero-copy">
              <div className="eyebrow"><span className="live-dot"></span> أكثر من 10,000 مستخدم يثقون بنا</div>
              <h1>خدماتك كلها،<br /><em>بلمسة ستار.</em></h1>
              <p className="hero-text">سدد، اشحن، واستعلم عن كل خدمات الاتصالات والألعاب والإنترنت في اليمن من تطبيق واحد. سريع، موثوق، ومصمم لك.</p>
              
              <div className="hero-actions">
                <button className="primary-btn" onClick={handleInstallApp}>
                   تحميل التطبيق ↓
                </button>
                <a className="secondary-btn" href="https://star26.vercel.app" target="_blank" rel="noopener">
                   فتح نسخة الويب ▶
                </a>
              </div>

              <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', direction: 'ltr' }}>
                    {[1,2,3].map(i => <span key={i} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #fff', background: '#ccc', marginLeft: '-8px' }}></span>)}
                </div>
                <div>
                    <div style={{ color: '#ffad35', fontSize: '14px' }}>★★★★★ <b>4.9</b></div>
                    <small style={{ color: '#71809a', fontSize: '10px' }}>تقييم المستخدمين</small>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-brand">
                <img src="/don/Untitled-1.png" alt="Logo" />
              </div>
              <div className="phone">
                <div className="phone-screen">
                  <img src="/don/لقطة شاشة 2026-09-11 174421.png" alt="App Preview" className="phone-preview-image" />
                </div>
              </div>
            </div>
          </section>

          <section className="stats container">
            <div><strong>10K+</strong><small>مستخدم سعيد</small></div>
            <div><strong>150+</strong><small>شبكة محلية</small></div>
            <div><strong>24/7</strong><small>خدمة متاحة</small></div>
            <div><strong>99%</strong><small>عمليات ناجحة</small></div>
          </section>

          <section className="services-section container" id="services">
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '32px', color: '#122d5b', fontWeight: '900' }}>كل خدماتك في مكان واحد</h2>
                <p style={{ color: '#71809a', fontSize: '14px', marginTop: '10px' }}>من شحن الرصيد إلى دفع الألعاب، ستار موبايل يجعل كل شيء أسرع وأسهل.</p>
            </div>
            
            <div className="service-cards">
              <div className="feature-card featured">
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>سداد الاتصالات</h3>
                <p style={{ fontSize: '13px', opacity: 0.8, lineHeight: '1.8' }}>اشحن وسدد جميع خدمات يمن موبايل، يو، يمن فورجي، الثابت والإنترنت الأرضي وعدن نت.</p>
              </div>
              <div className="feature-card">
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>كروت الإنترنت</h3>
                <p style={{ fontSize: '13px', color: '#71809a', lineHeight: '1.8' }}>أكثر من 150 شبكة إنترنت محلية لشراء الكروت بكل سهولة وبشكل فوري.</p>
              </div>
              <div className="feature-card">
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>الألعاب والترفيه</h3>
                <p style={{ fontSize: '13px', color: '#71809a', lineHeight: '1.8' }}>سدد واشحن ألعابك المفضلة فوراً بدون تعقيد أو انتظار، ببجي وفري فاير.</p>
              </div>
              <div className="feature-card">
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>منظومة الوادي</h3>
                <p style={{ fontSize: '13px', color: '#71809a', lineHeight: '1.8' }}>استعلم وجدد كروت منظومة الوادي من مكانك وبضغطة واحدة وبدون أي عناء.</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer container">
          <img src="/don/Untitled-1.png" alt="Star Mobile" style={{ width: '100px', margin: '0 auto' }} />
          <p style={{ fontSize: '12px', color: '#71809a' }}>خدماتك كلها، بلمسة ستار.</p>
          <span style={{ fontSize: '10px', color: '#71809a opacity: 0.5' }}>© 2026 ستار موبايل</span>
        </footer>
      </div>
      <Toaster />
    </>
  );
}
