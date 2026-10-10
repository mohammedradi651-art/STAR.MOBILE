'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  CheckCircle, 
  Loader2, 
  RefreshCw, 
  Smile, 
  Frown, 
  Zap, 
  ShieldCheck, 
  Database, 
  Globe,
  Mail,
  Phone as PhoneIcon,
  Clock,
  AlertCircle,
  Hash,
  Calendar,
  Smartphone,
  Users
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, increment, collection as firestoreCollection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import Image from 'next/image';
import { initiateTelecomPayment, executeTelecomRequestWithTimeout } from '@/lib/telecom-order';
import { useServicesConfig } from '@/hooks/use-services-config';
import { roundCurrency, isUserApiCustomer, getUserServicePrice } from '@/lib/services-config';

export const dynamic = 'force-dynamic';

type BillingInfo = {
    balance: number;
    customer_type: string;
    baseType?: string;
    simGeneration?: string;
    resultDesc?: string;
    isLoan: boolean;
    loanAmount?: number;
};

type ActiveOffer = {
    offerName: string;
    startDate: string;
    expireDate: string;
    offertype?: string;
};

type Offer = {
    offerName: string;
    offerId: string;
    price: number;
    data?: string;
    sms?: string;
    minutes?: string;
    validity?: string;
    offertype: string; 
    id?: string; 
};

const YEMEN_MOBILE_PRIMARY = '#B32C4C';
const YEMEN_MOBILE_GRADIENT = {
    backgroundColor: '#B32C4C',
    backgroundImage: `
        radial-gradient(at 0% 0%, #D14566 0px, transparent 50%),
        radial-gradient(at 100% 100%, #8A1F38 0px, transparent 50%)
    `
};

