
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    PlusCircle, 
    Trash2, 
    Edit, 
    Save, 
    X, 
    Tag, 
    CreditCard, 
    FileUp, 
    Loader2, 
    List, 
    FileText, 
    Database, 
    Calendar,
    Wifi,
    Settings,
    LayoutGrid,
    CheckCircle2,
    Clock,
    AlertCircle,
    Smartphone,
    ShieldCheck
} from 'lucide-react';
import { 
    useCollection, 
    useFirestore, 
    useMemoFirebase, 
    deleteDocumentNonBlocking, 
    addDocumentNonBlocking, 
    updateDocumentNonBlocking, 
    useUser 
} from '@/firebase';
import { collection, doc, writeBatch, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger, 
    DialogClose 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const dynamic = 'force-dynamic';

type Network = {
    id: string;
    ownerId: string;
    name: string;
};

type CardCategory = {
  id: string;
  name: string;
  price: number;
  capacity?: string;
  validity?: string;
};

type NetworkCard = {
    id: string;
    cardNumber: string;
    status: 'available' | 'sold';
    categoryId: string;
};

const validityOptions = ["يوم", "يومين", "3 أيام", "أسبوع", "شهر", "شهرين", "3 أشهر", "6 أشهر", "سنة"];

export default function OwnerNetworkManagePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [network, setNetwork] = useState<Network | null>(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(true);

  // Fetch the owner's network
  const networkQuery = useMemoFirebase(() => (
    user && firestore ? query(collection(firestore, 'networks'), where('ownerId', '==', user.uid)) : null
  ), [user, firestore]);
  
  const { data: networks, isLoading: isNetworksLoading } = useCollection<Network>(networkQuery);
  
  useEffect(() => {
    if (networks && networks.length > 0) {
      setNetwork(networks[0]);
    }
    if (!isNetworksLoading) {
        setIsLoadingNetwork(false);
    }
  }, [networks, isNetworksLoading]);

  const networkId = network?.id;

  // Categories
  const categoriesCollection = useMemoFirebase(() => (firestore && networkId ? collection(firestore, `networks/${networkId}/cardCategories`) : null), [firestore, networkId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<CardCategory>(categoriesCollection);

  // Cards
  const cardsCollection = useMemoFirebase(() => (firestore && networkId ? collection(firestore, `networks/${networkId}/cards`) : null), [firestore, networkId]);
  const { data: cards, isLoading: isLoadingCards } = useCollection<NetworkCard>(cardsCollection);

  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState({ name: '', price: '', capacity: '', validity: '' });
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryValues, setEditingCategoryValues] = React.useState<Omit<CardCategory, 'id' | 'price'> & { price: string }>({ name: '', price: '', capacity: '', validity: '' });
  
  const [isAddCardOpen, setIsAddCardOpen] = React.useState(false);
  const [selectedCategoryIdForCard, setSelectedCategoryIdForCard] = React.useState<string>('');
  const [addCardMode, setAddCardMode] = React.useState<'single' | 'bulk'>('single');
  const [singleCard, setSingleCard] = React.useState({ cardNumber: '' });
  const [bulkCards, setBulkCards] = React.useState('');
  const [isProcessingCards, setIsProcessingCards] = React.useState(false);
  const [selectedCategoryForView, setSelectedCategoryForView] = useState<string>('');

  const [editingCard, setEditingCard] = useState<NetworkCard | null>(null);
  const [editingCardNumber, setEditingCardNumber] = useState('');
  const [cardToDelete, setCardToDelete] = useState<NetworkCard | null>(null);


  useEffect(() => {
    if (categories && categories.length > 0 && !selectedCategoryForView) {
      setSelectedCategoryForView(categories[0].id);
    }
  }, [categories, selectedCategoryForView]);

  const cardsByCategory = useMemo(() => {
    if (!cards) return {};
    return cards.reduce((acc, card) => {
        (acc[card.categoryId] = acc[card.categoryId] || []).push(card);
        return acc;
    }, {} as Record<string, NetworkCard[]>);
  }, [cards]);
  
  const handleAddCategory = () => {
    if (newCategory.name && newCategory.price && newCategory.validity && newCategory.capacity && categoriesCollection && networkId) {
        addDocumentNonBlocking(categoriesCollection, {
            networkId: networkId,
            name: newCategory.name,
            price: Number(newCategory.price),
            capacity: newCategory.capacity,
            validity: newCategory.validity,
        });
        setNewCategory({ name: '', price: '', capacity: '', validity: '' });
        setIsAddingCategory(false);
        toast({ title: 'نجاح', description: 'تمت إضافة الفئة بنجاح.' });
    } else {
        toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة.', variant: 'destructive' });
    }
  };

  const handleEditCategory = (category: CardCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryValues({ name: category.name, price: String(category.price), capacity: category.capacity || '', validity: category.validity || '' });
  };

  const handleSaveCategory = (id: string) => {
    if (!firestore || !networkId || !editingCategoryValues.name || !editingCategoryValues.price || !editingCategoryValues.validity || !editingCategoryValues.capacity) {
        toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة.', variant: 'destructive' });
        return;
    }
    const docRef = doc(firestore, `networks/${networkId}/cardCategories`, id);
    updateDocumentNonBlocking(docRef, { 
        name: editingCategoryValues.name, 
        price: Number(editingCategoryValues.price),
        capacity: editingCategoryValues.capacity,
        validity: editingCategoryValues.validity,
    });
    setEditingCategoryId(null);
    toast({ title: 'تم الحفظ', description: 'تم تحديث الفئة بنجاح.' });
  };

  const handleDeleteCategory = (id: string) => {
    if (!firestore || !networkId) return;
    const docRef = doc(firestore, `networks/${networkId}/cardCategories`, id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'تم الحذف', description: 'تم حذف الفئة بنجاح.', variant: 'destructive' });
  };
  
  const handleOpenAddCardDialog = (categoryId: string) => {
    setSelectedCategoryIdForCard(categoryId);
    setIsAddCardOpen(true);
  };
  
  const handleSaveCards = async () => {
    if (!firestore || !cardsCollection || !networkId) return;
    setIsProcessingCards(true);

    const cardsToAdd: Omit<NetworkCard, 'id'>[] = [];
    if (addCardMode === 'single') {
        if (singleCard.cardNumber) {
            cardsToAdd.push({
                cardNumber: singleCard.cardNumber,
                categoryId: selectedCategoryIdForCard,
                status: 'available'
            });
        }
    } else {
        const lines = bulkCards.trim().split('\n');
        lines.forEach(line => {
            const cardNumber = line.trim();
            if (cardNumber) {
                cardsToAdd.push({
                    cardNumber,
                    categoryId: selectedCategoryIdForCard,
                    status: 'available'
                });
            }
        });
    }

    if (cardsToAdd.length === 0) {
        toast({ title: 'خطأ', description: 'لم يتم إدخال أي كروت صالحة.', variant: 'destructive'});
        setIsProcessingCards(false);
        return;
    }

    const batch = writeBatch(firestore);
    cardsToAdd.forEach(cardData => {
        const cardRef = doc(cardsCollection);
        batch.set(cardRef, cardData);
    });

    batch.commit().then(() => {
        toast({ title: 'نجاح', description: `تمت إضافة ${cardsToAdd.length} كرت بنجاح.`});
        setIsAddCardOpen(false);
        setSingleCard({ cardNumber: ''});
        setBulkCards('');
    }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            operation: 'write',
            path: `networks/${networkId}/cards`,
            requestResourceData: { cards: cardsToAdd.length },
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsProcessingCards(false);
    });
  };

  const handleEditCardClick = (card: NetworkCard) => {
    setEditingCard(card);
    setEditingCardNumber(card.cardNumber);
  };
  
  const handleSaveCard = () => {
    if (!firestore || !networkId || !editingCard || !editingCardNumber) {
        toast({ title: "خطأ", description: "بيانات الكرت غير صالحة.", variant: "destructive"});
        return;
    }
    const cardDocRef = doc(firestore, `networks/${networkId}/cards`, editingCard.id);
    updateDocumentNonBlocking(cardDocRef, { cardNumber: editingCardNumber });
    toast({ title: "تم الحفظ", description: "تم تحديث رقم الكرت بنجاح."});
    setEditingCard(null);
    setEditingCardNumber('');
  };
  
  const handleDeleteCard = () => {
    if (!firestore || !networkId || !cardToDelete) return;
    const cardDocRef = doc(firestore, `networks/${networkId}/cards`, cardToDelete.id);
    deleteDocumentNonBlocking(cardDocRef);
    toast({ title: "تم الحذف", description: "تم حذف الكرت بنجاح.", variant: "destructive"});
    setCardToDelete(null);
  }

  const renderCategories = () => {
    if (isLoadingCategories) return <Skeleton className="h-48 w-full rounded-[32px]" />;
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                    فئات الكروت الحالية
                </h3>
            </div>
            
            <div className="space-y-3">
                {categories?.map(cat => (
                    <Card key={cat.id} className="border-none shadow-sm rounded-[28px] overflow-hidden bg-white dark:bg-slate-900 group">
                       {editingCategoryId === cat.id ? (
                           <CardContent className="p-6 space-y-4">
                               <div className="space-y-4">
                                   <div className="grid grid-cols-2 gap-3">
                                       <div className="space-y-1">
                                           <Label className="text-[10px] font-black text-muted-foreground mr-1">اسم الفئة</Label>
                                           <Input value={editingCategoryValues.name} onChange={(e) => setEditingCategoryValues(p => ({...p, name: e.target.value}))} className="h-10 rounded-xl" />
                                       </div>
                                       <div className="space-y-1">
                                           <Label className="text-[10px] font-black text-muted-foreground mr-1">السعر (ر.ي)</Label>
                                           <Input type="number" value={editingCategoryValues.price} onChange={(e) => setEditingCategoryValues(p => ({...p, price: e.target.value}))} className="h-10 rounded-xl" />
                                       </div>
                                   </div>
                                   <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black text-muted-foreground mr-1">السعة (GB)</Label>
                                            <Input value={editingCategoryValues.capacity || ''} onChange={(e) => setEditingCategoryValues(p => ({...p, capacity: e.target.value}))} className="h-10 rounded-xl" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black text-muted-foreground mr-1">الصلاحية</Label>
                                            <Select onValueChange={(value) => setEditingCategoryValues(p => ({...p, validity: value}))} defaultValue={editingCategoryValues.validity || ''}>
                                                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="اختر" /></SelectTrigger>
                                                <SelectContent>
                                                    {validityOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                   </div>
                               </div>
                               <div className="flex justify-end gap-2 pt-2">
                                   <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={() => setEditingCategoryId(null)}>إلغاء</Button>
                                   <Button size="sm" className="rounded-xl px-6" onClick={() => handleSaveCategory(cat.id)}>حفظ التغييرات</Button>
                               </div>
                           </CardContent>
                       ) : (
                        <CardContent className="p-5 flex items-center justify-between gap-4">
                            <div className="p-3 bg-primary/5 rounded-[22px] border border-primary/5 group-hover:bg-primary/10 transition-colors w-14 h-14 flex items-center justify-center shrink-0">
                                <Tag className="h-6 w-6 text-primary" />
                            </div>

                            <div className="flex-1 text-right overflow-hidden">
                                <h4 className="font-black text-base text-foreground mb-1 truncate">{cat.name}</h4>
                                <div className="flex items-center justify-end gap-3 opacity-70">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                        <Database className="w-3 h-3" />
                                        <span>{cat.capacity || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground border-r pr-3">
                                        <Clock className="w-3 h-3" />
                                        <span>{cat.validity || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-left shrink-0">
                                <p className="font-black text-primary text-base leading-tight">{cat.price.toLocaleString('en-US')}</p>
                                <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">ريال يمني</p>
                            </div>

                            <div className="flex flex-col gap-1.5 border-r pr-3 mr-1">
                                <button onClick={() => handleEditCategory(cat)} className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><button className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button></AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[32px]">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-center font-black">تأكيد حذف الفئة</AlertDialogTitle>
                                            <AlertDialogDescription className="text-center pt-2">هل أنت متأكد من رغبتك في حذف فئة "{cat.name}"؟ لن يتم حذف الكروت المرتبطة بها تلقائياً.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                                            <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold">تأكيد الحذف</AlertDialogAction>
                                            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                       )}
                    </Card>
                ))}

                {isAddingCategory && (
                    <Card className="rounded-[28px] border-2 border-dashed border-primary/20 bg-primary/5 animate-in zoom-in-95 duration-500 overflow-hidden">
                        <CardContent className="p-6 space-y-4">
                            <div className="text-center pb-2">
                                <h4 className="font-black text-primary">إضافة فئة جديدة</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] font-black text-muted-foreground mr-1">الاسم</Label><Input placeholder="باقة 10GB" value={newCategory.name} onChange={e => setNewCategory(p => ({...p, name: e.target.value}))} className="h-10 rounded-xl" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-black text-muted-foreground mr-1">السعر</Label><Input type="number" placeholder="2000" value={newCategory.price} onChange={e => setNewCategory(p => ({...p, price: e.target.value}))} className="h-10 rounded-xl" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] font-black text-muted-foreground mr-1">السعة</Label><Input placeholder="10 GB" value={newCategory.capacity} onChange={e => setNewCategory(p => ({...p, capacity: e.target.value}))} className="h-10 rounded-xl" /></div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black text-muted-foreground mr-1">الصلاحية</Label>
                                    <Select onValueChange={(value) => setNewCategory(p => ({...p, validity: value}))} value={newCategory.validity}>
                                        <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="اختر" /></SelectTrigger>
                                        <SelectContent>{validityOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" size="sm" className="rounded-xl px-4" onClick={() => setIsAddingCategory(false)}>إلغاء</Button>
                                <Button size="sm" className="rounded-xl px-8 font-black" onClick={handleAddCategory}>إضافة الفئة</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                 {!isAddingCategory && (
                    <Button 
                        variant="outline" 
                        className="w-full h-12 rounded-[20px] border-2 border-dashed border-primary/30 text-primary font-black hover:bg-primary/5 active:scale-95 transition-all" 
                        onClick={() => setIsAddingCategory(true)}
                    >
                        <PlusCircle className="ml-2 h-4 w-4" /> إضافة فئة جديدة
                    </Button>
                )}
            </div>
        </div>
    );
  };
  
  const renderCards = () => {
    if (isLoadingCategories || isLoadingCards) return <Skeleton className="h-64 w-full rounded-[32px]" />;
    
    if (!categories || categories.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center space-y-3">
                <AlertCircle className="h-12 w-12" />
                <p className="text-xs font-bold px-10">الرجاء إضافة فئة واحدة على الأقل للبدء في إدارة الكروت.</p>
            </div>
        )
    }

    const currentCards = cardsByCategory[selectedCategoryForView] || [];

    return (
        <div className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    إدارة مخزون الكروت
                </h3>
            </div>

            <Card className="rounded-[36px] border-none shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground pr-1">الفئة المستهدفة</Label>
                        <Select value={selectedCategoryForView} onValueChange={setSelectedCategoryForView}>
                            <SelectTrigger className="h-12 rounded-2xl bg-muted/20 border-none font-bold">
                            <SelectValue placeholder="اختر فئة لعرض الكروت" />
                            </SelectTrigger>
                            <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.price} ر.ي)</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedCategoryForView && (
                    <div className="space-y-4 animate-in fade-in-0 duration-300">
                        <div className="flex items-center justify-between bg-primary/5 p-3 rounded-2xl border border-primary/5">
                            <p className="text-[11px] font-black text-primary">المخزون الحالي:</p>
                            <Badge className="bg-primary text-white font-black h-6 px-3">{currentCards.length} كرت</Badge>
                        </div>

                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                            {currentCards.length > 0 ? (
                                currentCards.map(card => (
                                    <div key={card.id} className="p-3 bg-muted/10 rounded-xl flex items-center justify-between border border-transparent hover:border-primary/10 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <p className="font-mono font-black text-sm tracking-widest text-foreground">{card.cardNumber}</p>
                                            <Badge className={cn(
                                                "text-[8px] font-black h-4 px-1.5 border-none",
                                                card.status === 'sold' ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'
                                            )}>
                                                {card.status === 'sold' ? 'مباع' : 'متاح'}
                                            </Badge>
                                        </div>
                                        {card.status === 'available' && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditCardClick(card)} className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => setCardToDelete(card)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className='text-center text-[10px] font-bold text-muted-foreground py-10 opacity-50'>لا توجد كروت مضافة في هذه الفئة حالياً.</p>
                            )}
                        </div>

                        <Button 
                            className="w-full h-11 rounded-2xl font-black text-sm bg-mesh-gradient text-white shadow-lg active:scale-95 transition-all border-none" 
                            onClick={() => handleOpenAddCardDialog(selectedCategoryForView)}
                        >
                            <PlusCircle className="ml-2 h-4 w-4" /> إضافة كروت جديدة
                        </Button>
                    </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
  };
  
  if (isLoadingNetwork) {
    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <SimpleHeader title="إدارة شبكتي" />
            <div className="flex-1 p-4 space-y-6">
                <Skeleton className="h-32 w-full rounded-[32px]" />
                <Skeleton className="h-64 w-full rounded-[32px]" />
            </div>
      </div>
    )
  }
  
  if(!network) {
     return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <SimpleHeader title="إدارة شبكتي" />
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
               <AlertCircle className="h-16 w-16 text-muted-foreground opacity-20" />
               <p className='text-sm font-black text-muted-foreground'>لم نتمكن من العثور على شبكة تجارية مرتبطة بحسابك حالياً. يرجى التواصل مع الإدارة.</p>
               <Button onClick={() => router.push('/login')} variant="outline" className="rounded-2xl">العودة للرئيسية</Button>
            </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
      <SimpleHeader title={`إدارة: ${network.name}`} />
      
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Header Hero Section */}
        <div className="bg-mesh-gradient pt-4 pb-10 px-6 rounded-b-[40px] shadow-xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center space-y-3">
                <div className="bg-white/20 p-3 rounded-[20px] backdrop-blur-md border border-white/20 shadow-2xl animate-in zoom-in-95 duration-700">
                    <Wifi className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">إدارة الفئات والمخزون</h2>
                    <div className="bg-white/15 px-3 py-1 rounded-full border border-white/10">
                         <p className="text-[9px] text-white font-black uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck className="w-2.5 h-2.5" /> رسوم العمولة: 10% لكل كرت</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-4 space-y-10 pb-20">
            {renderCategories()}
            {renderCards()}
        </div>
      </div>

      <Toaster />

      {/* Add Cards Dialog */}
      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl outline-none">
            <div className="bg-mesh-gradient p-8 text-center text-white relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <DialogHeader>
                    <DialogTitle className="text-center font-black text-2xl text-white">إضافة كروت جديدة</DialogTitle>
                    <DialogDescription className="text-center text-white/70 font-bold">للفئة: {categories?.find(c => c.id === selectedCategoryIdForCard)?.name}</DialogDescription>
                </DialogHeader>
            </div>
            
            <div className="p-6 space-y-4">
                <Tabs value={addCardMode} onValueChange={(value) => setAddCardMode(value as 'single' | 'bulk')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/30 h-11 p-1 rounded-2xl mb-4">
                        <TabsTrigger value="single" className="rounded-xl font-bold text-xs">كرت واحد</TabsTrigger>
                        <TabsTrigger value="bulk" className="rounded-xl font-bold text-xs">إضافة دفعة</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="single" className="space-y-4 pt-2">
                        <div className="space-y-2 text-right">
                            <Label htmlFor="cardNumber" className="text-[10px] font-black text-muted-foreground mr-1 uppercase">رقم الكرت</Label>
                            <Input 
                                id="cardNumber" 
                                value={singleCard.cardNumber} 
                                onChange={e => setSingleCard(p => ({...p, cardNumber: e.target.value}))} 
                                placeholder="أدخل رقم الكرت هنا"
                                className="h-12 rounded-2xl bg-muted/20 border-none font-black text-lg tracking-widest text-center"
                            />
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="bulk" className="space-y-4 pt-2">
                        <div className="space-y-2 text-right">
                            <Label htmlFor="bulkData" className="text-[10px] font-black text-muted-foreground mr-1 uppercase">بيانات الكروت (كرت في كل سطر)</Label>
                            <Textarea 
                                id="bulkData" 
                                rows={6}
                                value={bulkCards}
                                onChange={e => setBulkCards(e.target.value)}
                                placeholder="111222&#10;333444&#10;555666"
                                className="rounded-2xl bg-muted/20 border-none font-black font-mono tracking-widest no-scrollbar"
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="grid grid-cols-2 gap-3 pt-4">
                    <Button 
                        onClick={handleSaveCards} 
                        disabled={isProcessingCards}
                        className="w-full h-12 rounded-2xl font-black shadow-lg"
                    >
                        {isProcessingCards ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="ml-2 h-4 w-4" />}
                        {isProcessingCards ? 'جاري الحفظ...' : 'حفظ الكروت'}
                    </Button>
                    <DialogClose asChild><Button variant="outline" className="w-full h-12 rounded-2xl font-bold">إلغاء</Button></DialogClose>
                </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Card Dialog */}
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="rounded-[32px] max-sm p-6 outline-none">
            <DialogHeader>
                <DialogTitle className="text-center font-black">تعديل رقم الكرت</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">الرقم الجديد</Label>
                <Input
                    value={editingCardNumber}
                    onChange={(e) => setEditingCardNumber(e.target.value)}
                    className="h-14 rounded-2xl text-center text-xl font-black tracking-widest bg-muted/20 border-none"
                />
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3">
                <Button onClick={handleSaveCard} className="w-full h-12 rounded-2xl font-black">حفظ التغييرات</Button>
                <DialogClose asChild><Button variant="outline" className="w-full h-12 rounded-2xl font-bold">إلغاء</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Card Alert */}
      <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
        <AlertDialogContent className="rounded-[40px] max-sm p-8 border-none shadow-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-center font-black text-xl">تأكيد حذف الكرت</AlertDialogTitle>
                <AlertDialogDescription className="text-center pt-2 font-bold">
                    هل أنت متأكد من حذف الكرت رقم <span className="text-primary font-mono tracking-wider">{cardToDelete?.cardNumber}</span> نهائياً؟
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:space-x-0">
                <AlertDialogAction onClick={handleDeleteCard} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold shadow-lg">حذف نهائي</AlertDialogAction>
                <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-bold">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
