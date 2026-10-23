'use client';

import React from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ShieldCheck, 
  Info, 
  UserCheck, 
  Key, 
  ScrollText, 
  Lock, 
  AlertCircle, 
  MessageCircle,
  FileCheck,
  X
} from 'lucide-react';

export default function PrivacyPolicyPage() {
  const sections = [
    {
      id: 1,
      title: '1. التعاريف',
      icon: Info,
      content: [
        '"التطبيق": يشير إلى تطبيق "ستار موبايل" المتاح على الأجهزة المحمولة والتطبيقات الداعمة.',
        '"المستخدم": كل شخص طبيعي أو اعتباري يقوم بتحميل واستخدام التطبيق.',
        '"الخدمة": جميع المزايا والوظائف التي يتيحها التطبيق، بما في ذلك شراء كروت الشبكات الإلكترونية وشحن الرصيد وتجديد كروت منظومة الوادي وشراء شدات ببجي.'
      ]
    },
    {
      id: 2,
      title: '2. القبول بالشروط',
      icon: UserCheck,
      content: [
        'باستخدامك للتطبيق، فإنك تقر بقبولك لهذه الشروط والأحكام وسياسة الاستخدام، وتوافق على الالتزام بها دون تحفظ.'
      ]
    },
    {
      id: 3,
      title: '3. التسجيل والحساب',
      icon: Key,
      content: [
        '3.1. يتعين على المستخدم إنشاء حساب شخصي ببيانات صحيحة وكاملة.',
        '3.2. يتحمل المستخدم مسؤولية الحفاظ على سرية اسم المستخدم وكلمة المرور وأي نشاط يحدث تحت حسابه.'
      ]
    },
    {
      id: 4,
      title: '4. شروط استخدام الخدمة',
      icon: FileCheck,
      content: [
        '4.1. يحق للمستخدم شراء رصيد وشحنه إلى حسابه داخل التطبيق وفق الطرق المتاحة (تحويل بنكي، تسليم نقدي).',
        '4.2. يجب أن يكون رقم الهاتف المسجل مفعّل لاستقبال الإشعارات.'
      ]
    },
    {
      id: 5,
      title: '5. الالتزامات والقيود',
      icon: AlertCircle,
      content: [
        '5.1. يحظر استخدام التطبيق لأي غرض غير قانوني أو غير مصرح به.',
        '5.2. لا يحق للمستخدم نشر أو تبادل محتوى ينتهك حقوق الآخرين أو القوانين المعمول بها.'
      ]
    },
    {
      id: 6,
      title: '6. حقوق الملكية الفكرية',
      icon: ShieldCheck,
      content: [
        'جميع الحقوق المتعلقة بالتطبيق ومحتواه (نصوص، صور، شعارات، أكواد) ملك لصاحب المشروع، ولا يجوز للمستخدم نسخها أو إعادة نشرها دون إذن خطي.'
      ]
    },
    {
      id: 7,
      title: '7. التعويضات',
      icon: ScrollText,
      content: [
        'يتعهد المستخدم بتعويض الشركة عن أي خسائر أو أضرار تنشأ عن استخدامه المخالف لهذه الشروط.'
      ]
    },
    {
      id: 8,
      title: '8. إيقاف الحساب وإنهاء الخدمة',
      icon: X,
      content: [
        '8.1. يحق للشركة تعليق أو إلغاء حساب المستخدم في حال خرقه لأحد البنود.',
        '8.2. يحق للشركة تعديل أو إيقاف الخدمة جزئيًا أو كليًا في أي وقت دون إشعار مسبق.'
      ]
    },
    {
      id: 9,
      title: '9. الإعفاء من المسؤولية',
      icon: Lock,
      content: [
        'لا تتحمل الشركة المسؤولية عن أي انقطاع أو تأخير في توفر الخدمة نتيجة لأسباب خارجة عن إرادتها.'
      ]
    },
    {
      id: 10,
      title: '10. سياسة الخصوصية',
      icon: ShieldCheck,
      content: [
        '10.1. نقوم بجمع البيانات الشخصية (الاسم، رقم الهاتف، البريد الإلكتروني) لتحسين الخدمة وتنفيذ الطلبات.',
        '10.2. لا نشارك بيانات المستخدم مع أي طرف ثالث إلا للضرورة القانونية أو تشغيل الخدمة.',
        '10.3. يمكن للمستخدم طلب الاطلاع أو تعديل أو حذف بياناته وفق الأنظمة المعمول بها.'
      ]
    },
    {
      id: 11,
      title: '11. التعديلات على الشروط',
      icon: RefreshCw,
      content: [
        'يسرّ الشركة تعديل هذه الشروط في أي وقت، وسيتم إشعار المستخدمين بأي تغيير من خلال التطبيق أو رسالة واتس اب على رقمه.'
      ]
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
      <SimpleHeader title="سياسة الخصوصية" />
      
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-6">
        
        <div className="text-center space-y-2 mb-8">
            <div className="bg-primary/10 w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-4 border border-primary/5 shadow-inner">
                <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-black text-foreground">شروط وأحكام الاستخدام</h1>
            <p className="text-xs text-muted-foreground font-bold">تطبيق ستار موبايل - Star Mobile</p>
        </div>

        <div className="space-y-4">
            {sections.map((section) => (
                <Card key={section.id} className="border-none shadow-sm rounded-[28px] overflow-hidden bg-card animate-in fade-in-0 slide-in-from-bottom-2" style={{ animationDelay: `${section.id * 50}ms` }}>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/5 rounded-xl">
                                <section.icon className="h-5 w-5 text-primary" />
                            </div>
                            <h2 className="font-black text-base text-primary">{section.title}</h2>
                        </div>
                        <div className="space-y-3">
                            {section.content.map((p, idx) => (
                                <p key={idx} className="text-sm font-bold text-foreground/80 leading-relaxed text-right">
                                    {p}
                                </p>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>

        <div className="pt-6">
            <Card className="bg-mesh-gradient border-none rounded-[32px] shadow-lg text-white text-center">
                <CardContent className="p-8 space-y-4">
                    <MessageCircle className="h-10 w-10 mx-auto opacity-80" />
                    <div className="space-y-1">
                        <h3 className="font-black text-lg text-white">لديك استفسار؟</h3>
                        <p className="text-xs opacity-80 font-bold">للاستفسارات حول الخصوصية والشروط:</p>
                    </div>
                    <a 
                        href="https://api.whatsapp.com/send?phone=967770326828" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-white/20 backdrop-blur-md rounded-2xl py-3 px-6 inline-block border border-white/10 active:scale-95 transition-transform"
                    >
                        <p className="font-black text-base tracking-widest text-white">770326828</p>
                    </a>
                    <p className="text-[10px] opacity-60 font-bold">راسلنا على واتساب وسنكون سعداء بخدمتك</p>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}

const RefreshCw = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
        <path d="M3 21v-5h5"/>
    </svg>
);