const PREPAID_CATEGORIES = [
  {
    id: 'mazaya',
    title: 'باقات مزايا',
    badge: '3G',
    icon: ShieldCheck,
    offers: [
      { offerId: 'm_monthly', offerName: 'مزايا الشهرية', price: 1300, data: '250 MB', sms: '350', minutes: '350', validity: '30 يوم', offertype: 'A38394' },
      { offerId: 'm_weekly', offerName: 'مزايا الاسبوعة', price: 485, data: '90 MB', sms: '30', minutes: '100', validity: '7 أيام', offertype: 'A64329' },
      { offerId: 'm_max', offerName: 'مزايا ماكس الشهرية', price: 2000, data: '600 MB', sms: '200', minutes: '500', validity: '30 يوم', offertype: 'A75328' },
      { offerId: 'm_connect', offerName: 'مزايا تواصل', price: 1500, data: '-', sms: '600', minutes: '600', validity: '30 يوم', offertype: 'A33881' },
      { offerId: 'm_connect_max', offerName: 'مزايا تواصل ماكس', price: 2000, data: '-', sms: '500', minutes: '1000', validity: '30 يوم', offertype: 'A33882' },
    ]
  },
  {
    id: '4g_mazaya',
    title: 'باقات مزايا فورجي',
    badge: '4G',
    icon: Zap,
    offers: [
      { offerId: 'super_4g', offerName: 'سوبر فورجي', price: 2000, data: '3GB', sms: '250', minutes: '250', validity: '30 يوم', offertype: 'A5533822' },
      { offerId: '4g_24h', offerName: 'مزايا فورجي 24 ساعة', price: 300, data: '512MB', sms: '30', minutes: '20', validity: '24 ساعة', offertype: 'A4826' },
      { offerId: '4g_48h', offerName: 'مزايا فورجي 48 ساعة', price: 600, data: '1GB', minutes: '50', sms: '100', validity: '48 ساعة', offertype: 'A88337' },
      { offerId: '4g_weekly', offerName: 'مزايا فورجي الاسبوعية', price: 1500, data: '2GB', minutes: '200', sms: '300', validity: '7 أيام', offertype: 'A88336' },
      { offerId: 'm_tawfeer', offerName: 'مزايا توفير الشهرية', price: 2400, data: '4GB', minutes: '450', sms: '450', validity: '30 يوم', offertype: 'A3823' },
      { offerId: '4g_monthly', offerName: 'مزايا فورجي الشهرية', price: 2500, data: '4GB', minutes: '300', sms: '350', validity: '30 يوم', offertype: 'A88335' },
      { offerId: 'm_max_4g', offerName: 'مزايا ماكس فورجي', price: 4000, data: '4GB', minutes: '1100', sms: '600', validity: '30 يوم', offertype: 'A88441' },
      { offerId: 'm_aamal_4g', offerName: 'مزايا أعمال فورجي', price: 5000, data: '6GB', minutes: '1500', sms: '1000', validity: 'شهر', offertype: 'A39053' },
      { offerId: 'sms_800_pre', offerName: 'باقة 800 رسالة', price: 1000, data: '-', minutes: '-', sms: '800', validity: 'شهر', offertype: 'A31338' },
    ]
  },
  {
    id: '4g_net',
    title: 'باقات نت فورجي',
    badge: '4G',
    icon: Database,
    offers: [
        { offerId: 'net_4g_4gb', offerName: 'نت فورجي 4 قيقا', price: 2000, data: '4GB', validity: '30 يوم', offertype: 'A4821' },
        { offerId: 'net_8g_4gb', offerName: 'نت فورجي 8 قيقا', price: 3900, data: '8GB', validity: '30 يوم', offertype: 'A4828' },
        { offerId: 'net_20g_4gb', offerName: 'نت فورجي 20 قيقا', price: 9700, data: '20GB', validity: '30 يوم', offertype: 'A4830' },
        { offerId: 'net_tawfeer_weekly', offerName: 'نت توفير الاسبوعية', price: 1125, data: '3GB', validity: '7 أيام', offertype: 'A3435' },
        { offerId: 'net_tawfeer_monthly', offerName: 'نت توفير الشهرية', price: 2250, data: '6GB', validity: '30 يوم', offertype: 'A3436' },
        { offerId: 'net_tawfeer_5gb', offerName: 'نت توفير 5 قيقا', price: 2300, data: '5GB', validity: '30 يوم', offertype: 'A3825' },
        { offerId: 'net_tawfeer_7gb', offerName: 'نت توفير 7 قيقا', price: 3000, data: '7GB', validity: 'شهر', offertype: 'A4821' },
        { offerId: 'net_tawfeer_11gb', offerName: 'نت توفير 11 قيقا', price: 4125, data: '11GB', validity: 'شهر', offertype: 'A34346' },
        { offerId: 'net_tawfeer_25gb', offerName: 'نت توفير 25 قيقا', price: 8830, data: '25GB', validity: '40 يوم', offertype: 'A3347' },
    ]
  },
  {
    id: 'monthly_net',
    title: 'باقات الانترنت الشهرية',
    badge: 'Net',
    icon: Globe,
    offers: [
      { offerId: 'net_150mb', offerName: 'نت ثري جي 150 ميقا', price: 500, data: '150 ميجا', validity: 'شهر', offertype: 'A69329' },
      { offerId: 'net_300mb', offerName: 'نت ثري جي 300 ميقا', price: 900, data: '300 ميجا', validity: 'شهر', offertype: 'A69330' },
      { offerId: 'net_700mb', offerName: 'نت ثري جي 700 ميقا', price: 1800, data: '700 ميجا', validity: 'شهر', offertype: 'A69338' },
      { offerId: 'net_1500mb', offerName: 'نت ثري جي 1500 ميقا', price: 3300, data: '1500 ميجا', validity: 'شهر', offertype: 'A69345' },
    ]
  },
  {
    id: 'volte',
    title: 'باقات فولتي',
    badge: 'VoLTE',
    icon: Zap,
    offers: [
      { offerId: 'volte_1d', offerName: 'مزايا فورجي يوم فولتي', price: 300, data: '512MB', minutes: '20', sms: '30', validity: 'يوم', offertype: 'A4826' },
      { offerId: 'volte_2d', offerName: 'مزايا فورجي يومين فولتي', price: 600, data: '1GB', minutes: '50', sms: '100', validity: 'يومين', offertype: 'A4990004' },
      { offerId: 'volte_7d', offerName: 'مزايا فورجي الاسبوعية فولتي', price: 1500, data: '2GB', minutes: '200', sms: '300', validity: 'اسبوع', offertype: 'A4990005' },
      { offerId: 'volte_30d', offerName: 'مزايا فورجي الشهرية فولتي', price: 2500, data: '4GB', minutes: '300', sms: '350', validity: 'شهر', offertype: 'A4990006' },
      { offerId: 'volte_call', offerName: 'باقة فولتي اتصال الشهرية', price: 1000, minutes: '500', sms: '200', validity: 'شهر', offertype: 'A33000' },
      { offerId: 'volte_save', offerName: 'باقة فولتي توفير الشهرية', price: 1300, data: '1GB', minutes: '450', sms: '150', validity: 'شهر', offertype: 'A32000' },
      { offerId: 'volte_max', offerName: 'باقة فولتي ماكس الشهرية', price: 1900, data: '3GB', minutes: '300', sms: '500', validity: 'شهر', offertype: 'A33883' },
    ]
  },
  {
    id: '10day_net',
    title: 'باقات الإنترنت 10 ايام',
    badge: '10',
    icon: Clock,
    offers: [
      { offerId: 'net_10d_1gb', offerName: 'نت ثري جي 1 قيقا', price: 1400, data: '1GB', validity: '10 ايام', offertype: 'A74332' },
      { offerId: 'net_10d_2gb', offerName: 'نت ثري جي 2 قيقا', price: 2600, data: '2GB', validity: '10 ايام', offertype: 'A74339' },
      { offerId: 'net_10d_4gb', offerName: 'نت ثري جي 4 قيقا', price: 4800, data: '4GB', validity: '10 ايام', offertype: 'A44345' },
      { offerId: 'net_10d_6gb', offerName: 'نت ثري جي 6 قيقا', price: 6000, data: '6ق ميجا', validity: '10 ايام', offertype: 'A74351' },
    ]
  }
];

