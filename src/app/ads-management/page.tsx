'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Edit, Save, X, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

type Advertisement = {
  id: string;
  imageUrl: string;
  linkUrl?: string;
};

export default function AdsManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const adsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'advertisements') : null),
    [firestore]
  );
  const { data: ads, isLoading } = useCollection<Advertisement>(adsCollection);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newAd, setNewAd] = useState({ imageUrl: '', linkUrl: '' });
  const [editingValues, setEditingValues] = useState<{ [key: string]: { imageUrl: string; linkUrl: string } }>({});
  
  const handleEdit = (ad: Advertisement) => {
    setEditingId(ad.id);
    setEditingValues({
      ...editingValues,
      [ad.id]: { imageUrl: ad.imageUrl, linkUrl: ad.linkUrl || '' },
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'advertisements', id);
    const editedData = {
        imageUrl: editingValues[id].imageUrl,
        linkUrl: editingValues[id].linkUrl
    };
    updateDocumentNonBlocking(docRef, editedData);
    setEditingId(null);
    toast({ title: "تم الحفظ", description: "تم تحديث الإعلان بنجاح." });
  };
  
  const handleValueChange = (id: string, field: 'imageUrl' | 'linkUrl', value: string) => {
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
    const docRef = doc(firestore, 'advertisements', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "تم الحذف", description: "تم حذف الإعلان بنجاح.", variant: "destructive" });
  };
  
  const handleAddNew = () => {
    if (newAd.imageUrl && firestore && adsCollection) {
      addDocumentNonBlocking(adsCollection, newAd);
      setNewAd({ imageUrl: '', linkUrl: '' });
      setIsAdding(false);
      toast({ title: "تمت الإضافة", description: "تمت إضافة إعلان جديد بنجاح." });
    } else if (!newAd.imageUrl) {
        toast({ title: "خطأ", description: "الرجاء تعبئة رابط الصورة على الأقل.", variant: "destructive" });
    }
  };

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="إدارة الإعلانات" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className='text-center'>الإعلانات الحالية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                </div>
            ) : (!ads || ads.length === 0) && !isAdding ? (
              <p className="text-center text-muted-foreground py-8">لا توجد إعلانات لعرضها. ابدأ بإضافة إعلان جديد.</p>
            ) : (
                ads?.map((ad) => (
                <Card key={ad.id} className="p-4">
                    {editingId === ad.id ? (
                    <div className="space-y-4">
                        <div>
                        <Label htmlFor={`imageUrl-${ad.id}`} className="flex items-center gap-2 mb-1"><ImageIcon className="w-4 h-4"/> رابط الصورة</Label>
                        <Input
                            id={`imageUrl-${ad.id}`}
                            value={editingValues[ad.id]?.imageUrl}
                            onChange={(e) => handleValueChange(ad.id, 'imageUrl', e.target.value)}
                        />
                        </div>
                        <div>
                        <Label htmlFor={`linkUrl-${ad.id}`} className="flex items-center gap-2 mb-1"><LinkIcon className="w-4 h-4"/> رابط الانتقال (اختياري)</Label>
                        <Input
                            id={`linkUrl-${ad.id}`}
                            value={editingValues[ad.id]?.linkUrl}
                            onChange={(e) => handleValueChange(ad.id, 'linkUrl', e.target.value)}
                        />
                        </div>
                        <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                        </Button>
                        <Button size="icon" onClick={() => handleSave(id)}>
                            <Save className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>
                    ) : (
                    <div className="flex flex-col gap-4">
                        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg border">
                           <Image src={ad.imageUrl} alt="معاينة الإعلان" fill className="object-cover" />
                        </div>
                        <div className='flex justify-between items-center'>
                             <div className='text-xs text-muted-foreground truncate'>
                                <p>رابط الصورة: {ad.imageUrl}</p>
                                <p>رابط الانتقال: {ad.linkUrl || 'لا يوجد'}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleEdit(ad)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" onClick={() => handleDelete(ad.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
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
                      <Label htmlFor="new-imageUrl" className="flex items-center gap-2 mb-1"><ImageIcon className="w-4 h-4"/> رابط الصورة</Label>
                      <Input
                        id="new-imageUrl"
                        value={newAd.imageUrl}
                        onChange={(e) => setNewAd(prev => ({...prev, imageUrl: e.target.value}))}
                        placeholder="https://example.com/image.png"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-linkUrl" className="flex items-center gap-2 mb-1"><LinkIcon className="w-4 h-4"/> رابط الانتقال (اختياري)</Label>
                      <Input
                        id="new-linkUrl"
                        value={newAd.linkUrl}
                        onChange={(e) => setNewAd(prev => ({...prev, linkUrl: e.target.value}))}
                        placeholder="/top-up"
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
                إضافة إعلان جديد
            </Button>
        )}

      </div>
    </div>
    <Toaster />
    </>
  );
}
