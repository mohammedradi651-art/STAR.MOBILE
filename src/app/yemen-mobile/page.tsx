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

export const dynamic = 'force-dynamic';

type BillingInfo = {
    balance: number;
    customer_type: string;
    resultDesc?: string;
    isLoan: boolean;
    loanAmount?: number;
};

type ActiveOffer = {
    offerName: string;
    startDate: string;
    expireDate: string;
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

export const PREPAID_CATEGORIES = [
  {
    id: 'mazaya',
    title: 'باقات مزايا',
    badge: '3G',
    icon: ShieldCheck,
    offers: [
      { offerId: 'm_monthly', offerName: 'مزايا الشهرية', price: 1300, data: '250 MB', sms: '350', minutes: '350', validity: '30 يوم', offertype: 'A38394' },
      { offerId: 'm_weekly', offerName: 'مزايا الاسبوعة', price: 485, data: '90 MB', sms: '30', minutes: '100', validity: '7 أيام', offertype: 'A64329' },
      { offerId: 'm_max', offerName: 'مزايا ماكس الشهرية', price: 2000, data: '600 MB', sms: '200', minutes: '500', validity: '30 يوم', offertype: 'A75328' },
      { offerId: 'm_max', offerName: 'مزايا تواصل', price: 1500, data: '-', sms: '600', minutes: '600', validity: '30 يوم', offertype: 'A33881' },
      { offerId: 'm_max', offerName: 'مزايا تواصل ماكس', price: 2000, data: '-', sms: '500', minutes: '1000', validity: '30 يوم', offertype: 'A33882' },
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
      { offerId: '4g_48h', offerName: 'مزايا فورجي 48 ساعة', price: 600, data: '1GB', icon: Zap, minutes: '50', sms: '100', validity: '48 ساعة', offertype: 'A88337' },
      { offerId: '4g_weekly', offerName: 'مزايا فورجي الاسبوعية', price: 1500, data: '2GB', minutes: '200', sms: '300', validity: '7 أيام', offertype: 'A88336' },
      { offerId: 'm_tawfeer', offerName: 'مزايا توفير الشهرية', price: 2400, data: '4GB', minutes: '450', sms: '450', validity: '30 يوم', offertype: 'A3823' },
      { offerId: '4g_monthly', offerName: 'مزايا فورجي الشهرية', price: 2500, data: '4GB', minutes: '300', sms: '350', validity: '30 يوم', offertype: 'A88335' },
      { offerId: 'm_max_4g', offerName: 'مزايا ماكس فورجي', price: 4000, data: '4GB', minutes: '1100', sms: '600', validity: '30 يوم', offertype: 'A88441' },
      { offerId: 'm_aamal_4g', offerName: 'مزايا أعمال فورجي', price: 5000, data: '6GB', minutes: '1500', sms: '1000', validity: 'شهر', offertype: 'A39053' },
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
      { offerId: 'volte_save', offerName: 'باقة فولتي ماكس الشهرية', price: 1900, data: '3GB', minutes: '300', sms: '500', validity: 'شهر', offertype: 'A33883' },
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

export const POSTPAID_CATEGORIES = [
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
      { offerId: 'sms_800', offerName: 'مزايا فورجي 800 رسالة', price: 1000, sms: '800', validity: 'شهر', offertype: 'A41338' },
      { offerId: 'm_tawfeer', offerName: 'مزايا توفير الشهرية', price: 2400, data: '4GB', minutes: '450', sms: '450', validity: 'شهر', offertype: 'A4823' },
      { offerId: '4g_monthly', offerName: 'مزايا فورجي الشهرية', price: 2500, data: '4GB', minutes: '300', sms: '350', validity: 'شهر', offertype: 'A88335' },
      { offerId: 'm_max_4g', offerName: 'مزايا ماكس فورجي', price: 4000, data: '4GB', minutes: '1100', sms: '600', validity: 'شهر', offertype: 'A88440' },
      { offerId: 'm_aamal_4g', offerName: 'مزايا أعمال فورجي', price: 5000, data: '6GB', minutes: '1500', sms: '1000', validity: 'شهر', offertype: 'A49053' },
      { offerId: 'm_max', offerName: 'مزايا تواصل', price: 1500, data: '-', sms: '600', minutes: '600', validity: '30 يوم', offertype: 'A44881' },
      { offerId: 'm_max', offerName: 'مزايا تواصل ماكس', price: 2000, data: '-', sms: '500', minutes: '1000', validity: '30 يوم', offertype: 'A44882' },
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
        { offerId: 'net_tawfeer_8gb', offerName: 'نت توفير 8 قيقا', price: 3900, data: '8GB', validity: 'شهر', offertype: 'A4822' },
        { offerId: 'net_tawfeer_11gb', offerName: 'نت توفير 11 قيقا', price: 4125, data: '11GB', validity: 'شهر', offertype: 'A44345' },
        { offerId: 'net_tawfeer_25gb', offerName: 'نت توفير 25 قيقا', price: 8830, data: '25GB', validity: '40 يوم', offertype: 'A44347' },
        { offerId: 'net_tawfeer_20gb', offerName: 'نت توفير 20 قيقا', price: 9700, data: '20GB', validity: 'شهر', offertype: 'A4829' },
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
      { offerId: 'volte_save', offerName: 'باقة فولتي ماكس الشهرية', price: 1900, data: '3GB', minutes: '300', sms: '500', validity: 'شهر', offertype: 'A44883' },
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

const PackageItemCard = ({ offer, onClick }: { offer: Offer, onClick: () => void }) => (
    <div 
      className="bg-[#fad9b2] rounded-3xl p-5 shadow-sm relative border border-[#B32C4C]/10 mb-3 text-center cursor-pointer hover:bg-[#B32C4C]/5 transition-all active:scale-[0.98] group"
      onClick={onClick}
    >
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
      <div className="flex items-baseline justify-center mb-4">
        <span className="text-2xl font-black text-foreground">
            {offer.price.toLocaleString('en-US')}
        </span>
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
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mobile: phoneNumber, action: 'query', transid }),
          }),
          fetch('/api/telecom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mobile: phoneNumber, action: 'solfa', transid }),
          }),
          fetch('/api/telecom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
                  expireDate: off.offerEndDate || off.expire_date || off.expireDate || '...'
              }));
          }

          const searchIn = (obj: any) => JSON.stringify(obj).toLowerCase();
          const combinedResults = searchIn(queryResult) + searchIn(offerResult) + searchIn(solfaResult);
          
          const isPostpaid = combinedResults.includes('فوترة') || 
                             combinedResults.includes('postpaid') || 
                             combinedResults.includes('post_paid') ||
                             combinedResults.includes('باقة فوترة');
                             
          const detectedTypeLabel = isPostpaid ? 'فوترة' : 'دفع مسبق';
          setLineTypeTab(isPostpaid ? 'postpaid' : 'prepaid');

          const isLoan = solfaResult.status === "1" || solfaResult.status === 1;
          const loanAmt = isLoan ? parseFloat(solfaResult.loan_amount || "0") : 0;

          setBillingInfo({ 
              balance: parseFloat(queryResult.balance || "0"), 
              customer_type: detectedTypeLabel,
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
        toast({
            variant: "destructive",
            title: "غير مدعوم",
            description: "متصفحك لا يدعم الوصول لجهات الاتصال.",
        });
        return;
    }

    try {
        const props = ['tel'];
        const opts = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, opts);
        
        if (contacts.length > 0 && contacts[0].tel && contacts[0].tel.length > 0) {
            let selectedNumber = contacts[0].tel[0];
            selectedNumber = selectedNumber.replace(/[\s\-\(\)]/g, '');
            if (selectedNumber.startsWith('+967')) selectedNumber = selectedNumber.substring(4);
            if (selectedNumber.startsWith('00967')) selectedNumber = selectedNumber.substring(5);
            if (selectedNumber.startsWith('07')) selectedNumber = selectedNumber.substring(1);
            
            const inputElement = document.querySelector('input[type="tel"]') as HTMLInputElement;
            if (inputElement) handlePhoneChange(selectedNumber, inputElement);
            else setPhone(selectedNumber.slice(0, 9));
        }
    } catch (err) {
        console.error("Contacts selection failed:", err);
    }
  };

  const handleRenewOffer = (name: string) => {
    const normalize = (str: string) => 
        str.replace(/[أإآ]/g, 'ا')
           .replace(/ة/g, 'ه')
           .replace(/ى/g, 'ي')
           .toLowerCase()
           .trim();

    const normalizedInput = normalize(name);
    const activeCategories = lineTypeTab === 'prepaid' ? PREPAID_CATEGORIES : POSTPAID_CATEGORIES;

    let foundOffer: Offer | undefined;
    for (const cat of activeCategories) {
        foundOffer = (cat as any).offers.find((o: Offer) => {
            const normalizedOfferName = normalize(o.offerName);
            return normalizedInput.includes(normalizedOfferName) || normalizedOfferName.includes(normalizedInput);
        });
        if (foundOffer) break;
    }

    if (foundOffer) {
        setSelectedOffer(foundOffer);
    } else {
        toast({
            variant: "destructive",
            title: "عذراً",
            description: "لم نتمكن من تحديد سعر التجديد تلقائياً. يرجى اختيار الباقة من القائمة.",
        });
    }
  };

  const handlePayment = async () => {
    if (!phone || !amount || !user || !userDocRef || !firestore) return;
    
    if (!phone.startsWith('77') && !phone.startsWith('78')) {
        toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن موبايل يجب أن يبدأ بـ 77 أو 78' });
        return;
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    const totalToDeduct = val;

    if ((userProfile?.balance ?? 0) < totalToDeduct) {
        toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لإتمام عملية السداد.' });
        return;
    }

    setIsProcessing(true);
    try {
        const transid = Date.now().toString().slice(-8);
        const response = await fetch('/api/telecom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: phone, amount: val, action: 'bill', transid })
        });
        const result = await response.json();
        
        if (!response.ok || (result.resultCode !== "0" && result.resultCode !== 0)) {
            const providerError = result.resultDesc || result.message || 'فشل عملية السداد من المزود.';
            throw new Error(getFriendlyErrorMessage(providerError));
        }

        const batch = writeBatch(firestore);
        batch.update(userDocRef, { balance: increment(-totalToDeduct) });
        batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
            userId: user.uid, 
            transactionDate: new Date().toISOString(), 
            amount: totalToDeduct,
            transactionType: 'سداد يمن موبايل (رصيد)', 
            notes: `إلى رقم: ${phone}. مبلغ السداد: ${val}.`, 
            recipientPhoneNumber: phone,
            transid: transid
        });
        await batch.commit();
        
        setLastTxDetails({
            type: 'سداد رصيد يمن موبايل',
            phone: phone,
            amount: totalToDeduct,
            transid: transid
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
    
    if (!phone.startsWith('77') && !phone.startsWith('78')) {
        toast({ variant: 'destructive', title: 'رقم غير صحيح', description: 'رقم يمن موبايل يجب أن يبدأ بـ 77 أو 78' });
        return;
    }

    const hasLoan = billingInfo?.isLoan && (billingInfo?.loanAmount || 0) > 0;
    const loanAmt = hasLoan ? (billingInfo?.loanAmount || 0) : 0;
    const totalToDeduct = selectedOffer.price + loanAmt;

    if ((userProfile?.balance ?? 0) < totalToDeduct) {
        toast({ variant: 'destructive', title: 'رصيد غير كافٍ', description: 'رصيدك الحالي لا يكفي لتفعيل الباقة شاملة سداد السلفة.' });
        return;
    }

    setIsActivatingOffer(true);
    try {
        const transid = Date.now().toString().slice(-8);
        
        const payload: any = { 
            mobile: phone, 
            action: 'billoffer', 
            service: 'yemen',
            offerid: selectedOffer.offertype, 
            method: 'Renew',
            solfa: hasLoan ? 'Y' : 'N',
            amount: selectedOffer.price, 
            transid 
        };

        const response = await fetch('/api/telecom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        const isSuccess = result.resultCode === "0" || result.resultCode === 0;
        const isPending = result.resultCode === "-2" || result.resultCode === -2;

        if (!response.ok || (!isSuccess && !isPending)) {
            const providerError = result.resultDesc || result.message || 'فشل تفعيل الباقة من المزود.';
            throw new Error(getFriendlyErrorMessage(providerError));
        }

        const batch = writeBatch(firestore);
        batch.update(userDocRef, { balance: increment(-totalToDeduct) });
        batch.set(doc(firestoreCollection(firestore, 'users', user.uid, 'transactions')), {
            userId: user.uid, 
            transactionDate: new Date().toISOString(), 
            amount: totalToDeduct,
            transactionType: `تفعيل ${selectedOffer.offerName}`, 
            notes: `للرقم: ${phone}${hasLoan ? ` (شامل سداد سلفة: ${loanAmt})` : ''}`, 
            recipientPhoneNumber: phone,
            transid: transid
        });
        await batch.commit();
        
        setLastTxDetails({
            type: `تفعيل ${selectedOffer.offerName}`,
            phone: phone,
            amount: totalToDeduct,
            transid: transid
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

  const currentCategories = lineTypeTab === 'prepaid' ? PREPAID_CATEGORIES : POSTPAID_CATEGORIES;

  useEffect(() => {
    if (showSuccess && audioRef.current) {
        audioRef.current.play().catch(e => console.error("Success audio play error", e));
    }
  }, [showSuccess]);

  if (showSuccess && lastTxDetails) {
    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
            <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in-0 p-4">
                <Card className="w-full max-sm text-center shadow-2xl rounded-[40px] overflow-hidden border-none bg-card">
                    <div className="bg-green-500 p-8 flex justify-center">
                        <div className="bg-white/20 p-4 rounded-full animate-bounce">
                            <CheckCircle className="h-16 w-16 text-white" />
                        </div>
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div>
                            <h2 className="text-2xl font-black text-green-600">تم التسديد بنجاح</h2>
                            <p className="text-sm text-muted-foreground mt-1">تم تنفيذ طلبك بنجاح</p>
                        </div>

                        <div className="w-full space-y-3 text-sm bg-muted/50 p-5 rounded-[24px] text-right border-2 border-dashed border-[#B32C4C]/10">
                            <div className="flex justify-between items-center border-b border-muted pb-2">
                                <span className="text-muted-foreground flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> رقم العملية:</span>
                                <span className="font-mono font-black text-[#B32C4C]">{lastTxDetails.transid}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-muted pb-2">
                                <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> رقم الجوال:</span>
                                <span className="font-mono font-bold tracking-widest">{lastTxDetails.phone}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-muted pb-2">
                                <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> نوع العملية:</span>
                                <span className="font-bold">{lastTxDetails.type}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-muted pb-2">
                                <span className="text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> المبلغ:</span>
                                <span className="font-black text-[#B32C4C]">{lastTxDetails.amount.toLocaleString('en-US')} ريال</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> التاريخ:</span>
                                <span className="text-[10px] font-bold">{format(new Date(), 'Pp', { locale: ar })}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="rounded-2xl h-14 font-black" onClick={() => router.push('/login')}>الرئيسية</Button>
                            <Button className="rounded-2xl h-14 font-black text-white" onClick={() => { setShowSuccess(false); handleSearch(phone); }} style={{ backgroundColor: '#B32C4C' }}>تحديث</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      <audio ref={sulfaAudioRef} src="/sulfa.mp3" preload="auto" />
      <audio ref={noSulfaAudioRef} src="/nosulfa.mp3" preload="auto" />
      <audio ref={audioRef} src="/sdad.mp3" preload="auto" />

      {isSearching && <ProcessingOverlay message="جاري الاستعلام..." />}
      {isProcessing && <ProcessingOverlay message="جاري تنفيذ السداد..." />}
      {isActivatingOffer && <ProcessingOverlay message="جاري تفعيل الباقة..." />}

      <SimpleHeader title="يمن موبايل" />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        <Card className="overflow-hidden rounded-[28px] shadow-lg text-white border-none mb-4" style={YEMEN_MOBILE_GRADIENT}>
            <CardContent className="p-6 flex items-center justify-between">
                <div className="text-right">
                    <p className="text-xs font-bold opacity-80 mb-1">الرصيد المتوفر</p>
                    <div className="flex items-baseline gap-1">
                        <h2 className="text-2xl font-black text-white">
                            {userProfile?.balance?.toLocaleString('en-US') || '0'}
                        </h2>
                        <span className="text-[10px] font-bold opacity-70 text-white mr-1">ريال يمني</span>
                    </div>
                </div>
                <div className="p-3 bg-white/20 rounded-2xl">
                    <Wallet className="h-6 w-6 text-white" />
                </div>
            </CardContent>
        </Card>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-[#B32C4C]/5">
            <div className="flex justify-between items-center mb-2 px-1">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">رقم الجوال</Label>
                {isSearching && <Loader2 className="h-4 w-4 animate-spin text-[#B32C4C]" />}
            </div>
            <div className="relative">
                <Input
                    type="tel"
                    placeholder="77xxxxxxx"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value, e.target)}
                    className="text-center font-bold text-lg h-12 rounded-2xl border-none bg-muted/20 focus-visible:ring-[#B32C4C] transition-all pr-12 pl-12"
                />
                <button 
                    onClick={handleContactPick}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#B32C4C] hover:bg-[#B32C4C]/10 rounded-xl transition-colors"
                    title="جهات الاتصال"
                >
                    <Users className="h-5 w-5" />
                </button>
            </div>
        </div>

        {phone.length === 9 && (phone.startsWith('77') || phone.startsWith('78')) && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" defaultValue="balance">
                    <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-2xl h-14 p-1.5 shadow-sm border border-[#B32C4C]/5">
                        <TabsTrigger value="balance" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">الرصيد</TabsTrigger>
                        <TabsTrigger value="packages" className="rounded-xl font-bold text-sm data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">الباقات</TabsTrigger>
                    </TabsList>

                    <TabsContent value="balance" className="pt-4 space-y-6 animate-in fade-in-0">
                        {billingInfo ? (
                            <div className="rounded-3xl overflow-hidden shadow-sm border border-[#B32C4C]/5 bg-white dark:bg-slate-900 grid grid-cols-2 text-center animate-in zoom-in-95 duration-300">
                                <div className="p-3 border-l">
                                    <p className="text-[10px] font-bold text-[#B32C4C] mb-1">رصيد الرقم</p>
                                    <p className="text-sm font-black text-[#B32C4C]">{billingInfo.balance.toLocaleString('en-US')}</p>
                                </div>
                                <div className="p-3">
                                    <p className="text-[10px] font-bold text-[#B32C4C] mb-1">نوع الرقم</p>
                                    <p className="text-sm font-black text-[#B32C4C]">{billingInfo.customer_type}</p>
                                </div>
                            </div>
                        ) : null}

                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[#B32C4C]/5 text-center">
                            <Label className="text-sm font-black text-muted-foreground block mb-4">ادخل المبلغ</Label>
                            <div className="relative max-w-[240px] mx-auto">
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={amount} 
                                    onChange={(e) => setAmount(e.target.value)} 
                                    className="text-center font-black text-3xl h-16 rounded-2xl bg-muted/20 border-none text-[#B32C4C] placeholder:text-[#B32C4C]/10 focus-visible:ring-[#B32C4C]" 
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B32C4C]/30 font-black text-sm">ر.ي</div>
                            </div>
                            
                            {amount && (
                                <div className="mt-4 animate-in fade-in-0 slide-in-from-top-2 text-center">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">الرصيد بعد الضريبة</p>
                                    <p className="text-xl font-black text-[#B32C4C]">
                                        {(parseFloat(amount) * 0.826).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                                    </p>
                                </div>
                            )}

                            <Button 
                                className="w-full h-14 rounded-2xl text-lg font-black mt-8 shadow-lg shadow-[#B32C4C]/20" 
                                onClick={() => setIsConfirming(true)} 
                                disabled={!amount}
                                style={{ backgroundColor: '#B32C4C' }}
                            >
                                تنفيذ السداد
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="packages" className="space-y-4">
                        {billingInfo ? (
                            <div className="space-y-4">
                                <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-[#B32C4C]/5 mt-2">
                                    <div className="grid grid-cols-3 text-center border-b bg-muted/10">
                                        <div className="p-3 border-l">
                                            <p className="text-[10px] font-bold text-[#B32C4C] mb-1">رصيد الرقم</p>
                                            <p className="text-sm font-black text-[#B32C4C]">
                                                {billingInfo.balance.toLocaleString('en-US') || '0.00'}
                                            </p>
                                        </div>
                                        <div className="p-3 border-l">
                                            <p className="text-[10px] font-bold text-[#B32C4C] mb-1">نوع الرقم</p>
                                            <p className="text-sm font-black text-[#B32C4C]">{billingInfo.customer_type || '...'}</p>
                                        </div>
                                        <div className="p-3">
                                            <p className="text-[10px] font-bold text-[#B32C4C] mb-1">فحص السلفة</p>
                                            <div className="flex items-center justify-center gap-1">
                                                {billingInfo.isLoan ? (
                                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1 px-1.5 h-6">
                                                        <Frown className="h-3 w-3" />
                                                        <span className="text-[9px] font-black">
                                                            {billingInfo.loanAmount?.toLocaleString('en-US')}
                                                        </span>
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 h-6">
                                                        <Smile className="h-3 w-3" />
                                                        <span className="text-[9px] font-black">غير متسلف</span>
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-center mt-2 animate-in fade-in zoom-in duration-200">
                                    <Tabs value={lineTypeTab} onValueChange={setLineTypeTab} className="w-full max-w-[200px]">
                                        <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-slate-900 rounded-xl h-9 p-1 shadow-sm border border-[#B32C4C]/5">
                                            <TabsTrigger value="prepaid" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">دفع مسبق</TabsTrigger>
                                            <TabsTrigger value="postpaid" className="rounded-lg font-bold text-[10px] data-[state=active]:bg-[#B32C4C] data-[state=active]:text-white">فوترة</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-[#B32C4C]/5">
                                    <div className="p-3 text-center" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>
                                        <h3 className="text-white font-black text-sm">الاشتراكات الحالية</h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {activeOffers.length > 0 ? (
                                            activeOffers.map((off, idx) => (
                                                <div key={idx} className="flex gap-4 items-center p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-muted/50 mb-2 text-right animate-in fade-in-0 slide-in-from-bottom-2">
                                                    <div className="flex-1 text-right overflow-hidden">
                                                        <h4 className="text-[13px] font-black text-[#003366] dark:text-blue-400 leading-tight mb-1 text-right">
                                                            {off.offerName}
                                                        </h4>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <span className="text-[11px] font-black text-foreground" dir="ltr">{formatFullDateTime(off.startDate)}</span>
                                                                <span className="text-[11px] font-black text-green-600">:الإشتراك</span>
                                                            </div>
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <span className="text-[11px] font-black text-foreground" dir="ltr">{formatFullDateTime(off.expireDate)}</span>
                                                                <span className="text-[11px] font-black text-red-600">:الانتهـــاء</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => handleRenewOffer(off.offerName)}
                                                        className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 active:scale-95 transition-all shadow-md"
                                                        style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}
                                                    >
                                                        <RefreshCw className="w-5 h-5 text-white" />
                                                        <span className="text-[10px] text-white font-black">تجديد</span>
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6">
                                                <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                                <p className="text-xs text-muted-foreground font-bold">لا توجد باقات نشطة حالياً</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Accordion type="single" collapsible className="w-full space-y-3">
                                    {currentCategories.map((cat, index) => (
                                        <AccordionItem key={cat.id} value={cat.id} className="border-none">
                                            <AccordionTrigger className="px-4 py-4 rounded-2xl text-white hover:no-underline shadow-md group data-[state=open]:rounded-b-none" style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="bg-white text-[#B32C4C] font-black text-xs px-3 py-1 rounded-xl shadow-inner shrink-0">
                                                        {cat.badge || (index + 1)}
                                                    </div>
                                                    <span className="text-sm font-black flex-1 mr-4 text-right">{cat.title}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 bg-white dark:bg-slate-900 border-x border-b border-[#B32C4C]/10 rounded-b-2xl shadow-sm">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {cat.offers.map((o) => (
                                                        <PackageItemCard key={o.offerId} offer={o} onClick={() => setSelectedOffer(o)} />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        ) : null}
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
                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                        <span className="text-muted-foreground">رقم الهاتف:</span>
                        <span className="font-bold">{phone}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                        <span className="text-muted-foreground">نوع الخط:</span>
                        <span className="font-bold">{lineTypeTab === 'prepaid' ? 'دفع مسبق' : 'فوترة'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                        <span className="text-muted-foreground">المبلغ:</span>
                        <span className="font-bold">{parseFloat(amount || '0').toLocaleString('en-US')} ريال</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-2">
                        <span className="font-black">إجمالي الخصم:</span>
                        <span className="font-black text-[#B32C4C] text-lg">
                            {parseFloat(amount || '0').toLocaleString('en-US')} ريال
                        </span>
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
                          <span className="font-bold">{selectedOffer?.price.toLocaleString('en-US')} ريال</span>
                      </div>

                      {billingInfo?.isLoan && (billingInfo?.loanAmount || 0) > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-dashed animate-in fade-in duration-300">
                            <span className="text-destructive font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> سداد سلفة الرقم:
                            </span>
                            <span className="font-black text-destructive">{(billingInfo.loanAmount || 0).toLocaleString('en-US')} ريال</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-3 bg-muted/50 rounded-xl px-3 mt-4">
                        <span className="font-black">إجمالي الخصم النهائي:</span>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-[#B32C4C]">
                                {((selectedOffer?.price || 0) + (billingInfo?.isLoan ? (billingInfo?.loanAmount || 0) : 0)).toLocaleString('en-US')}
                            </p>
                            <span className="text-[10px] font-black text-[#B32C4C]">ريال</span>
                        </div>
                      </div>
                  </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                  <AlertDialogAction onClick={handleActivateOffer} className="w-full rounded-2xl h-12 font-bold text-white" disabled={isActivatingOffer} style={{ backgroundColor: YEMEN_MOBILE_PRIMARY }}>
                      تفعيل الآن
                  </AlertDialogAction>
                  <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0" disabled={isActivatingOffer}>تراجع</AlertDialogCancel>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}