const POSTPAID_CATEGORIES = [
  {
    id: 'mazaya',
    title: 'باقات هدايا',
    badge: '3G',
    icon: ShieldCheck,
    offers: [
      { offerId: 'h_monthly', offerName: 'هدايا الشهرية', price: 1500, data: '400MB', sms: '100', minutes: '400', validity: 'شهر', offertype: 'A68329' },
      { offerId: 'h_weekly', offerName: 'هدايا الاسبوعية', price: 600, data: '250MB', sms: '250', minutes: '50', validity: 'اسبوع', offertype: 'A44330' },
      { offerId: 'h_tawfeer', offerName: 'هدايا توفير', price: 250, data: '120MB', sms: '10', minutes: '70', validity: '4 ايام', offertype: 'A66328' },
      { offerId: 'h_max', offerName: 'هدايا ماكس الشهرية', price: 3000, data: '1GB', sms: '300', minutes: '1000', validity: 'شهر', offertype: 'A76328' },
    ]
  },
  {
    id: '4g_mazaya',
    title: 'باقات مزايا فورجي',
    badge: '4G',
    icon: Zap,
    offers: [
      { offerId: 'super_4g', offerName: 'سوبر فورجي', price: 2000, data: '3GB', sms: '250', minutes: '250', validity: 'شهر', offertype: 'A5533821' },
      { offerId: '4g_24h', offerName: 'مزايا فورجي 24 ساعة', price: 300, data: '512MB', sms: '30', minutes: '20', validity: 'يوم', offertype: 'A4825' },
      { offerId: '4g_48h', offerName: 'مزايا فورجي 48 ساعة', price: 600, data: '1GB', minutes: '50', sms: '100', validity: '48 ساعة', offertype: 'A4990003' },
      { offerId: '4g_weekly', offerName: 'مزايا فورجي الاسبوعية', price: 1500, data: '2GB', minutes: '200', sms: '300', validity: 'اسبوع يوم', offertype: 'A88339' },
      { offerId: 'sms_800_post', offerName: 'مزايا فورجي 800 رسالة', price: 1000, sms: '800', validity: 'شهر', offertype: 'A41338' },
      { offerId: 'm_tawfeer', offerName: 'مزايا توفير الشهرية', price: 2400, data: '4GB', minutes: '450', sms: '450', validity: 'شهر', offertype: 'A4823' },
      { offerId: '4g_monthly', offerName: 'مزايا فورجي الشهرية', price: 2500, data: '4GB', minutes: '300', sms: '350', validity: 'شهر', offertype: 'A88335' },
      { offerId: 'm_max_4g', offerName: 'مزايا ماكس فورجي', price: 4000, data: '4GB', minutes: '1100', sms: '600', validity: 'شهر', offertype: 'A88440' },
      { offerId: 'm_aamal_4g', offerName: 'مزايا أعمال فورجي', price: 5000, data: '6GB', minutes: '1500', sms: '1000', validity: 'شهر', offertype: 'A49053' },
      { offerId: 'm_connect', offerName: 'مزايا تواصل', price: 1500, data: '-', sms: '600', minutes: '600', validity: '30 يوم', offertype: 'A44881' },
      { offerId: 'm_connect_max', offerName: 'مزايا تواصل ماكس', price: 2000, data: '-', sms: '500', minutes: '1000', validity: '30 يوم', offertype: 'A44882' },
    ]
  },
  {
    id: '4g_net',
    title: 'باقات نت فورجي',
    badge: '4G',
    icon: Database,
    offers: [
        { offerId: 'net_4g_4gb', offerName: 'نت فورجي 4 قيقا', price: 2000, data: '4GB', validity: 'شهر', offertype: 'A4820' },
        { offerId: 'net_8g_4gb', offerName: 'نت فورجي 8 قيقا', price: 3900, data: '8GB', validity: '30 يوم', offertype: 'A4822' },
        { offerId: 'net_20g_4gb', offerName: 'نت فورجي 20 قيقا', price: 9700, data: '20GB', validity: '30 يوم', offertype: 'A4829' },
        { offerId: 'net_tawfeer_weekly', offerName: 'نت توفير الاسبوعية', price: 1125, data: '3GB', validity: 'شهر', offertype: 'A44355' },
        { offerId: 'net_tawfeer_monthly', offerName: 'نت توفير الشهرية', price: 2250, data: '6GB', validity: 'شهر', offertype: 'A44356' },
        { offerId: 'net_tawfeer_5gb', offerName: 'نت توفير 5 قيقا', price: 2300, data: '5GB', validity: 'شهر', offertype: 'A4819' },
        { offerId: 'net_tawfeer_7gb', offerName: 'نت توفير 7 قيقا', price: 3000, data: '7GB', validity: 'شهر', offertype: 'A4818' },
        { offerId: 'net_tawfeer_8gb_post', offerName: 'نت توفير 8 قيقا', price: 3900, data: '8GB', validity: 'شهر', offertype: 'A4822' },
        { offerId: 'net_tawfeer_11gb', offerName: 'نت توفير 11 قيقا', price: 4125, data: '11GB', validity: 'شهر', offertype: 'A44345' },
        { offerId: 'net_tawfeer_25gb', offerName: 'نت توفير 25 قيقا', price: 8830, data: '25GB', validity: '40 يوم', offertype: 'A44347' },
        { offerId: 'net_tawfeer_20gb_post', offerName: 'نت توفير 20 قيقا', price: 9700, data: '20GB', validity: 'شهر', offertype: 'A4829' },
    ]
  },
  {
    id: 'monthly_net',
    title: 'باقات الانترنت الشهرية',
    badge: 'Net',
    icon: Globe,
    offers: [
      { offerId: 'net_150mb', offerName: 'نت ثري جي 150 ميقا', price: 500, data: '150 ميجا', validity: 'شهر', offertype: 'A69351' },
      { offerId: 'net_300mb', offerName: 'نت ثري جي 300 ميقا', price: 900, data: '300 ميجا', validity: 'شهر', offertype: 'A69352' },
      { offerId: 'net_700mb', offerName: 'نت ثري جي 700 ميقا', price: 1800, data: '700 ميجا', validity: 'شهر', offertype: 'A69355' },
      { offerId: 'net_1500mb', offerName: 'نت ثري جي 1500 ميقا', price: 3300, data: '1500 ميجا', validity: 'شهر', offertype: 'A69356' },
    ]
  },
  {
    id: 'volte',
    title: 'باقات فولتي',
    badge: 'VoLTE',
    icon: Zap,
    offers: [
      { offerId: 'volte_1d', offerName: 'مزايا فورجي يوم فولتي', price: 300, data: '512MB', minutes: '20', sms: '30', validity: 'يوم', offertype: 'A4825' },
      { offerId: 'volte_2d', offerName: 'مزايا فورجي يومين فولتي', price: 600, data: '1GB', minutes: '50', sms: '100', validity: 'يومين', offertype: 'A4990008' },
      { offerId: 'volte_7d', offerName: 'مزايا فورجي الاسبوعية فولتي', price: 1500, data: '2GB', minutes: '200', sms: '300', validity: 'اسبوع يوم', offertype: 'A4990002' },
      { offerId: 'volte_30d', offerName: 'مزايا فورجي الشهرية فولتي', price: 2500, data: '4GB', minutes: '300', sms: '350', validity: 'شهر', offertype: 'A4990001' },
      { offerId: 'volte_call', offerName: 'باقة فولتي اتصال الشهرية', price: 1000, minutes: '500', sms: '200', validity: 'شهر', offertype: 'A43000' },
      { offerId: 'volte_save', offerName: 'باقة فولتي توفير الشهرية', price: 1300, data: '1GB', minutes: '450', sms: '150', validity: 'شهر', offertype: 'A42000' },
      { offerId: 'volte_max', offerName: 'باقة فولتي ماكس الشهرية', price: 1900, data: '3GB', minutes: '300', sms: '500', validity: 'شهر', offertype: 'A44883' },
    ]
  },
  {
    id: '10day_net',
    title: 'باقات الإنترنت 10 ايام',
    badge: '10',
    icon: Clock,
    offers: [
      { offerId: 'net_10d_1gb', offerName: 'نت ثري جي 1 قيقا', price: 1400, data: '1GB', validity: '10 ايام', offertype: 'A74385' },
      { offerId: 'net_10d_2gb', offerName: 'نت ثري جي 2 قيقا', price: 2600, data: '2GB', validity: '10 ايام', offertype: 'A74340' },
      { offerId: 'net_10d_4gb', offerName: 'نت ثري جي 4 قيقا', price: 4800, data: '4GB', validity: '10 ايام', offertype: 'A74348' },
      { offerId: 'net_10d_6gb', offerName: 'نت ثري جي 6 قيقا', price: 6000, data: '6ق ميجا', validity: '10 ايام', offertype: 'A74354' },
    ]
  }
];

