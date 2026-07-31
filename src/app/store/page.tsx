
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
    ShoppingBag, 
    Search, 
    Tag, 
    MapPin, 
    CheckCircle, 
    Wallet, 
    Loader2, 
    Package,
    ArrowLeftRight,
    Star,
    Sparkles,
    ShoppingBasket,
    CreditCard,
    PlusCircle,
    AlertCircle
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category?: string;
};

type UserProfile = {
  balance?: number;
  displayName?: string;
  phoneNumber?: string;
};

const getSafeImageUrl = (url: string) => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return 'https://picsum.photos/seed/product/400/400';
  }
  return url;
};

export default function StorePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [address, setAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'products'), orderBy('name')) : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleWhatsAppPurchase = (product: Product) => {
    const phoneNumber = "967770326828";
    const message = encodeURIComponent(`مرحباً ستار ميديا، أود الاستفسار عن منتج: ${product.name}\nالسعر: ${product.price.toLocaleString()} ريال`);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
      <audio ref={audioRef} src="/sdad.mp3" preload="auto" />
      {isProcessing && <ProcessingOverlay message="جاري معالجة طلبك..." />}

      <SimpleHeader title="متجر ستار ميديا" />
      
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Luxurious Hero Section */}
        <div className="bg-mesh-gradient pt-8 pb-14 px-6 rounded-b-[50px] shadow-xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="bg-white/20 p-4 rounded-[28px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <ShoppingBag className="h-10 w-10 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white tracking-tight">تسوق بأناقة</h2>
                    <div className="flex items-center justify-center gap-2">
                        <Sparkles className="h-3 w-3 text-yellow-300 animate-pulse" />
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-[0.2em]">عروض حصرية ومنتجات مميزة</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 space-y-6 pb-24">
            {/* Wallet Quick Access */}
            <Card className="border-none shadow-lg rounded-[32px] overflow-hidden bg-card/50 backdrop-blur-md -mt-12 relative z-10 border border-white/20">
                <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <Wallet className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">الرصيد المتاح للتسوق</p>
                            <p className="text-lg font-black text-primary">{(userProfile?.balance ?? 0).toLocaleString('en-US')} <span className="text-[10px]">ريال</span></p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.push('/top-up')}>
                        <PlusCircle className="h-5 w-5 text-primary" />
                    </Button>
                </CardContent>
            </Card>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="ابحث عن الفخامة..." 
                    className="h-14 pr-12 rounded-[24px] border-none shadow-sm bg-white dark:bg-slate-900 focus-visible:ring-primary" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Products Grid */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Tag className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">أحدث المنتجات</h3>
                </div>

                {isLoadingProducts ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full rounded-[32px]" />)}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in-0 duration-700">
                        <div className="bg-muted/30 p-8 rounded-[40px] mb-4">
                            <Package className="h-16 w-16 text-muted-foreground opacity-20" />
                        </div>
                        <h3 className="font-black text-lg text-foreground/80">المتجر فارغ حالياً</h3>
                        <p className="text-xs font-bold text-muted-foreground mt-1">تواصل مع الإدارة لإضافة منتجات جديدة</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 pb-10">
                        {filteredProducts.map((product, index) => (
                            <Card 
                                key={product.id} 
                                className="overflow-hidden border-none shadow-xl rounded-[32px] group bg-white dark:bg-slate-900 animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className="relative aspect-[1/1.1] overflow-hidden">
                                    <Image 
                                        src={getSafeImageUrl(product.imageUrl)} 
                                        alt={product.name} 
                                        fill 
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        data-ai-hint="store product"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="absolute top-3 left-3">
                                        <Badge className="bg-primary/90 backdrop-blur-md border-none font-black px-3 py-1.5 rounded-full shadow-lg">
                                            {product.price.toLocaleString('en-US')} ر.ي
                                        </Badge>
                                    </div>
                                    {index === 0 && (
                                        <div className="absolute top-3 right-3">
                                            <div className="bg-yellow-400 text-yellow-900 p-1.5 rounded-full shadow-lg animate-bounce">
                                                <Star className="h-3.5 w-3.5 fill-current" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <CardContent className="p-4 space-y-3">
                                    <div className="space-y-1">
                                        <h3 className="font-black text-sm text-foreground truncate">{product.name}</h3>
                                        <p className="text-[10px] font-bold text-muted-foreground line-clamp-1 opacity-70">{product.description}</p>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        className="w-full h-10 rounded-[18px] text-[11px] font-black bg-mesh-gradient text-white border-none shadow-md active:scale-95 transition-transform" 
                                        onClick={() => handleWhatsAppPurchase(product)}
                                    >
                                        اشتري الان
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
