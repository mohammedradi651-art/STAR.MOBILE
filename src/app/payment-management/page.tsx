'use client';

import React, { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Edit, Save, X, Image as ImageIcon, Banknote, User } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

type PaymentMethod = {
  id: string;
  name: string;
  accountHolderName: string;
  accountNumber: string;
  logoUrl?: string;
};

const getLogoSrc = (url?: string) => {
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      return url;
    }
    return 'https://placehold.co/100x100/e2e8f0/e2e8f0'; 
};

export default function PaymentManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const methodsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'paymentMethods') : null),
    [firestore]
  );
  const { data: paymentMethods, isLoading } = useCollection<PaymentMethod>(methodsCollection);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const initialNewMethodState = { name: '', accountHolderName: '', accountNumber: '', logoUrl: '' };
  const [newMethod, setNewMethod] = useState(initialNewMethodState);

  const [editingValues, setEditingValues] = useState<{ [key: string]: { name: string; accountHolderName: string; accountNumber: string; logoUrl: string } }>({});

  const handleEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setEditingValues({
      ...editingValues,
      [method.id]: { name: method.name, accountHolderName: method.accountHolderName, accountNumber: method.accountNumber, logoUrl: method.logoUrl || '' },
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };
  
  const handleSave = (id: string) => {
    if (!firestore) return;
    const editedData = editingValues[id];

    if (!editedData.name || !editedData.accountHolderName || !editedData.accountNumber) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "الرجاء تعبئة جميع الحقول المطلوبة.",
      });
      return;
    }

    const docRef = doc(firestore, 'paymentMethods', id);
    updateDocumentNonBlocking(docRef, editedData);
    setEditingId(null);
    toast({ title: "تم الحفظ", description: "تم تحديث طريقة الدفع بنجاح." });
  };
  
  const handleValueChange = (id: string, field: 'name' | 'accountHolderName' | 'accountNumber' | 'logoUrl', value: string) => {
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
    const docRef = doc(firestore, 'paymentMethods', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "تم الحذف", description: "تم حذف طريقة الدفع بنجاح.", variant: "destructive" });
  };
  
  const handleAddNew = () => {
    if (newMethod.name && newMethod.accountNumber && newMethod.accountHolderName && firestore && methodsCollection) {
      addDocumentNonBlocking(methodsCollection, newMethod);
      setNewMethod(initialNewMethodState);
      setIsAdding(false);
      toast({ title: "تمت الإضافة", description: "تمت إضافة طريقة دفع جديدة بنجاح." });
    } else {
        toast({ title: "خطأ", description: "الرجاء تعبئة جميع الحقول المطلوبة.", variant: "destructive" });
    }
  };

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="إدارة طرق الدفع" />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className='text-center'>طرق الدفع</CardTitle>
            <CardDescription className='text-center'>إدارة جميع طرق الدفع المتاحة في التطبيق.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                </div>
            ) : paymentMethods && paymentMethods.length > 0 ? (
                paymentMethods.map((method) => (
                <Card key={method.id} className="p-4">
                    {editingId === method.id ? (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor={`name-${method.id}`}>اسم البنك</Label>
                            <Input id={`name-${method.id}`} value={editingValues[method.id]?.name ?? ''} onChange={(e) => handleValueChange(method.id, 'name', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor={`holder-${method.id}`}>اسم صاحب الحساب</Label>
                            <Input id={`holder-${method.id}`} value={editingValues[method.id]?.accountHolderName ?? ''} onChange={(e) => handleValueChange(method.id, 'accountHolderName', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor={`account-${method.id}`}>رقم الحساب</Label>
                            <Input id={`account-${method.id}`} value={editingValues[method.id]?.accountNumber ?? ''} onChange={(e) => handleValueChange(method.id, 'accountNumber', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor={`logo-${method.id}`}>رابط الشعار</Label>
                            <Input id={`logo-${method.id}`} value={editingValues[method.id]?.logoUrl ?? ''} onChange={(e) => handleValueChange(method.id, 'logoUrl', e.target.value)} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X className="h-4 w-4" /></Button>
                            <Button size="icon" onClick={() => handleSave(method.id)}><Save className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <Image src={getLogoSrc(method.logoUrl)} alt={method.name} width={40} height={40} className="rounded-full object-contain bg-muted" />
                          <div className='text-right'>
                            <p className="font-semibold">{method.name}</p>
                            <p className="text-sm text-muted-foreground">{method.accountHolderName}</p>
                            <p className="text-sm font-mono tracking-wider text-primary dark:text-primary-foreground">{method.accountNumber}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleEdit(method)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDelete(method.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    )}
                </Card>
                ))
            ) : (
                <p className='text-center text-muted-foreground py-4'>لم يتم إضافة طرق دفع.</p>
            )}

             {isAdding && (
              <Card className="p-4 bg-muted/50">
                 <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-name" className='flex items-center gap-2'><Banknote className='w-4 h-4' /> اسم البنك</Label>
                      <Input id="new-name" value={newMethod.name} onChange={(e) => setNewMethod(p=>({...p, name: e.target.value}))} placeholder="مثال: بنك الأمل" />
                    </div>
                    <div>
                      <Label htmlFor="new-holder-name" className='flex items-center gap-2'><User className='w-4 h-4' /> اسم صاحب الحساب</Label>
                      <Input id="new-holder-name" value={newMethod.accountHolderName} onChange={(e) => setNewMethod(p=>({...p, accountHolderName: e.target.value}))} placeholder="مثال: محمد راضي باشادي" />
                    </div>
                    <div>
                      <Label htmlFor="new-account" className='flex items-center gap-2'><Banknote className='w-4 h-4' /> رقم الحساب</Label>
                      <Input id="new-account" type="text" value={newMethod.accountNumber} onChange={(e) => setNewMethod(p=>({...p, accountNumber: e.target.value}))} placeholder="مثال: 123456789" />
                    </div>
                     <div>
                      <Label htmlFor="new-logo" className='flex items-center gap-2'><ImageIcon className='w-4 h-4' /> رابط شعار البنك (اختياري)</Label>
                      <Input id="new-logo" type="text" value={newMethod.logoUrl} onChange={(e) => setNewMethod(p=>({...p, logoUrl: e.target.value}))} placeholder="https://example.com/logo.png" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                      <Button onClick={handleAddNew}>إضافة</Button>
                    </div>
                  </div>
              </Card>
            )}

             {!isAdding && (
                <Button className="w-full mt-4" onClick={() => setIsAdding(true)}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة طريقة دفع جديدة
                </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    <Toaster />
    </>
  );
}