const PackageItemCard = ({ 
  offer, 
  onClick, 
  effectivePrice, 
  isApiUser 
}: { 
  offer: Offer; 
  onClick: () => void; 
  effectivePrice?: number; 
  isApiUser?: boolean; 
}) => {
  const displayPrice = effectivePrice !== undefined ? effectivePrice : offer.price;
  const hasDiscount = Boolean(isApiUser && effectivePrice !== undefined && effectivePrice < offer.price);

  return (
    <div 
      className="bg-[#fad9b2] rounded-3xl p-5 shadow-sm relative border border-[#B32C4C]/10 mb-3 text-center cursor-pointer hover:bg-[#B32C4C]/5 transition-all active:scale-[0.98] group"
      onClick={onClick}
    >
      {hasDiscount && (
        <span className="absolute top-3 right-3 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-xs">
          سعر API
        </span>
      )}
      <div className="flex justify-center mb-3">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-md">
              <Image 
                  src="https://i.postimg.cc/tTXzYWY3/1200x630wa.jpg" 
                  alt="Yemen Mobile" 
                  fill 
                  className="object-cover"
              />
          </div>
      </div>
      <h4 className="text-sm font-black text-[#B32C4C] mb-1 group-hover:text-[#B32C4C]/80 transition-colors">{offer.offerName}</h4>
      <div className="flex flex-col items-center justify-center mb-4">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-2xl font-black text-foreground">
              {displayPrice.toLocaleString('en-US')}
          </span>
          <span className="text-xs font-black text-foreground/70">ريال</span>
        </div>
        {hasDiscount && (
          <span className="text-xs line-through text-muted-foreground/80 font-bold">
            {offer.price.toLocaleString('en-US')} ريال
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-[#B32C4C]/10 text-center">
        <div className="space-y-1.5">
            <Globe className="w-5 h-5 mx-auto text-[#B32C4C]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.data || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <Mail className="w-5 h-5 mx-auto text-[#B32C4C]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.sms || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <PhoneIcon className="w-5 h-5 mx-auto text-[#B32C4C]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.minutes || '-'}</p>
        </div>
        <div className="space-y-1.5">
            <Clock className="w-5 h-5 mx-auto text-[#B32C4C]" />
            <p className="text-[11px] font-black text-foreground truncate">{offer.validity || '-'}</p>
        </div>
      </div>
    </div>
  );
};

export default function YemenMobilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [phone, setPhone] = useState('');
  const [activeTab, setActiveTab] = useState("balance");
  const [lineTypeTab, setLineTypeTab] = useState('prepaid');
  const [isSearching, setIsSearching] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [amount, setAmount] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActivatingOffer, setIsActivatingOffer] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTxDetails, setLastTxDetails] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sulfaAudioRef = useRef<HTMLAudioElement>(null);
  const noSulfaAudioRef = useRef<HTMLAudioElement>(null);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<any>(userDocRef);
  const { config } = useServicesConfig();
  const isApiUser = isUserApiCustomer(userProfile);

  const getEffectiveOfferPrice = (basePrice: number) => {
    return getUserServicePrice(basePrice, config.yemen_mobile, isApiUser);
  };

  const getEffectiveCreditCost = (amountVal: number) => {
    return getUserServicePrice(amountVal, config.yemen_mobile, isApiUser);
  };

  const parseTelecomDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatFullDateTime = (dateStr: string) => {
    const d = parseTelecomDate(dateStr);
    if (!d) return '...';
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day} - ${month} - ${year}`;
  };

  const getFriendlyErrorMessage = (msg: string) => {
    if (msg.includes('1009') || msg.includes('منطقة التحصيل')) {
        return "الرقم ليس من بوابة التحصيل المسموح بها ! يرجى التأكد من تواجدك في نطاق تغطية جنوبية ثم إجراء واستقبال 3 مكالمات بمدة 3 دقائق للمكالمة";
    }
    return msg;
  };

  const handleSearch = useCallback(async (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber.length !== 9) return;
    
    if (!phoneNumber.startsWith('77') && !phoneNumber.startsWith('78')) {
        toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن موبايل يجب أن يبدأ بـ 77 أو 78' });
        return;
    }

    setIsSearching(true);
    setBillingInfo(null);
    setActiveOffers([]);

    try {
      const transid = Date.now().toString().slice(-8);
      
      const [queryResponse, solfaResponse, offerResponse] = await Promise.all([
          fetch('/api/telecom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-app-source': 'internal' },
              body: JSON.stringify({ mobile: phoneNumber, action: 'query', transid }),
          }),
          fetch('/api/telecom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-app-source': 'internal' },
              body: JSON.stringify({ mobile: phoneNumber, action: 'solfa', transid }),
          }),
          fetch('/api/telecom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-app-source': 'internal' },
              body: JSON.stringify({ mobile: phoneNumber, action: 'queryoffer', transid }),
          })
      ]);

      const queryResult = await queryResponse.json();
      const solfaResult = await solfaResponse.json();
      const offerResult = await offerResponse.json();

      if (queryResponse.ok && (queryResult.resultCode === "0" || queryResult.resultCode === 0)) {
          let mappedOffers: ActiveOffer[] = [];
          if (offerResponse.ok && offerResult.offers) {
              mappedOffers = offerResult.offers.map((off: any) => ({
                  offerName: off.offerName || off.offer_name || '...',
                  startDate: off.offerStartDate || off.start_date || off.startDate || '...',
                  expireDate: off.offerEndDate || off.expire_date || off.expireDate || '...',
                  offertype: off.offertype || off.packageid || off.offerId || off.id || ''
              }));
          }

          const mTypeRaw = String(queryResult.mobileType || "");
          let isPostpaid = false;

          if (mTypeRaw === '1' || mTypeRaw.toLowerCase().includes('post') || mTypeRaw.includes('فوترة')) {
              isPostpaid = true;
          } else if (mTypeRaw === '2' || mTypeRaw.toLowerCase().includes('pre') || mTypeRaw.includes('مسبق')) {
              isPostpaid = false;
          } else {
              const resDesc = String(queryResult.resultDesc || "").toLowerCase();
              isPostpaid = resDesc.includes('postpaid') || resDesc.includes('فوترة');
          }

          // فحص تقنية الشريحة (3G أو 4G) من الاشتراكات المفعلة (خاصة خدمة تفعيل الإنترنت)
          const allOfferTexts = (offerResult?.offers || []).map((o: any) => 
              `${o.offerName || ''} ${o.offer_name || ''} ${o.offertype || ''} ${o.offerId || ''}`
          );

          const has4G = allOfferTexts.some((text: string) => 
              /4G|فورجي|فور\s*جي|lte/i.test(text)
          );

          const has3G = allOfferTexts.some((text: string) => 
              /3G|ثري\s*جي/i.test(text)
          );

          let simGeneration = '';
          if (has4G) {
              simGeneration = '4G';
          } else if (has3G) {
              simGeneration = '3G';
          }

          setLineTypeTab(isPostpaid ? 'postpaid' : 'prepaid');
          const baseType = isPostpaid ? 'فوترة' : 'دفع مسبق';
          const detectedTypeLabel = simGeneration ? `${baseType} - \u200E${simGeneration}` : baseType;

          // فحص حالة السلفة بدقة متناهية ودعم كافة أشكال الردود وحمايتها من أخطاء المزود
          const solfaDesc = String(solfaResult?.resultDesc || solfaResult?.message || '').toLowerCase();
          const hasNegation = solfaDesc.includes('غير متسلف') || 
                              solfaDesc.includes('لا توجد سلفة') || 
                              solfaDesc.includes('ليس متسلف') || 
                              solfaDesc.includes('غير مشترك') ||
                              solfaResult?.status === "0" || 
                              solfaResult?.status === 0;

          const parsedLoanAmt = parseFloat(
            String(
              solfaResult?.loanAmount ?? 
              solfaResult?.loan_amount ?? 
              solfaResult?.amount ?? 
              (typeof solfaResult?.resultDesc === 'string' ? solfaResult.resultDesc.match(/(\d+(?:\.\d+)?)/)?.[0] : 0) ?? 
              0
            )
          ) || 0;

          const isLoan = !hasNegation && Boolean(
            solfaResult?.isLoan === true ||
            solfaResult?.status === "1" ||
            solfaResult?.status === 1 ||
            solfaResult?.providerStatus === "1" ||
            solfaResult?.providerStatus === 1 ||
            parsedLoanAmt > 0 ||
            (solfaDesc.includes('متسلف') && !hasNegation)
          );

          const loanAmt = isLoan ? (parsedLoanAmt > 0 ? parsedLoanAmt : 0) : 0;

          setBillingInfo({ 
              balance: parseFloat(queryResult.balance || "0"), 
              customer_type: detectedTypeLabel,
              baseType: baseType,
              simGeneration: simGeneration,
              resultDesc: queryResult.resultDesc,
              isLoan: isLoan,
              loanAmount: loanAmt
          });
          
          setActiveOffers(mappedOffers);

          if (isLoan) {
              sulfaAudioRef.current?.play().catch(e => console.error("Sulfa audio play error", e));
          } else {
              noSulfaAudioRef.current?.play().catch(e => console.error("No sulfa audio play error", e));
          }

      } else {
          const providerError = queryResult.resultDesc || queryResult.message || 'رقم غير صحيح أو فشل في الاستعلام من المزود.';
          throw new Error(getFriendlyErrorMessage(providerError));
      }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'تنبيه من المزود', description: e.message });
        setBillingInfo(null);
    } finally {
        setIsSearching(false);
    }
  }, [toast]);

  const handlePhoneChange = (val: string, element: HTMLInputElement) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 9);
    setPhone(cleaned);
    if (cleaned.length === 9) {
        element.blur();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }
        if (cleaned.startsWith('77') || cleaned.startsWith('78')) {
            handleSearch(cleaned);
        } else {
            toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن موبايل يجب أن يبدأ بـ 77 أو 78' });
        }
    }
  };

  const handleContactPick = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
        toast({ variant: "destructive", title: "غير مدعوم", description: "متصفحك لا يدعم الوصول لجهات الاتصال." });
        return;
    }
    try {
        const props = ['tel'];
        const opts = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, opts);
        if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
            let selectedNumber = contacts[0].tel[0].replace(/[\s\-\(\)]/g, '');
            if (selectedNumber.startsWith('+967')) selectedNumber = selectedNumber.substring(4);
            if (selectedNumber.startsWith('00967')) selectedNumber = selectedNumber.substring(5);
            if (selectedNumber.startsWith('0')) selectedNumber = selectedNumber.substring(1);
            if (selectedNumber.length > 9) selectedNumber = selectedNumber.slice(-9);
            setPhone(selectedNumber);
            if (selectedNumber.length === 9) handleSearch(selectedNumber);
        }
    } catch (err) { console.error("Contacts selection failed:", err); }
  };

  const handlePayment = async () => {
    if (!phone || !amount || !user || !userDocRef || !firestore) return;
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    const costToDeduct = getEffectiveCreditCost(val);
    if ((userProfile?.balance ?? 0) < costToDeduct) {
        toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام عملية السداد.' });
        return;
    }
    setIsProcessing(true);
    try {
        // 1. تسجيل العملية فوراً وخصم الرصيد مع وضع الحالة قيد الانتظار
        const { transid, backpass } = await initiateTelecomPayment({
            firestore,
            userId: user.uid,
            amount: costToDeduct,
            transactionType: 'سداد يمن موبايل (رصيد)',
            recipientPhoneNumber: phone,
            notes: `إلى رقم: ${phone}. مبلغ السداد: ${val}${isApiUser ? ` (سعر API: ${costToDeduct})` : ''}.`,
            serviceCategory: 'يمن موبايل'
        });

        setLastTxDetails({ type: 'سداد رصيد يمن موبايل', phone: phone, amount: costToDeduct, transid: transid });

        // 2. إرسال الطلب للمزود مع مؤقت 10 ثوانٍ (إذا تأخر الرد تظهر نفس المنبثق تماماً)
        await executeTelecomRequestWithTimeout({
            firestore,
            userId: user.uid,
            transid,
            amount: costToDeduct,
            telecomPayload: { mobile: phone, amount: val, action: 'bill' },
            backpass
        });

        setShowSuccess(true);
    } catch (e: any) {
        toast({ variant: "destructive", title: "تنبيه من المزود", description: e.message });
    } finally {
        setIsProcessing(false);
        setIsConfirming(false);
    }
  };

  const handleActivateOffer = async () => {
    if (!selectedOffer || !phone || !user || !userDocRef || !firestore) return;
    const isNumberLoaned = Boolean(billingInfo?.isLoan);
    const loanAmt = isNumberLoaned ? (billingInfo?.loanAmount || 0) : 0;
    const effectiveOfferPrice = getEffectiveOfferPrice(selectedOffer.price);
    const totalToDeduct = effectiveOfferPrice + loanAmt;
    if ((userProfile?.balance ?? 0) < totalToDeduct) {
        toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لتفعيل الباقة شاملة سداد السلفة.' });
        return;
    }
    setIsActivatingOffer(true);
    try {
        // 1. تسجيل العملية فوراً وخصم الرصيد مع وضع الحالة قيد الانتظار
        const { transid, backpass } = await initiateTelecomPayment({
            firestore,
            userId: user.uid,
            amount: totalToDeduct,
            transactionType: `تفعيل ${selectedOffer.offerName}`,
            recipientPhoneNumber: phone,
            notes: `للرقم: ${phone}${isNumberLoaned ? ` (شامل سداد سلفة: ${loanAmt > 0 ? loanAmt : 'نعم'})` : ''}${isApiUser ? ` (سعر API: ${effectiveOfferPrice})` : ''}`,
            serviceCategory: 'يمن موبايل'
        });

        setLastTxDetails({ type: `تفعيل ${selectedOffer.offerName}`, phone: phone, amount: totalToDeduct, transid: transid });

        // 2. إرسال الطلب للمزود مع مؤقت 10 ثوانٍ (إذا تأخر الرد تظهر نفس المنبثق تماماً)
        await executeTelecomRequestWithTimeout({
            firestore,
            userId: user.uid,
            transid,
            amount: totalToDeduct,
            telecomPayload: { 
                mobile: phone, 
                action: 'billoffer', 
                service: 'yemen',
                offerid: selectedOffer.offertype, 
                method: 'Renew',
                solfa: isNumberLoaned ? 'Y' : 'N',
                amount: selectedOffer.price
            },
            backpass
        });

        setShowSuccess(true);
        setSelectedOffer(null);
        handleSearch(phone);
    } catch (e: any) {
        toast({ variant: "destructive", title: "تنبيه من المزود", description: e.message });
    } finally {
        setIsActivatingOffer(false);
    }
  };


  const findMatchedOffer = (code?: string) => {
    if (!code) return null;
    const activeCategories = lineTypeTab === 'prepaid' ? PREPAID_CATEGORIES : POSTPAID_CATEGORIES;
    for (const cat of activeCategories) {
        const found = cat.offers.find((o) => o.offertype === code);
        if (found) return found;
    }
    return null;
  };

  const currentCategories = lineTypeTab === 'prepaid' ? PREPAID_CATEGORIES : POSTPAID_CATEGORIES;

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      <audio ref={sulfaAudioRef} src="/sulfa.mp3" preload="auto" />
      <audio ref={noSulfaAudioRef} src="/nosulfa.mp3" preload="auto" />
      <audio ref={audioRef} src="/sdad.mp3" preload="auto" />

      {isSearching && <ProcessingOverlay message="جاري الاستعلام..." />}
      {isProcessing && <ProcessingOverlay message="جاري تنفيذ السداد..." />}
      {isActivatingOffer && <ProcessingOverlay message="جاري تفعيل الباقة..." />}

      <SimpleHeader title="يمن موبايل" />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        
        <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={YEMEN_MOBILE_GRADIENT}>
            <CardContent className="p-6 flex items-center justify-between">
                <div className="text-right">
                    <p className="text-xs font-bold opacity-80 mb-1">الرصيد المتوفر</p>
                    <div className="flex items-baseline gap-1">
                        <h2 className="text-2xl font-black text-white">{userProfile?.balance?.toLocaleString('en-US') || '0'}</h2>
                        <span className="text-[10px] font-bold opacity-70 text-white mr-1">ريال يمني</span>
                    </div>
                </div>
                <div className="p-3 bg-white/20 rounded-2xl"><Wallet className="h-6 w-6 text-white" /></div>
            </CardContent>
        </Card>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#B32C4C]/5">
            <div className="flex justify-between items-center mb-2 px-1">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رقم الجوال</Label>
            </div>
            <div className="relative">
                <Input type="tel" placeholder="77xxxxxxx" value={phone} onChange={(e) => handlePhoneChange(e.target.value, e.target)} className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#B32C4C] pr-12 pl-12" />
                <button onClick={handleContactPick} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#B32C4C] hover:bg-[#B32C4C]/10 rounded-xl transition-colors"><Users className="h-5 w-5" /></button>
            </div>
        </div>

        {phone.length === 9 && (phone.startsWith('77') || phone.startsWith('78')) && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
                {billingInfo && (
                    <div className="rounded-3xl overflow-hidden shadow-lg p-1 animate-in zoom-in-95" style={YEMEN_MOBILE_GRADIENT}>
                        <div className="bg-white/10 backdrop-blur-md rounded-[22px] grid grid-cols-3 text-center text-white">
                            <div className="p-3 border-l border-white/10">
                                <p className="text-[10px] font-bold opacity-80 mb-1">رصيد الرقم</p>
                                <p className="text-sm font-black">{billingInfo.balance.toLocaleString('en-US')} ر.ي</p>
                            </div>
                            <div className="p-3 border-l border-white/10">
                                <p className="text-[10px] font-bold opacity-80 mb-1">نوع الرقم</p>
                                <p className="text-sm font-black">{billingInfo.baseType || (lineTypeTab === 'postpaid' ? 'فوترة' : 'دفع مسبق')}</p>
                            </div>
                            <div className="p-3">
                                <p className="text-[10px] font-bold opacity-80 mb-1">حالة السلفة</p>
                                <p className="text-sm font-black">
                                    {billingInfo.isLoan 
                                        ? (billingInfo.loanAmount && billingInfo.loanAmount > 0 
                                            ? `متسلف (${billingInfo.loanAmount.toLocaleString('en-US')})` 
                                            : 'متسلف') 
                                        : 'غير متسلف'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" defaultValue="balance">
                    <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#B32C4C]/5">
                        <TabsTrigger value="balance" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">الرصيد</TabsTrigger>
                        <TabsTrigger value="packages" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">الباقات</TabsTrigger>
                    </TabsList>

                    <TabsContent value="balance" className="pt-4 space-y-6 animate-in fade-in-0">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#B32C4C]/5 text-center">
                            <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل المبلغ</Label>
                            <div className="relative max-w-[240px] mx-auto">
                                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#B32C4C] placeholder:text-[#B32C4C]/10 focus-visible:ring-[#B32C4C]" />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B32C4C]/30 font-black text-sm">ر.ي</div>
                            </div>
                            <Button className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg shadow-[#B32C4C]/20" onClick={() => setIsConfirming(true)} disabled={!amount} style={{ backgroundColor: '#B32C4C' }}>تنفيذ السداد</Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="packages" className="space-y-4">
                        {billingInfo && (
                            <div className="space-y-4">

                                <div className="flex justify-center mt-2">
                                    <Tabs value={lineTypeTab} onValueChange={setLineTypeTab} className="w-full max-w-[200px]">
                                        <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-xl h-9 p-1 shadow-sm border border-[#B32C4C]/5">
                                            <TabsTrigger value="prepaid" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">دفع مسبق</TabsTrigger>
                                            <TabsTrigger value="postpaid" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">فوترة</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-[#B32C4C]/5">
                                    <div className="p-3 text-center" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}><h3 className="text-white font-black text-sm">الاشتراكات الحالية</h3></div>
                                    <div className="p-4 space-y-3">
                                        {activeOffers.length > 0 ? (
                                            activeOffers.map((off, idx) => {
                                                const matched = findMatchedOffer(off.offertype);
                                                const canRenew = !!matched;
                                                const finalDisplayName = matched ? matched.offerName : off.offerName;
                                                return (
                                                    <div key={idx} className="flex gap-4 items-center p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-muted/50 mb-2 text-right animate-in fade-in-0 slide-in-from-bottom-2">
                                                        <div className="flex-1 text-right overflow-hidden">
                                                            <h4 className="text-[13px] font-black text-[#003366] dark:text-blue-400 leading-tight mb-1 text-right">{finalDisplayName}</h4>
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center justify-end gap-1.5"><span className="text-[11px] font-black text-foreground" dir="ltr">{formatFullDateTime(off.startDate)}</span><span className="text-[11px] font-black text-green-600">:الإشتراك</span></div>
                                                                <div className="flex items-center justify-end gap-1.5"><span className="text-[11px] font-black text-foreground" dir="ltr">{formatFullDateTime(off.expireDate)}</span><span className="text-[11px] font-black text-red-600">:الانتهـــاء</span></div>
                                                            </div>
                                                        </div>
                                                        {canRenew ? (
                                                            <button onClick={() => setSelectedOffer(matched)} className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 active:scale-95 transition-all shadow-md" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>
                                                                <RefreshCw className="w-5 h-5 text-white" /><span className="text-[10px] text-white font-black">تجديد</span>
                                                            </button>
                                                        ) : (
                                                            <div className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 opacity-80 shadow-inner" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>
                                                                <Smartphone className="w-7 h-7 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-6">
                                                <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground font-bold">لا توجد باقات نشطة حالياً</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Accordion type="single" collapsible className="w-full space-y-3">
                                    {currentCategories.map((cat) => (
                                        <AccordionItem key={cat.id} value={cat.id} className="border-none">
                                            <AccordionTrigger className="px-4 py-4 rounded-2xl text-white hover:no-underline shadow-md group data-[state=open]:rounded-b-none" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="bg-white text-[#B32C4C] font-black text-xs px-3 py-1 rounded-xl shadow-inner shrink-0">{cat.badge}</div>
                                                    <span className="text-sm font-black flex-1 mr-4 text-right">{cat.title}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 bg-white dark:bg-slate-900 border-x border-b border-[#B32C4C]/10 rounded-b-2xl shadow-sm">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {cat.offers.map((o) => (
                                                        <PackageItemCard 
                                                            key={o.offerId} 
                                                            offer={o} 
                                                            effectivePrice={getEffectiveOfferPrice(o.price)}
                                                            isApiUser={isApiUser}
                                                            onClick={() => setSelectedOffer(o)} 
                                                        />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        )}
      </div>

      <Toaster />

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent className="rounded-[32px]">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-center font-black">تأكيد سداد رصيد</AlertDialogTitle>
                <div className="space-y-3 pt-4 text-right text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">رقم الهاتف:</span><span className="font-bold">{phone}</span></div>
                    <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-muted-foreground">المبلغ:</span><span className="font-bold">{parseFloat(amount || '0').toLocaleString()} ريال</span></div>
                    <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2">
                        <span className="font-black">إجمالي الخصم من الرصيد:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-[#B32C4C] text-lg">{getEffectiveCreditCost(parseFloat(amount || '0')).toLocaleString()} ريال</span>
                            {isApiUser && config.yemen_mobile?.rate !== undefined && config.yemen_mobile.rate < 1 && (
                                <span className="text-[9px] font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">سعر API</span>
                            )}
                        </div>
                    </div>
                </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                <AlertDialogAction className="w-full rounded-2xl h-12 font-bold text-white" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }} onClick={handlePayment}>تأكيد السداد</AlertDialogAction>
                <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
          <AlertDialogContent className="rounded-[32px]">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-center font-black">تأكيد تفعيل الباقة</AlertDialogTitle>
                  <div className="py-4 space-y-3 text-right text-sm">
                      <p className="text-center text-lg font-black text-[#B32C4C] mb-2">{selectedOffer?.offerName}</p>
                      <div className="flex justify-between items-center py-2 border-b border-dashed">
                        <span className="text-muted-foreground">سعر الباقة:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{getEffectiveOfferPrice(selectedOffer?.price || 0).toLocaleString()} ريال</span>
                          {isApiUser && getEffectiveOfferPrice(selectedOffer?.price || 0) < (selectedOffer?.price || 0) && (
                            <span className="text-[9px] font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">سعر API</span>
                          )}
                        </div>
                      </div>
                      {billingInfo?.isLoan && (
                        <div className="flex justify-between items-center py-2 border-b border-dashed"><span className="text-destructive font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> سداد سلفة الرقم:</span><span className="font-black text-destructive">{(billingInfo.loanAmount && billingInfo.loanAmount > 0) ? `${billingInfo.loanAmount.toLocaleString()} ريال` : 'سداد سلفة'}</span></div>
                      )}
                      <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-3 mt-4">
                        <span className="font-black">إجمالي الخصم النهائي:</span>
                        <div className="flex items-baseline gap-1">
                          <p className="text-2xl font-black text-[#B32C4C]">
                            {(getEffectiveOfferPrice(selectedOffer?.price || 0) + (billingInfo?.isLoan ? (billingInfo?.loanAmount || 0) : 0)).toLocaleString()}
                          </p>
                          <span className="text-[10px] font-black text-[#B32C4C]">ريال</span>
                        </div>
                      </div>
                  </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                  <AlertDialogAction onClick={handleActivateOffer} className="w-full rounded-2xl h-12 font-black text-white" disabled={isActivatingOffer} style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>تفعيل الآن</AlertDialogAction>
                  <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0" disabled={isActivatingOffer}>تراجع</AlertDialogCancel>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {showSuccess && lastTxDetails && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in-0">
            <audio ref={audioRef} src="/sdad.mp3" autoPlay />
            <Card className="w-full max-w-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                <div className="bg-green-500 p-8 flex justify-center">
                    <div className="bg-white/20 p-4 rounded-full animate-bounce">
                        <CheckCircle className="h-16 w-16 text-white" />
                    </div>
                </div>
                <CardContent className="p-8 space-y-6">
                    <div>
                        <h2 className="text-2xl font-black text-green-600">تم السداد بنجاح</h2>
                        <p className="text-sm text-muted-foreground mt-1">تم تنفيذ العملية بنجاح لصالح المشترك</p>
                    </div>

                    <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-[#B32C4C]/20">
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> رقم العملية:</span>
                            <span className="font-mono font-black text-[#B32C4C]">{lastTxDetails.transid}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> رقم الهاتف:</span>
                            <span className="font-mono font-bold tracking-widest">{lastTxDetails.phone}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> الخدمة:</span>
                            <span className="font-bold">{lastTxDetails.type}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-muted pb-2">
                            <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ المخصوم:</span>
                            <span className="font-black text-[#B32C4C]">{lastTxDetails.amount.toLocaleString()} ريال</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span>
                            <span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="rounded-2xl h-14 font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
                        <Button className="rounded-2xl h-14 font-black text-white" onClick={() => { setShowSuccess(false); setAmount(''); }} style={{ backgroundColor: '#B32C4C' }}>سداد جديد</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}

