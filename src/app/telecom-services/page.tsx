'use client';

import React from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Smartphone, 
  Home
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const telecomServices = [
  {
    name: 'يمن موبايل',
    logo: 'https://i.postimg.cc/tTXzYWY3/1200x630wa.jpg',
    href: '/yemen-mobile',
    description: 'سداد فواتير، باقات، وشحن رصيد فوري',
    color: '#B32C4C',
    accent: 'bg-[#B32C4C]/5'
  },
  {
    name: 'YOU',
    logo: 'https://i.postimg.cc/Y9hz6kzg/shrkt-yw.jpg',
    href: '/you-services',
    description: 'سداد فواتير وباقات شركة YOU المباشرة',
    color: '#FECC4F',
    accent: 'bg-[#FECC4F]/10'
  },
  {
    name: 'عدن نت',
    logo: 'https://i.postimg.cc/FFV6dDqd/FB-IMG-1770843160346.jpg',
    href: '/aden-net',
    description: 'استعلام وسداد باقات عدن نت 4G',
    color: '#1FB8C0',
    accent: 'bg-[#1FB8C0]/5'
  },
  {
    name: 'يمن فورجي',
    logo: 'https://i.postimg.cc/FsmGqt98/1768999789252.jpg',
    href: '/yemen-4g',
    description: 'استعلام وسداد باقات يمن فورجي الجديدة',
    color: '#106BA2',
    accent: 'bg-[#106BA2]/5'
  },
  {
    name: 'الثابت والإنترنت ADSL',
    logo: 'https://i.postimg.cc/ZRHzd8jN/FB-IMG-1768999572493.jpg',
    href: '/internet-landline',
    description: 'سداد فواتير الهاتف الثابت ونت ADSL المنزلي',
    color: '#302C81',
    accent: 'bg-[#302C81]/5'
  },
];

export default function TelecomServicesPage() {
  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
      <SimpleHeader title="رصيد وباقات" />
      
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="bg-mesh-gradient pt-6 pb-10 px-6 rounded-b-[40px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-3">
                <div className="bg-white/20 p-3 rounded-[24px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <Smartphone className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">تسديد شبكات</h2>
                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-[0.2em]">الاتصالات اليمنية</p>
                </div>
            </div>
        </div>

        {/* Services List */}
        <div className="px-4 mt-6 pb-10 space-y-3">
          {telecomServices.map((service, index) => (
            <Link href={service.href} key={service.name} className="block">
              <Card
                className={cn(
                    "cursor-pointer border-none shadow-md rounded-[28px] overflow-hidden group hover:shadow-lg transition-all active:scale-[0.98] animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                    "bg-card"
                )}
                style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className={cn("p-0.5 rounded-[18px] shrink-0 border border-muted/50 shadow-inner", service.accent)}>
                        <div className="relative h-14 w-14 overflow-hidden rounded-[16px] shadow-sm">
                            <Image
                                src={service.logo}
                                alt={`${service.name} logo`}
                                fill
                                className="object-cover transition-transform group-hover:scale-110 duration-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 text-right overflow-hidden">
                        <h4 className="font-black text-base text-foreground group-hover:text-primary transition-colors mb-0.5">
                            {service.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground font-bold leading-relaxed line-clamp-1 opacity-80">
                            {service.description}
                        </p>
                    </div>

                    <div className="p-2 bg-muted/50 rounded-xl group-hover:bg-primary/10 transition-colors">
                        <ChevronLeft className="h-4 w-4 text-primary" />
                    </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
