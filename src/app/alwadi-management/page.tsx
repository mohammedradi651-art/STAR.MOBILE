'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Edit, Save, X } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

type RenewalOption = {
  id: string;
  title: string;
  price: number;
};

export default function AlwadiManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const optionsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'alwadiOptions') : null),
    [firestore]
  );
  const { data: options, isLoading } = useCollection<RenewalOption>(optionsCollection);
  
  const sortedOptions = React.useMemo(() => {
    if (!options) return [];
    return [...options].sort((a, b) => a.price - b.price);
  }, [options]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const [editingValues, setEditingValues] = useState<{ [key: string]: { title: string; price: string } }>({});

  const handleEdit = (option: RenewalOption) => {
    setEditingId(option.id);
    setEditingValues({
      ...editingValues,
      [option.id]: { title: option.title, price: String(option.price) },
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'alwadiOptions', id);
    const editedData = {
        title: editingValues[id].title,
        price: Number(editingValues[id].price) || 0
    };
    updateDocumentNonBlocking(docRef, editedData);
    setEditingId(null);
    toast({ title: "تم الحفظ", description: "تم تحديث خيار التجديد بنجاح." });
  };
  
  const handleValueChange = (id: string, field: 'title' | 'price', value: string) => {
    setEditingValues(prev => ({
        ...prev,
        [id]: {
            ...prev[id],
            [field]: value,
        }
    }));
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'alwadiOptions', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "تم الحذف", description: "تم حذف خيار التجديد بنجاح.", variant: "destructive" });
  };
  
  const handleAddNew = () => {
    if (newTitle && newPrice && firestore && optionsCollection) {
      const newOption = {
        title: newTitle,
        price: Number(newPrice),
      };
      addDocumentNonBlocking(optionsCollection, newOption);
      setNewTitle('');
      setNewPrice('');
      setIsAdding(false);
      toast({ title: "تمت الإضافة", description: "تمت إضافة خيار جديد بنجاح." });
    } else {
        toast({ title: "خطأ", description: "الرجاء تعبئة جميع الحقول.", variant: "destructive" });
    }
  };

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="إدارة منظومة الوادي" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className='text-center'>خيارات التجديد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                </div>
            ) : (
                sortedOptions.map((option) => (
                <Card key={option.id} className="p-4">
                    {editingId === option.id ? (
                    <div className="space-y-4">
                        <div>
                        <Label htmlFor={`title-${option.id}`}>اسم الخيار</Label>
                        <Input
                            id={`title-${option.id}`}
                            value={editingValues[option.id]?.title ?? option.title}
                            onChange={(e) => handleValueChange(option.id, 'title', e.target.value)}
                        />
                        </div>
                        <div>
                        <Label htmlFor={`price-${option.id}`}>السعر</Label>
                        <Input
                            id={`price-${option.id}`}
                            type="number"
                            value={editingValues[option.id]?.price ?? option.price}
                            onChange={(e) => handleValueChange(option.id, 'price', e.target.value)}
                        />
                        </div>
                        <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                        </Button>
                        <Button size="icon" onClick={() => handleSave(option.id)}>
                            <Save className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>
                    ) : (
                    <div className="flex items-center justify-between">
                        <div>
                        <p className="font-semibold">{option.title}</p>
                        <p className="text-sm text-primary dark:text-primary-foreground">{option.price.toLocaleString('en-US')} ريال</p>
                        </div>
                        <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEdit(option)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(option.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>
                    )}
                </Card>
                ))
            )}
             {isAdding && (
              <Card className="p-4 bg-muted/50">
                 <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-title">اسم الخيار الجديد</Label>
                      <Input
                        id="new-title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="مثال: تجديد 3 شهور"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-price">السعر</Label>
                      <Input
                        id="new-price"
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        placeholder="مثال: 4500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleAddNew}>
                        إضافة
                      </Button>
                    </div>
                  </div>
              </Card>
            )}
          </CardContent>
        </Card>
        
        {!isAdding && (
            <Button className="w-full" onClick={() => setIsAdding(true)}>
            <PlusCircle className="ml-2 h-4 w-4" />
            إضافة خيار جديد
            </Button>
        )}
      </div>
    </div>
    <Toaster />
    </>
  );
}
