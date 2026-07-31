
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Edit, Save, X, Tag, CreditCard, FileUp, Loader2, List, FileText, Database, Calendar } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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

const validityOptions = ["يوم", "يومين", "3 أيام", "أسبوع", "شهر"];

export default function NetworkDetailPage({ params }: { params: { networkId: string } }) {
  const { networkId } = params;
  const firestore = useFirestore();
  const { toast } = useToast();

  // Categories
  const categoriesCollection = useMemoFirebase(() => (firestore ? collection(firestore, `networks/${networkId}/cardCategories`) : null), [firestore, networkId]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<CardCategory>(categoriesCollection);

  // Cards
  const cardsCollection = useMemoFirebase(() => (firestore ? collection(firestore, `networks/${networkId}/cards`) : null), [firestore, networkId]);
  const { data: cards, isLoading: isLoadingCards } = useCollection<NetworkCard>(cardsCollection);

  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState({ name: '', price: '', capacity: '', validity: '' });
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryValues, setEditingCategoryValues] = React.useState<Omit<CardCategory, 'id' | 'price'> & { price: string }>({ name: '', price: '', capacity: '', validity: '' });
  
  // State for adding cards dialog
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
    if (newCategory.name && newCategory.price && newCategory.validity && newCategory.capacity && categoriesCollection) {
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
    if (!firestore || !editingCategoryValues.name || !editingCategoryValues.price || !editingCategoryValues.validity || !editingCategoryValues.capacity) {
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
    if (!firestore) return;
    const docRef = doc(firestore, `networks/${networkId}/cardCategories`, id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: 'تم الحذف', description: 'تم حذف الفئة. (الكروت لم تحذف)', variant: 'destructive' });
  };
  
  const handleOpenAddCardDialog = (categoryId: string) => {
    setSelectedCategoryIdForCard(categoryId);
    setIsAddCardOpen(true);
  };
  
  const handleSaveCards = async () => {
    if (!firestore || !cardsCollection) return;
    setIsProcessingCards(true);

    const cardsToAdd: Omit<NetworkCard, 'id'>[] = [];
    if (addCardMode === 'single') {
        if (singleCard.cardNumber) {
            cardsToAdd.push({
                ...singleCard,
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

    try {
        const batch = writeBatch(firestore);
        cardsToAdd.forEach(cardData => {
            const cardRef = doc(cardsCollection); // Auto-generate ID
            batch.set(cardRef, cardData);
        });
        await batch.commit();
        toast({ title: 'نجاح', description: `تمت إضافة ${cardsToAdd.length} كرت بنجاح.`});
        setIsAddCardOpen(false);
        setSingleCard({ cardNumber: ''});
        setBulkCards('');
    } catch (error) {
        console.error("Error adding cards:", error);
        toast({ title: 'خطأ', description: 'فشلت عملية إضافة الكروت.', variant: 'destructive'});
    } finally {
        setIsProcessingCards(false);
    }
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
    if (isLoadingCategories) return <Skeleton className="h-48 w-full" />;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-center">فئات الكروت</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {categories?.map(cat => (
                    <Card key={cat.id} className="p-3">
                       {editingCategoryId === cat.id ? (
                           <div className="space-y-3">
                               <Input value={editingCategoryValues.name} onChange={(e) => setEditingCategoryValues(p => ({...p, name: e.target.value}))} placeholder="اسم الفئة"/>
                               <Input type="number" value={editingCategoryValues.price} onChange={(e) => setEditingCategoryValues(p => ({...p, price: e.target.value}))} placeholder="السعر"/>
                               <Input value={editingCategoryValues.capacity || ''} onChange={(e) => setEditingCategoryValues(p => ({...p, capacity: e.target.value}))} placeholder="السعة (مثال: 1 GB)"/>
                               <Select onValueChange={(value) => setEditingCategoryValues(p => ({...p, validity: value}))} defaultValue={editingCategoryValues.validity || ''}>
                                 <SelectTrigger><SelectValue placeholder="اختر الصلاحية" /></SelectTrigger>
                                 <SelectContent>
                                   {validityOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                 </SelectContent>
                               </Select>
                               <div className="flex justify-end gap-2">
                                   <Button size="icon" variant="ghost" onClick={() => setEditingCategoryId(null)}><X className="h-4 w-4" /></Button>
                                   <Button size="icon" onClick={() => handleSaveCategory(cat.id)}><Save className="h-4 w-4" /></Button>
                               </div>
                           </div>
                       ) : (
                        <div className="flex items-start justify-between">
                            <div className='flex-1'>
                                <p className="font-semibold">{cat.name}</p>
                                <div className="text-sm text-muted-foreground mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <CreditCard className="w-4 h-4 text-primary dark:text-primary-foreground" />
                                        <span>{cat.price.toLocaleString('en-US')} ريال</span>
                                    </div>
                                    {cat.capacity && <div className="flex items-center gap-1.5"><Database className="w-4 h-4" /><span>{cat.capacity}</span></div>}
                                    {cat.validity && <div className="flex items-center gap-1.5 col-span-2"><Calendar className="w-4 h-4" /><span>{cat.validity}</span></div>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleEditCategory(cat)}><Edit className="h-4 w-4" /></Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                            <AlertDialogDescription>هل أنت متأكد من حذف فئة "{cat.name}"؟</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)}>حذف</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                       )}
                    </Card>
                ))}
                 {isAddingCategory && (
                    <Card className="p-3 bg-muted/50">
                        <div className="space-y-3">
                            <Input placeholder="اسم الفئة" value={newCategory.name} onChange={e => setNewCategory(p => ({...p, name: e.target.value}))} />
                            <Input type="number" placeholder="السعر" value={newCategory.price} onChange={e => setNewCategory(p => ({...p, price: e.target.value}))} />
                            <Input placeholder="السعة (مثال: 1GB)" value={newCategory.capacity} onChange={e => setNewCategory(p => ({...p, capacity: e.target.value}))} />
                             <Select onValueChange={(value) => setNewCategory(p => ({...p, validity: value}))} value={newCategory.validity}>
                                <SelectTrigger><SelectValue placeholder="اختر الصلاحية" /></SelectTrigger>
                                <SelectContent>
                                    {validityOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex justify-end gap-2">
                                <Button size="icon" variant="ghost" onClick={() => setIsAddingCategory(false)}><X className="h-4 w-4" /></Button>
                                <Button onClick={handleAddCategory}>إضافة</Button>
                            </div>
                        </div>
                    </Card>
                )}
                 {!isAddingCategory && (
                    <Button className="w-full" onClick={() => setIsAddingCategory(true)}>
                        <PlusCircle className="ml-2 h-4 w-4" /> إضافة فئة
                    </Button>
                )}
            </CardContent>
        </Card>
    );
  };
  
  const renderCards = () => {
    if (isLoadingCategories || isLoadingCards) return <Skeleton className="h-64 w-full" />;
    
    if (!categories || categories.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-center">الكروت</CardTitle>
                </CardHeader>
                <CardContent className='text-center text-muted-foreground py-8'>
                    <p>الرجاء إضافة فئة واحدة على الأقل أولاً.</p>
                </CardContent>
            </Card>
        )
    }

    const currentCards = cardsByCategory[selectedCategoryForView] || [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-center">كروت الشبكة</CardTitle>
                <CardDescription className="text-center">إدارة الكروت المتاحة لكل فئة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select value={selectedCategoryForView} onValueChange={setSelectedCategoryForView}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر فئة لعرض الكروت" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedCategoryForView && (
                  <Card className='bg-muted/30'>
                    <CardHeader>
                      <CardTitle className='text-base flex justify-between items-center'>
                        <span>كروت فئة "{categories.find(c => c.id === selectedCategoryForView)?.name}"</span>
                        <span className='text-sm text-primary dark:text-primary-foreground'>({currentCards.length} كرت)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                      {currentCards.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                           {currentCards.map(card => (
                              <div key={card.id} className='p-2 bg-background border rounded-md flex justify-between items-center'>
                                <p className='font-mono text-sm font-semibold'>{card.cardNumber}</p>
                                <div className="flex items-center gap-2">
                                    <Badge className={cn(
                                        card.status === 'sold' ? 'bg-red-500' : 'bg-green-500',
                                        'text-white'
                                    )}>
                                        {card.status === 'sold' ? 'مباع' : 'متاح'}
                                    </Badge>
                                    {card.status === 'available' && (
                                        <>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditCardClick(card)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCardToDelete(card)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                          <p className='text-center text-sm text-muted-foreground py-4'>لا توجد كروت في هذه الفئة.</p>
                      )}
                       <Button className="w-full mt-4" size="sm" variant="outline" onClick={() => handleOpenAddCardDialog(selectedCategoryForView)}>
                          <PlusCircle className="ml-2 h-4 w-4" />
                          إضافة كروت لهذه الفئة
                      </Button>
                    </CardContent>
                  </Card>
                )}
            </CardContent>
        </Card>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="إدارة تفاصيل الشبكة" />
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {renderCategories()}
            {renderCards()}
        </div>
      </div>
      <Toaster />
      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>إضافة كروت جديدة</DialogTitle>
                <DialogDescription>
                    أضف كروت جديدة للفئة المختارة.
                </DialogDescription>
            </DialogHeader>
            <Tabs value={addCardMode} onValueChange={(value) => setAddCardMode(value as 'single' | 'bulk')}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="single">إضافة كرت واحد</TabsTrigger>
                    <TabsTrigger value="bulk">إضافة دفعة</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="space-y-4 pt-4">
                    <div>
                        <Label htmlFor="cardNumber">رقم الكرت</Label>
                        <Input id="cardNumber" value={singleCard.cardNumber} onChange={e => setSingleCard(p => ({...p, cardNumber: e.target.value}))} />
                    </div>
                </TabsContent>
                <TabsContent value="bulk" className="space-y-4 pt-4">
                    <Label htmlFor="bulkData">بيانات الكروت</Label>
                    <Textarea 
                        id="bulkData" 
                        rows={6}
                        value={bulkCards}
                        onChange={e => setBulkCards(e.target.value)}
                        placeholder="كل كرت في سطر جديد، مثال:&#10;111222&#10;333444&#10;555666"
                    />
                    <p className="text-xs text-muted-foreground">
                        أدخل رقم كرت واحد في كل سطر.
                    </p>
                </TabsContent>
            </Tabs>
            <DialogFooter>
                <Button onClick={handleSaveCards} disabled={isProcessingCards}>
                    {isProcessingCards ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isProcessingCards ? 'جاري الحفظ...' : 'حفظ الكروت'}
                </Button>
                <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>تعديل رقم الكرت</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="edit-card-number">رقم الكرت</Label>
                <Input
                    id="edit-card-number"
                    value={editingCardNumber}
                    onChange={(e) => setEditingCardNumber(e.target.value)}
                />
            </div>
            <DialogFooter>
                <Button onClick={handleSaveCard}>حفظ التغييرات</Button>
                <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من حذف الكرت رقم "{cardToDelete?.cardNumber}"؟
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCard} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
