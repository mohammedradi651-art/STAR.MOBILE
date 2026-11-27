'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PlusCircle,
  Trash2,
  Edit,
  Tag,
  CreditCard,
  Loader2,
  Database,
  Wifi,
  LayoutGrid,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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

const validityOptions = ['يوم', 'يومين', '3 أيام', 'أسبوع', 'شهر', 'شهرين', '3 أشهر', '6 أشهر', 'سنة'];

export default function NetworkDetailPage() {
  const params = useParams<{ networkId: string }>();
  const networkId = params?.networkId || '';
  const firestore = useFirestore();
  const { toast } = useToast();

  // جلب بيانات الشبكة والفئات من local_networks/{networkId}
  const localNetDocRef = useMemoFirebase(
    () => (firestore && networkId ? doc(firestore, `users/${networkId}/local_networks`, networkId) : null),
    [firestore, networkId]
  );
  const { data: localNetDoc, isLoading: isLoadingCategories } = useDoc<any>(localNetDocRef);

  const categories: CardCategory[] = useMemo(() => {
    if (!localNetDoc || !Array.isArray(localNetDoc.categories)) return [];
    return localNetDoc.categories;
  }, [localNetDoc]);

  // جلب الكروت من cards_data/cards
  const cardsDocRef = useMemoFirebase(
    () => (firestore && networkId ? doc(firestore, `users/${networkId}/local_networks/${networkId}/cards_data`, 'cards') : null),
    [firestore, networkId]
  );
  const { data: cardsDocData, isLoading: isLoadingCards } = useDoc<any>(cardsDocRef);

  const cards: NetworkCard[] = useMemo(() => {
    if (!cardsDocData || !Array.isArray(cardsDocData.cards)) return [];
    return cardsDocData.cards.map((c: any, index: number) => ({
      id: c.c || String(index),
      cardNumber: c.c,
      status: c.isUsed === true || c.u === true ? 'sold' : 'available',
      categoryId: c.cat,
    }));
  }, [cardsDocData]);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', price: '', capacity: '', validity: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryValues, setEditingCategoryValues] = useState<{
    name: string;
    price: string;
    capacity: string;
    validity: string;
  }>({ name: '', price: '', capacity: '', validity: '' });

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [selectedCategoryIdForCard, setSelectedCategoryIdForCard] = useState<string>('');
  const [addCardMode, setAddCardMode] = useState<'single' | 'bulk'>('single');
  const [singleCard, setSingleCard] = useState({ cardNumber: '' });
  const [bulkCards, setBulkCards] = useState('');
  const [isProcessingCards, setIsProcessingCards] = useState(false);
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
    return cards.reduce((acc, card) => {
      (acc[card.categoryId] = acc[card.categoryId] || []).push(card);
      return acc;
    }, {} as Record<string, NetworkCard[]>);
  }, [cards]);

  const availableCardsCount = useMemo(() => cards.filter((c) => c.status === 'available').length, [cards]);
  const soldCardsCount = useMemo(() => cards.filter((c) => c.status === 'sold').length, [cards]);

  const handleAddCategory = async () => {
    if (!firestore || !networkId) return;
    if (newCategory.name.trim() && newCategory.price && newCategory.validity) {
      try {
        const localRef = doc(firestore, `users/${networkId}/local_networks`, networkId);
        const snap = await getDoc(localRef);
        const currentCats = snap.exists() && Array.isArray(snap.data().categories) ? snap.data().categories : [];
        const catId = `cat_${Date.now()}`;
        const newCatObj = {
          id: catId,
          name: newCategory.name.trim(),
          price: Number(newCategory.price),
          capacity: newCategory.capacity.trim() || '',
          validity: newCategory.validity.trim(),
          notes: newCategory.capacity.trim() || '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(
          localRef,
          {
            categories: [...currentCats, newCatObj],
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setNewCategory({ name: '', price: '', capacity: '', validity: '' });
        setIsAddingCategory(false);
        toast({ title: 'نجاح', description: 'تمت إضافة الفئة بنجاح.' });
      } catch (e: any) {
        console.error('Error adding category:', e);
        toast({ title: 'خطأ', description: 'فشل حفظ الفئة: ' + e.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'خطأ', description: 'يرجى تعبئة الاسم والسعر والصلاحية.', variant: 'destructive' });
    }
  };

  const handleEditCategory = (category: CardCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryValues({
      name: category.name,
      price: String(category.price),
      capacity: category.capacity || '',
      validity: category.validity || '',
    });
  };

  const handleSaveCategory = async (id: string) => {
    if (!firestore || !networkId || !editingCategoryValues.name.trim() || !editingCategoryValues.price || !editingCategoryValues.validity) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة.', variant: 'destructive' });
      return;
    }
    try {
      const localRef = doc(firestore, `users/${networkId}/local_networks`, networkId);
      const snap = await getDoc(localRef);
      if (!snap.exists()) return;
      const currentCats = snap.data().categories || [];
      const updatedCats = currentCats.map((c: any) => {
        if (c.id === id) {
          return {
            ...c,
            name: editingCategoryValues.name.trim(),
            price: Number(editingCategoryValues.price),
            capacity: editingCategoryValues.capacity.trim(),
            notes: editingCategoryValues.capacity.trim(),
            validity: editingCategoryValues.validity.trim(),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      await updateDoc(localRef, {
        categories: updatedCats,
        updatedAt: serverTimestamp(),
      });
      setEditingCategoryId(null);
      toast({ title: 'تم الحفظ', description: 'تم تحديث الفئة بنجاح.' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل التعديل: ' + e.message, variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!firestore || !networkId) return;
    try {
      const localRef = doc(firestore, `users/${networkId}/local_networks`, networkId);
      const snap = await getDoc(localRef);
      if (!snap.exists()) return;
      const currentCats = snap.data().categories || [];
      const updatedCats = currentCats.filter((c: any) => c.id !== id);
      await updateDoc(localRef, {
        categories: updatedCats,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'تم الحذف', description: 'تم حذف الفئة بنجاح.', variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل الحذف: ' + e.message, variant: 'destructive' });
    }
  };

  const handleOpenAddCardDialog = (categoryId: string) => {
    setSelectedCategoryIdForCard(categoryId);
    setIsAddCardOpen(true);
  };

  const handleSaveCards = async () => {
    if (!firestore || !networkId) return;
    setIsProcessingCards(true);

    const cardsToAdd: string[] = [];
    if (addCardMode === 'single') {
      if (singleCard.cardNumber.trim()) {
        cardsToAdd.push(singleCard.cardNumber.trim());
      }
    } else {
      bulkCards
        .trim()
        .split('\n')
        .forEach((line) => {
          const cardNumber = line.trim();
          if (cardNumber) cardsToAdd.push(cardNumber);
        });
    }

    if (cardsToAdd.length === 0) {
      toast({ title: 'خطأ', description: 'لم يتم إدخال أي كروت صالحة.', variant: 'destructive' });
      setIsProcessingCards(false);
      return;
    }

    try {
      const cardsRef = doc(firestore, `users/${networkId}/local_networks/${networkId}/cards_data`, 'cards');
      const snap = await getDoc(cardsRef);
      const existingCards: any[] = snap.exists() && Array.isArray(snap.data().cards) ? [...snap.data().cards] : [];
      const existingSet = new Set(existingCards.map((c) => String(c.c).trim()));

      const catObj = categories.find((c) => c.id === selectedCategoryIdForCard);
      let addedCount = 0;

      for (const cNo of cardsToAdd) {
        if (!existingSet.has(cNo)) {
          existingCards.push({
            c: cNo,
            cat: selectedCategoryIdForCard,
            categoryName: catObj?.name || '',
            p: catObj?.price || 0,
            u: false,
            isUsed: false,
            soldAt: null,
          });
          existingSet.add(cNo);
          addedCount++;
        }
      }

      await setDoc(
        cardsRef,
        {
          cards: existingCards,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateDoc(doc(firestore, `users/${networkId}/local_networks`, networkId), {
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      toast({ title: 'نجاح', description: `تمت إضافة ${addedCount} كرت بنجاح.` });
      setIsAddCardOpen(false);
      setSingleCard({ cardNumber: '' });
      setBulkCards('');
    } catch (e: any) {
      console.error('Error saving cards:', e);
      toast({ title: 'خطأ', description: 'فشلت إضافة الكروت: ' + e.message, variant: 'destructive' });
    } finally {
      setIsProcessingCards(false);
    }
  };

  const handleEditCardClick = (card: NetworkCard) => {
    setEditingCard(card);
    setEditingCardNumber(card.cardNumber);
  };

  const handleSaveCard = async () => {
    if (!firestore || !networkId || !editingCard || !editingCardNumber.trim()) {
      toast({ title: 'خطأ', description: 'بيانات الكرت غير صالحة.', variant: 'destructive' });
      return;
    }
    try {
      const cardsRef = doc(firestore, `users/${networkId}/local_networks/${networkId}/cards_data`, 'cards');
      const snap = await getDoc(cardsRef);
      if (!snap.exists()) return;
      const currentCards = snap.data().cards || [];
      const updatedCards = currentCards.map((c: any) =>
        String(c.c).trim() === String(editingCard.cardNumber).trim() ? { ...c, c: editingCardNumber.trim() } : c
      );
      await setDoc(cardsRef, { cards: updatedCards, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: 'تم الحفظ', description: 'تم تحديث رقم الكرت بنجاح.' });
      setEditingCard(null);
      setEditingCardNumber('');
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل التعديل: ' + e.message, variant: 'destructive' });
    }
  };

  const handleDeleteCard = async () => {
    if (!firestore || !networkId || !cardToDelete) return;
    try {
      const cardsRef = doc(firestore, `users/${networkId}/local_networks/${networkId}/cards_data`, 'cards');
      const snap = await getDoc(cardsRef);
      if (!snap.exists()) return;
      const currentCards = snap.data().cards || [];
      const updatedCards = currentCards.filter((c: any) => String(c.c).trim() !== String(cardToDelete.cardNumber).trim());
      await setDoc(cardsRef, { cards: updatedCards, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: 'تم الحذف', description: 'تم حذف الكرت بنجاح.', variant: 'destructive' });
      setCardToDelete(null);
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل الحذف: ' + e.message, variant: 'destructive' });
    }
  };

  const renderCategories = () => {
    if (isLoadingCategories) return <Skeleton className="h-48 w-full rounded-[32px]" />;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
            فئات الكروت الحالية ({categories.length})
          </h3>
        </div>

        <div className="space-y-3">
          {categories.map((cat) => {
            const catCards = cardsByCategory[cat.id] || [];
            const catAvailable = catCards.filter((c) => c.status === 'available').length;
            return (
              <Card key={cat.id} className="border-none shadow-sm rounded-[28px] overflow-hidden bg-card group">
                {editingCategoryId === cat.id ? (
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-muted-foreground mr-1">اسم الفئة</Label>
                        <Input
                          value={editingCategoryValues.name}
                          onChange={(e) => setEditingCategoryValues((p) => ({ ...p, name: e.target.value }))}
                          className="h-10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-muted-foreground mr-1">السعر (ر.ي)</Label>
                        <Input
                          type="number"
                          value={editingCategoryValues.price}
                          onChange={(e) => setEditingCategoryValues((p) => ({ ...p, price: e.target.value }))}
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-muted-foreground mr-1">السعة (GB)</Label>
                        <Input
                          value={editingCategoryValues.capacity}
                          onChange={(e) => setEditingCategoryValues((p) => ({ ...p, capacity: e.target.value }))}
                          className="h-10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-muted-foreground mr-1">الصلاحية</Label>
                        <Select
                          onValueChange={(value) => setEditingCategoryValues((p) => ({ ...p, validity: value }))}
                          value={editingCategoryValues.validity}
                        >
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue placeholder="اختر" />
                          </SelectTrigger>
                          <SelectContent>
                            {validityOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={() => setEditingCategoryId(null)}>
                        إلغاء
                      </Button>
                      <Button size="sm" className="rounded-xl px-6" onClick={() => handleSaveCategory(cat.id)}>
                        حفظ التغييرات
                      </Button>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="p-3 bg-primary/5 rounded-[22px] border border-primary/5 group-hover:bg-primary/10 transition-colors w-14 h-14 flex items-center justify-center shrink-0">
                      <Tag className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 text-right overflow-hidden">
                      <h4 className="font-black text-base text-foreground mb-1 truncate">{cat.name}</h4>
                      <div className="flex items-center justify-start gap-3 opacity-80 mt-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                          <Database className="w-3 h-3 text-primary" />
                          <span>التخزين: {cat.capacity || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground border-r pr-3">
                          <Clock className="w-3 h-3 text-primary" />
                          <span>الصلاحية: {cat.validity || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0 flex flex-col items-end">
                      <p className="font-black text-primary text-base leading-tight">
                        {Number(cat.price || 0).toLocaleString('en-US')} <span className="text-[10px] font-bold text-muted-foreground">ر.ي</span>
                      </p>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full mt-1.5 inline-block border border-emerald-500/20">
                        متاح: {catAvailable}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 border-r pr-3 mr-1">
                      <button onClick={() => handleEditCategory(cat)} className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[32px]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-center font-black">تأكيد حذف الفئة</AlertDialogTitle>
                            <AlertDialogDescription className="text-center pt-2">
                              هل أنت متأكد من حذف فئة &quot;{cat.name}&quot;؟ لن يتم حذف الكروت المرتبطة بها تلقائياً.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                            <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold">
                              تأكيد الحذف
                            </AlertDialogAction>
                            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {isAddingCategory && (
            <Card className="rounded-[28px] border-2 border-dashed border-primary/20 bg-primary/5 overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="text-center pb-2">
                  <h4 className="font-black text-primary">إضافة فئة جديدة</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-muted-foreground mr-1">الاسم</Label>
                    <Input placeholder="باقة 10GB" value={newCategory.name} onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-muted-foreground mr-1">السعر</Label>
                    <Input type="number" placeholder="2000" value={newCategory.price} onChange={(e) => setNewCategory((p) => ({ ...p, price: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-muted-foreground mr-1">السعة</Label>
                    <Input placeholder="10 GB" value={newCategory.capacity} onChange={(e) => setNewCategory((p) => ({ ...p, capacity: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-muted-foreground mr-1">الصلاحية</Label>
                    <Select onValueChange={(value) => setNewCategory((p) => ({ ...p, validity: value }))} value={newCategory.validity}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {validityOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={() => setIsAddingCategory(false)}>
                    إلغاء
                  </Button>
                  <Button size="sm" className="rounded-xl px-6" onClick={handleAddCategory}>
                    إضافة الفئة
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isAddingCategory && (
            <Button
              variant="outline"
              className="w-full h-14 rounded-[28px] border-2 border-dashed border-primary/20 bg-card hover:bg-primary/5 text-primary font-black gap-2 transition-all"
              onClick={() => setIsAddingCategory(true)}
            >
              <PlusCircle className="h-5 w-5" />
              إضافة فئة كروت جديدة
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderCardsManagement = () => {
    if (isLoadingCards || isLoadingCategories) return <Skeleton className="h-48 w-full rounded-[32px]" />;

    const filteredCards = selectedCategoryForView ? cardsByCategory[selectedCategoryForView] || [] : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Select value={selectedCategoryForView} onValueChange={setSelectedCategoryForView}>
              <SelectTrigger className="h-12 rounded-2xl bg-card border-none shadow-sm font-black text-xs">
                <SelectValue placeholder="اختر الفئة لعرض كروتها..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name} ({(cardsByCategory[cat.id] || []).filter((c) => c.status === 'available').length} متاح)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => handleOpenAddCardDialog(selectedCategoryForView || categories[0]?.id || '')}
            disabled={categories.length === 0}
            className="h-12 px-5 rounded-2xl font-black text-xs gap-2 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            إضافة كروت
          </Button>
        </div>

        {filteredCards.length === 0 ? (
          <Card className="rounded-[28px] border border-dashed p-10 text-center bg-card/60">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs font-black text-muted-foreground">لا توجد كروت مضافة لهذه الفئة حالياً.</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filteredCards.map((card) => (
              <Card key={card.id} className="rounded-2xl border-none shadow-sm bg-card">
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'p-2.5 rounded-xl shrink-0',
                        card.status === 'available' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {card.status === 'available' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div className="text-right min-w-0">
                      <p className="font-mono font-black text-sm tracking-wider truncate" dir="ltr">
                        {card.cardNumber}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-black mt-1',
                          card.status === 'available'
                            ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                            : 'border-muted-foreground/30 text-muted-foreground'
                        )}
                      >
                        {card.status === 'available' ? 'متاح للبيع' : 'مباع'}
                      </Badge>
                    </div>
                  </div>

                  {card.status === 'available' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEditCardClick(card)} className="h-8 w-8 rounded-xl bg-primary/10 text-primary">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setCardToDelete(card)} className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
        <SimpleHeader title={localNetDoc?.name || localNetDoc?.networkName || 'إدارة الشبكة'} />
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-5">
          {/* Mesh Gradient Hero Header matching Owner Design */}
          <Card className="border-none shadow-xl rounded-[32px] bg-mesh-gradient text-white overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                    <Wifi className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">{localNetDoc?.name || localNetDoc?.networkName || 'الشبكة المحلية'}</h2>
                    <p className="text-[11px] font-bold text-white/80">
                      {localNetDoc?.location || localNetDoc?.city || localNetDoc?.neighborhood || 'إدارة الفئات والمخزون'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10">
                  <p className="text-[10px] font-bold text-white/80">الفئات</p>
                  <p className="text-lg font-black mt-0.5">{categories.length}</p>
                </div>
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10">
                  <p className="text-[10px] font-bold text-white/80">كروت متاحة</p>
                  <p className="text-lg font-black mt-0.5">{availableCardsCount}</p>
                </div>
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10">
                  <p className="text-[10px] font-bold text-white/80">كروت مباعة</p>
                  <p className="text-lg font-black mt-0.5">{soldCardsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="categories" className="w-full" dir="rtl">
            <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-card p-1 shadow-sm">
              <TabsTrigger value="categories" className="rounded-xl font-black text-xs">
                فئات الكروت
              </TabsTrigger>
              <TabsTrigger value="cards" className="rounded-xl font-black text-xs">
                إدارة الكروت
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-4">
              {renderCategories()}
            </TabsContent>
            <TabsContent value="cards" className="mt-4">
              {renderCardsManagement()}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add Cards Dialog */}
      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="rounded-[32px] max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-center font-black">إضافة كروت جديدة</DialogTitle>
            <DialogDescription className="text-center text-xs">أضف كرتاً واحداً أو مجموعة كروت دفعة واحدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-black">الفئة</Label>
              <Select value={selectedCategoryIdForCard} onValueChange={setSelectedCategoryIdForCard}>
                <SelectTrigger className="h-11 rounded-2xl">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.price} ر.ي)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={addCardMode === 'single' ? 'default' : 'outline'}
                className="rounded-xl h-10 font-bold text-xs"
                onClick={() => setAddCardMode('single')}
              >
                كرت واحد
              </Button>
              <Button
                type="button"
                variant={addCardMode === 'bulk' ? 'default' : 'outline'}
                className="rounded-xl h-10 font-bold text-xs"
                onClick={() => setAddCardMode('bulk')}
              >
                مجموعة كروت
              </Button>
            </div>

            {addCardMode === 'single' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-black">رقم الكرت</Label>
                <Input
                  value={singleCard.cardNumber}
                  onChange={(e) => setSingleCard({ cardNumber: e.target.value })}
                  placeholder="أدخل رقم الكرت..."
                  className="h-11 rounded-2xl font-mono"
                  dir="ltr"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-black">أرقام الكروت (كل كرت في سطر)</Label>
                <Textarea
                  value={bulkCards}
                  onChange={(e) => setBulkCards(e.target.value)}
                  placeholder={'123456789\n987654321'}
                  rows={6}
                  className="rounded-2xl font-mono"
                  dir="ltr"
                />
              </div>
            )}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:space-x-0">
            <Button variant="outline" className="rounded-2xl h-11 font-bold" onClick={() => setIsAddCardOpen(false)}>
              إلغاء
            </Button>
            <Button className="rounded-2xl h-11 font-black" onClick={handleSaveCards} disabled={isProcessingCards}>
              {isProcessingCards ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ الكروت'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="rounded-[32px] max-w-sm p-6">
          <DialogHeader>
            <DialogTitle className="text-center font-black">تعديل رقم الكرت</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={editingCardNumber}
              onChange={(e) => setEditingCardNumber(e.target.value)}
              className="h-11 rounded-2xl font-mono text-center"
              dir="ltr"
            />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:space-x-0">
            <Button variant="outline" className="rounded-2xl h-11 font-bold" onClick={() => setEditingCard(null)}>
              إلغاء
            </Button>
            <Button className="rounded-2xl h-11 font-black" onClick={handleSaveCard}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Card Confirmation */}
      <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
        <AlertDialogContent className="rounded-[32px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">تأكيد حذف الكرت</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              هل أنت متأكد من حذف الكرت رقم {cardToDelete?.cardNumber}؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0">
            <AlertDialogCancel className="rounded-2xl h-11 mt-0">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} className="rounded-2xl h-11 bg-destructive hover:bg-destructive/90 font-bold">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </>
  );
}
