'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Edit, Save, X, Package, DollarSign, Image as ImageIcon } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
};

const getSafeImageUrl = (url: string) => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return 'https://picsum.photos/seed/product/400/400';
  }
  return url;
};

export default function StoreManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const productsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading } = useCollection<Product>(productsCollection);

  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', imageUrl: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const handleAdd = () => {
    if (!newProduct.name || !newProduct.price || !newProduct.imageUrl || !firestore) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى إكمال البيانات الأساسية.' });
      return;
    }
    addDocumentNonBlocking(productsCollection!, {
      ...newProduct,
      price: Number(newProduct.price)
    });
    setNewProduct({ name: '', description: '', price: '', imageUrl: '' });
    setIsAdding(false);
    toast({ title: 'نجاح', description: 'تمت إضافة المنتج بنجاح.' });
  };

  const handleUpdate = (id: string) => {
    const docRef = doc(firestore!, 'products', id);
    updateDocumentNonBlocking(docRef, {
      ...editValues,
      price: Number(editValues.price)
    });
    setEditingId(null);
    toast({ title: 'نجاح', description: 'تم تحديث المنتج.' });
  };

  const handleDelete = (id: string) => {
    const docRef = doc(firestore!, 'products', id);
    deleteDocumentNonBlocking(docRef);
    toast({ variant: 'destructive', title: 'حذف', description: 'تم حذف المنتج.' });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="إدارة المتجر" />
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        
        {!isAdding && (
          <Button className="w-full" onClick={() => setIsAdding(true)}>
            <PlusCircle className="ml-2 h-4 w-4" /> إضافة منتج جديد
          </Button>
        )}

        {isAdding && (
          <Card className="animate-in fade-in-0 slide-in-from-top-2">
            <CardHeader><CardTitle className="text-sm">منتج جديد</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="اسم المنتج" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <Textarea placeholder="الوصف" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <Input type="number" placeholder="السعر" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              <Input placeholder="رابط الصورة" value={newProduct.imageUrl} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} />
              <div className="flex gap-2">
                <Button onClick={handleAdd} className="flex-1">حفظ</Button>
                <Button variant="outline" onClick={() => setIsAdding(false)}>إلغاء</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {isLoading ? <Skeleton className="h-40 w-full" /> : products?.map(product => (
            <Card key={product.id}>
              <CardContent className="p-4 flex gap-4">
                <div className="relative h-20 w-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                  <Image 
                    src={getSafeImageUrl(product.imageUrl)} 
                    alt={product.name} 
                    fill 
                    className="object-cover" 
                    data-ai-hint="product image"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  {editingId === product.id ? (
                    <div className="space-y-2">
                      <Input size="sm" value={editValues.name} onChange={e => setEditValues({...editValues, name: e.target.value})} />
                      <Input size="sm" type="number" value={editValues.price} onChange={e => setEditValues({...editValues, price: e.target.value})} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdate(product.id)}><Save className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-bold text-sm">{product.name}</p>
                      <p className="text-primary font-bold">{product.price.toLocaleString()} ريال</p>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingId(product.id);
                          setEditValues(product);
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(product.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Toaster />
    </div>
  );
}