'use client';

import React, { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Edit, Save, X, Wifi, MapPin, Phone, Search, Settings } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
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
} from "@/components/ui/alert-dialog";


type Network = {
  id: string;
  name: string;
  location: string;
  phoneNumber?: string;
};

export default function NetworksManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const networksCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'networks') : null),
    [firestore]
  );
  const { data: networks, isLoading } = useCollection<Network>(networksCollection);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const initialNewNetworkState = { name: '', location: '', phoneNumber: '' };
  const [newNetwork, setNewNetwork] = useState(initialNewNetworkState);
  
  const [editingValues, setEditingValues] = useState<{ [key: string]: { name: string; location: string; phoneNumber: string } }>({});
  
  const filteredNetworks = useMemo(() => {
    if (!networks) return [];
    return networks.filter(net => net.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [networks, searchTerm]);

  const handleEdit = (network: Network) => {
    setEditingId(network.id);
    setEditingValues({
      ...editingValues,
      [network.id]: { name: network.name, location: network.location, phoneNumber: network.phoneNumber || '' },
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = (id: string) => {
    if (!firestore || !editingValues[id].name || !editingValues[id].location) {
        toast({ title: 'خطأ', description: 'الرجاء تعبئة اسم وموقع الشبكة.', variant: 'destructive'});
        return;
    };
    const docRef = doc(firestore, 'networks', id);
    updateDocumentNonBlocking(docRef, editingValues[id]);
    setEditingId(null);
    toast({ title: "تم الحفظ", description: "تم تحديث بيانات الشبكة بنجاح." });
  };
  
  const handleValueChange = (id: string, field: 'name' | 'location' | 'phoneNumber', value: string) => {
    setEditingValues(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'networks', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "تم الحذف", description: "تم حذف الشبكة بنجاح.", variant: "destructive" });
  };
  
  const handleAddNew = () => {
    if (newNetwork.name && newNetwork.location && firestore && networksCollection) {
      addDocumentNonBlocking(networksCollection, newNetwork);
      setNewNetwork(initialNewNetworkState);
      setIsAdding(false);
      toast({ title: "تمت الإضافة", description: "تمت إضافة شبكة جديدة بنجاح." });
    } else {
        toast({ title: "خطأ", description: "الرجاء تعبئة اسم وموقع الشبكة على الأقل.", variant: "destructive" });
    }
  };

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="إدارة الشبكات" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث باسم الشبكة..."
              className="w-full pr-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-center'>الشبكات المضافة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                </div>
            ) : filteredNetworks.length === 0 && !isAdding ? (
               <p className="text-center text-muted-foreground py-8">لا توجد شبكات مضافة. ابدأ بإضافة شبكة جديدة.</p>
            ) : (
                filteredNetworks?.map((network) => (
                <Card key={network.id} className="p-4">
                    {editingId === network.id ? (
                    <div className="space-y-4">
                        <Label htmlFor={`name-${network.id}`}>اسم الشبكة</Label>
                        <Input id={`name-${network.id}`} value={editingValues[network.id]?.name ?? ''} onChange={(e) => handleValueChange(network.id, 'name', e.target.value)} />
                        <Label htmlFor={`location-${network.id}`}>الموقع</Label>
                        <Input id={`location-${network.id}`} value={editingValues[network.id]?.location ?? ''} onChange={(e) => handleValueChange(network.id, 'location', e.target.value)} />
                        <Label htmlFor={`phone-${network.id}`}>رقم التواصل</Label>
                        <Input id={`phone-${network.id}`} value={editingValues[network.id]?.phoneNumber ?? ''} onChange={(e) => handleValueChange(network.id, 'phoneNumber', e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X className="h-4 w-4" /></Button>
                            <Button size="icon" onClick={() => handleSave(network.id)}><Save className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    ) : (
                    <div>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className='p-2 bg-primary/10 rounded-full'>
                               <Wifi className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">{network.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3"/>{network.location}</p>
                                {network.phoneNumber && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/>{network.phoneNumber}</p>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleEdit(network)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        هل أنت متأكد من رغبتك في حذف شبكة "{network.name}"؟ سيتم حذف جميع الفئات والكروت المتعلقة بها.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(network.id)}>
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        <div className="mt-4">
                           <Link href={`/networks-management/${network.id}`}>
                                <Button variant="secondary" className="w-full">
                                    <Settings className="ml-2 h-4 w-4" />
                                    إدارة الفئات والكروت
                                </Button>
                            </Link>
                        </div>
                    </div>
                    )}
                </Card>
                ))
            )}

            {isAdding && (
              <Card className="p-4 bg-muted/50">
                 <div className="space-y-4">
                    <Label htmlFor="new-name" className='flex items-center gap-2'><Wifi className='w-4 h-4' /> اسم الشبكة</Label>
                    <Input id="new-name" value={newNetwork.name} onChange={(e) => setNewNetwork(p=>({...p, name: e.target.value}))} placeholder="مثال: شبكة باشادي" />
                    
                    <Label htmlFor="new-location" className='flex items-center gap-2'><MapPin className='w-4 h-4' /> الموقع</Label>
                    <Input id="new-location" value={newNetwork.location} onChange={(e) => setNewNetwork(p=>({...p, location: e.target.value}))} placeholder="مثال: سيئون - الغرفة" />
                    
                    <Label htmlFor="new-phone" className='flex items-center gap-2'><Phone className='w-4 h-4' /> رقم التواصل (اختياري)</Label>
                    <Input id="new-phone" type="tel" value={newNetwork.phoneNumber} onChange={(e) => setNewNetwork(p=>({...p, phoneNumber: e.target.value}))} placeholder="7xxxxxxxx" />
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                      <Button onClick={handleAddNew}>إضافة الشبكة</Button>
                    </div>
                  </div>
              </Card>
            )}
          </CardContent>
        </Card>
        
        {!isAdding && (
            <Button className="w-full" onClick={() => setIsAdding(true)}>
            <PlusCircle className="ml-2 h-4 w-4" />
            إضافة شبكة جديدة
            </Button>
        )}
      </div>
    </div>
    <Toaster />
    </>
  );
}