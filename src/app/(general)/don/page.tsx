'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

/**
 * @fileOverview صفحة التحميل التعريفية النهائية المحدثة
 * إصلاح شامل: الشعارات مربعة منحنية، الشعار العائم مرتفع، والجوال يظهر كاملاً.
 */
export default function DownloadPage() {
  const { toast } = useToast();

  useEffect(() => {
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
        .topbar { height: 90px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(190,205,223,.55); }
        
        /* شعار الهيدر - مربع منحني */
        .brand-logo { 
            width: 65px; 
            height: 65px; 
            object-fit: contain; 
            border-radius: 20px; 
            margin-left: 20px; 
            box-shadow: 0 8px 20px rgba(0,0,0,0.08); 
            background: #fff;
            padding: 8px;
        }
        
        .hero { display: grid; grid-template-columns: 1.02fr .98fr; gap: 72px; padding-top: 40px; min-height: 700px; align-items: center; }
        .eyebrow { color: #0758ae; font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #0758ae; box-shadow: 0 0 0 5px rgba(7,88,174,.1); }
        h1 { font-size: clamp(43px, 5.8vw, 70px); line-height: 1.28; letter-spacing: -1.8px; color: #122d5b; margin: 22px 0 20px; font-weight: 900; }
        h1 em { font-style: normal; color: #0758ae; }
        .hero-text { color: #71809a; font-size: 12px; line-height: 2.15; max-width: 475px; margin-bottom: 29px; }
        .hero-actions { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; }
        .primary-btn { 
            height: 55px; border-radius: 16px; cursor: pointer; border: none;
            background: #0758ae; color: #fff; font-weight: 800; font-size: 15px;
            box-shadow: 0 10px 25px rgba(7,88,174,0.25); transition: all 0.3s;
            display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .primary-btn:active { transform: scale(0.95); }
        .secondary-btn { 
            height: 55px; border-radius: 16px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px;
            border: 2.5px solid #0758ae; color: #0758ae; background: #fff; font-weight: 800; font-size: 15px; transition: all 0.3s;
        }
        .secondary-btn:active { background: #f0f7ff; transform: scale(0.95); }
        
        /* منطقة العرض - تم زيادة الارتفاع لظهور الجوال كاملاً */
        .hero-visual { position: relative; height: 680px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
        
        .phone { 
            width: 285px; height: 580px; background: #1a234d; border-radius: 40px; padding: 10px; 
            transform: rotate(2.5deg); box-shadow: 0 35px 70px rgba(26,65,113,0.3); 
            position: relative; z-index: 2;
        }
        .phone-screen { height: 100%; border-radius: 32px; background: #dfe6ef; overflow: hidden; position: relative; }
        .phone-preview-image { width: 100%; height: 100%; object-fit: cover; }
        
        /* الشعار العائم - مربع منحني ومرفوع وصغير */
        .hero-brand { 
            position: absolute; 
            left: -15px; 
            top: -45px; 
            z-index: 5; 
            width: 95px; 
            height: 95px; 
            padding: 12px; 
            background: #fff; 
            border-radius: 28px; 
            box-shadow: 0 20px 45px rgba(28,62,102,0.18);
            transform: rotate(-8deg); 
            display: flex; 
            align-items: center; 
            justify-content: center;
        }
        .hero-brand img { width: 100%; height: 100%; object-fit: contain; border-radius: 18px; }
        
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: #fff; border: 1px solid #dfe7f1; border-radius: 14px; margin-top: 20px; }
        .stats > div { padding: 22px 10px; border-left: 1px solid #dfe7f1; text-align: center; }
        .stats > div:last-child { border-left: none; }
        .stats strong { display: block; font-size: 25px; color: #0758ae; font-family: 'Manrope', sans-serif; }
        .stats small { color: #71809a; font-size: 9px; }
        
        .services-section { padding: 80px 0 60px; }
        
        /* الخدمات - 2 في سطر وتصميم موحد */
        .service-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .feature-card { 
            min-height: 220px; 
            padding: 24px; 
            border-radius: 28px; 
            background: linear-gradient(145deg, #0b4d9f, #0965bd); 
            color: #fff; 
            border: none; 
            box-shadow: 0 15px 35px rgba(5, 73, 157, 0.18);
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            text-align: center;
            transition: transform 0.3s;
        }
        .feature-card:active { transform: scale(0.97); }
        .feature-card h3 { font-size: 16px; font-weight: 800; margin-bottom: 10px; color: #fff; }
        .feature-card p { font-size: 11px; opacity: 0.95; line-height: 1.85; color: #fff; }
        
        .footer { padding: 40px 0 50px; border-top: 1px solid #dfe7f1; text-align: center; display: flex; flex-direction: column; gap: 12px; margin-top: 30px; }
        
        /* شعار التذييل - مربع منحني */
        .footer-logo {
            width: 85px;
            height: 85px;
            margin: 0 auto;
            border-radius: 24px;
            background: #fff;
            padding: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.06);
            object-fit: contain;
        }

        .avatar {
            width: 36px; height: 36px; border-radius: 50%; border: 2px solid #fff; 
            margin-left: -12px; display: flex; align-items: center; justify-content: center; 
            font-size: 13px; font-weight: 900; color: #fff; box-shadow: 0 6px 12px rgba(0,0,0,0.12);
        }

        @media(max-width: 650px) {
            .hero { grid-template-columns: 1fr; gap: 50px; text-align: center; padding-top: 30px; }
            .hero-copy { display: flex; flex-direction: column; align-items: center; }
            .hero-actions { width: 100%; }
            .phone { width: 260px; height: 530px; }
            .hero-visual { height: 580px; }
            .stats { grid-template-columns: repeat(2, 1fr); }
            .stats > div:nth-child(2) { border-left: none; }
            .stats > div:nth-child(3), .stats > div:nth-child(4) { border-top: 1px solid #dfe7f1; }
            .service-cards { gap: 12px; }
            .feature-card { min-height: 200px; padding: 20px; }
            .hero-brand { width: 80px; height: 80px; top: -35px; left: calc(50% - 155px); }
            .brand-logo { margin-left: 10px; width: 60px; height: 60px; }
        }
      ` }} />

      <div className="don-page-root site-shell">
        <header className="topbar container">
          <div className="brand" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/Untitled-1.png" alt="Star Mobile" className="brand-logo" />
          </div>
          <nav className="desktop-nav" style={{ display: 'flex', gap: '30px' }}>
            <a href="#home" style={{ fontSize: '14px', fontWeight: '900', color: '#122d5b', textDecoration: 'none' }}>الرئيسية</a>
            <a href="#services" style={{ fontSize: '14px', fontWeight: '900', color: '#71809a', textDecoration: 'none' }}>الخدمات</a>
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
                <a className="secondary-btn" href="https://star26.vercel.app" target="_blank" rel="noopener" style={{ textAlign: 'center' }}>
                   فتح نسخة الويب
                </a>
              </div>

              <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', direction: 'ltr' }}>
                    <div className="avatar" style={{ background: '#0048ad', zIndex: 3 }}>م</div>
                    <div className="avatar" style={{ background: '#B32C4C', zIndex: 2 }}>ح</div>
                    <div className="avatar" style={{ background: '#FECC4F', zIndex: 1 }}>س</div>
                    <div className="avatar" style={{ background: '#122d5b', fontSize: '10px', zIndex: 0 }}>+10K</div>
                </div>
                <div>
                    <div style={{ color: '#ffad35', fontSize: '16px' }}>★★★★★ <b>4.9</b></div>
                    <small style={{ color: '#71809a', fontSize: '11px', fontWeight: 'bold' }}>تقييم المستخدمين</small>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-brand">
                <img src="/Untitled-1.png" alt="Logo" />
              </div>
              <div className="phone">
                <div className="phone-screen">
                  <img src="/لقطة شاشة 2026-09-11 174421.png" alt="App Preview" className="phone-preview-image" />
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
            <div style={{ marginBottom: '45px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '34px', color: '#122d5b', fontWeight: '900' }}>كل خدماتك في مكان واحد</h2>
                <p style={{ color: '#71809a', fontSize: '15px', marginTop: '12px', fontWeight: 'bold' }}>من شحن الرصيد إلى دفع الألعاب، ستار موبايل يجعل كل شيء أسرع وأسهل.</p>
            </div>
            
            <div className="service-cards">
              <div className="feature-card">
                <h3>سداد الاتصالات</h3>
                <p>اشحن وسدد جميع خدمات يمن موبايل، يو، يمن فورجي، الثابت والنت الأرضي وعدن نت.</p>
              </div>
              <div className="feature-card">
                <h3>كروت الإنترنت</h3>
                <p>أكثر من 150 شبكة إنترنت محلية لشراء الكروت بكل سهولة وبشكل فوري.</p>
              </div>
              <div className="feature-card">
                <h3>الألعاب والترفيه</h3>
                <p>سدد واشحن ألعابك المفضلة فوراً بدون تعقيد أو انتظار، ببجي وفري فاير.</p>
              </div>
              <div className="feature-card">
                <h3>منظومة الوادي</h3>
                <p>استعلم وجدد كروت منظومة الوادي من مكانك وبضغطة واحدة وبدون أي عناء.</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer container">
          <img src="/Untitled-1.png" alt="Star Mobile" className="footer-logo" />
          <p style={{ fontSize: '14px', color: '#122d5b', fontWeight: '900' }}>خدماتك كلها، بلمسة ستار.</p>
          <span style={{ fontSize: '11px', color: '#71809a', opacity: 0.6, fontWeight: 'bold' }}>© 2026 ستار موبايل - جميع الحقوق محفوظة</span>
        </footer>
      </div>
      <Toaster />
    </>
  );
}
