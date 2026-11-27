'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Edit, Save, X, Wifi, MapPin, Phone, Search, Settings, ChevronLeft } from 'lucide-react';
import { useFirestore, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDocs, setDoc, collectionGroup, serverTimestamp } from 'firebase/firestore';
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
} from '@/components/ui/alert-dialog';

type Network = {
  id: string;
  name: string;
  location: string;
  phoneNumber?: string;
  categoriesCount?: number;
};

export default function NetworksManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [networks, setNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    const fetchNetworks = async () => {
      try {
        const netSnap = await getDocs(collectionGroup(firestore, 'local_networks'));
        const list: Network[] = [];
        for (const d of netSnap.docs) {
          const data = d.data();
          const ownerId = d.ref.parent.parent ? d.ref.parent.parent.id : data.ownerUid || d.id;
          list.push({
            id: ownerId,
            name: data.name || data.networkName || 'شبكة محلية',
            location: data.location || data.neighborhood || data.city || 'حضرموت',
            phoneNumber: data.ownerPhone || '',
            categoriesCount: Array.isArray(data.categories) ? data.categories.length : 0,
          });
        }
        setNetworks(list);
      } catch (e) {
        console.error('Error fetching networks:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNetworks();
  }, [firestore]);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const initialNewNetworkState = { name: '', location: '', phoneNumber: '' };
  const [newNetwork, setNewNetwork] = useState(initialNewNetworkState);

  const [editingValues, setEditingValues] = useState<{ [key: string]: { name: string; location: string; phoneNumber: string } }>({});

  const filteredNetworks = useMemo(() => {
    if (!networks) return [];
    return networks.filter((net) => net.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [networks, searchTerm]);

  const handleEdit = (network: Network) => {
    setEditingId(network.id);
    setEditingValues({
      ...editingValues,
      [network.id]: { name: network.name, location: network.location, phoneNumber: network.phoneNumber || '' },
    });
  };

  const handleSave = async (id: string) => {
    if (!firestore || !editingValues[id]?.name || !editingValues[id]?.location) {
      toast({ title: 'خطأ', description: 'الرجاء تعبئة اسم وموقع الشبكة.', variant: 'destructive' });
      return;
    }
    const localRef = doc(firestore, `users/${id}/local_networks`, id);
    await updateDocumentNonBlocking(localRef, {
      name: editingValues[id].name,
      networkName: editingValues[id].name,
      location: editingValues[id].location,
      neighborhood: editingValues[id].location,
      ownerPhone: editingValues[id].phoneNumber,
    });
    setEditingId(null);
    setNetworks((prev) => prev.map((n) => (n.id === id ? { ...n, ...editingValues[id] } : n)));
    toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات الشبكة بنجاح.' });
  };

  const handleValueChange = (id: string, field: 'name' | 'location' | 'phoneNumber', value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    const localRef = doc(firestore, `users/${id}/local_networks`, id);
    await deleteDocumentNonBlocking(localRef);
    setNetworks((prev) => prev.filter((n) => n.id !== id));
    toast({ title: 'تم الحذف', description: 'تم حذف الشبكة بنجاح.', variant: 'destructive' });
  };

  const handleAddNew = async () => {
    if (!newNetwork.name.trim() || !newNetwork.location.trim() || !firestore) {
      toast({ title: 'خطأ', description: 'الرجاء تعبئة اسم وموقع الشبكة على الأقل.', variant: 'destructive' });
      return;
    }
    try {
      const newNetId = `net_${Date.now()}`;
      const localRef = doc(firestore, `users/${newNetId}/local_networks`, newNetId);
      await setDoc(localRef, {
        name: newNetwork.name.trim(),
        networkName: newNetwork.name.trim(),
        location: newNetwork.location.trim(),
        neighborhood: newNetwork.location.trim(),
        ownerPhone: newNetwork.phoneNumber.trim(),
        ownerUid: newNetId,
        categories: [],
        createdAt: serverTimestamp(),
      });
      setNetworks((prev) => [
        {
          id: newNetId,
          name: newNetwork.name.trim(),
          location: newNetwork.location.trim(),
          phoneNumber: newNetwork.phoneNumber.trim(),
          categoriesCount: 0,
        },
        ...prev,
      ]);
      setNewNetwork(initialNewNetworkState);
      setIsAdding(false);
      toast({ title: 'تمت الإضافة', description: 'تمت إضافة شبكة جديدة بنجاح.' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل إضافة الشبكة: ' + e.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
        <SimpleHeader title="إدارة الشبكات" />
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-5">
          {/* Mesh Gradient Hero Card matching Owner Design */}
          <Card className="border-none shadow-xl rounded-[32px] bg-mesh-gradient text-white overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                  <Wifi className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black">الشبكات المحلية</h2>
                  <p className="text-[11px] font-bold text-white/80">إدارة شاملة للفئات والكروت لجميع الشبكات</p>
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-center">
                <p className="text-[9px] font-bold text-white/80">إجمالي الشبكات</p>
                <p className="text-lg font-black">{networks.length}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="البحث باسم الشبكة..."
                className="w-full pr-10 h-12 rounded-2xl bg-card border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsAdding(!isAdding)} className="h-12 px-4 rounded-2xl font-black text-xs gap-1.5 shadow-sm">
              <PlusCircle className="h-4 w-4" />
              <span>{isAdding ? 'إلغاء' : 'شبكة جديدة'}</span>
            </Button>
          </div>

          {isAdding && (
            <Card className="rounded-[28px] border-2 border-dashed border-primary/20 bg-primary/5">
              <CardContent className="p-5 space-y-3">
                <h4 className="font-black text-sm text-primary text-center">إضافة شبكة محلية جديدة</h4>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground">اسم الشبكة</Label>
                  <Input
                    value={newNetwork.name}
                    onChange={(e) => setNewNetwork((p) => ({ ...p, name: e.target.value }))}
                    placeholder="مثال: شبكة النور"
                    className="h-11 rounded-xl bg-card"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-muted-foreground">الموقع / الحي</Label>
                    <Input
                      value={newNetwork.location}
                      onChange={(e) => setNewNetwork((p) => ({ ...p, location: e.target.value }))}
                      placeholder="المكلا - الديس"
                      className="h-11 rounded-xl bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-muted-foreground">رقم المالك</Label>
                    <Input
                      value={newNetwork.phoneNumber}
                      onChange={(e) => setNewNetwork((p) => ({ ...p, phoneNumber: e.target.value }))}
                      placeholder="77xxxxxxx"
                      className="h-11 rounded-xl bg-card"
                      dir="ltr"
                    />
                  </div>
                </div>
                <Button onClick={handleAddNew} className="w-full h-11 rounded-2xl font-black">
                  حفظ الشبكة
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-[28px]" />)
            ) : filteredNetworks.length === 0 ? (
              <Card className="rounded-[28px] border border-dashed p-10 text-center bg-card/60">
                <Wifi className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs font-black text-muted-foreground">لا توجد شبكات مطابقة.</p>
              </Card>
            ) : (
              filteredNetworks.map((network) => (
                <Card key={network.id} className="rounded-[28px] border-none shadow-sm bg-card overflow-hidden">
                  <CardContent className="p-5">
                    {editingId === network.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editingValues[network.id]?.name || ''}
                          onChange={(e) => handleValueChange(network.id, 'name', e.target.value)}
                          placeholder="اسم الشبكة"
                          className="h-10 rounded-xl"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editingValues[network.id]?.location || ''}
                            onChange={(e) => handleValueChange(network.id, 'location', e.target.value)}
                            placeholder="الموقع"
                            className="h-10 rounded-xl"
                          />
                          <Input
                            value={editingValues[network.id]?.phoneNumber || ''}
                            onChange={(e) => handleValueChange(network.id, 'phoneNumber', e.target.value)}
                            placeholder="رقم المالك"
                            className="h-10 rounded-xl"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4 ml-1" /> إلغاء
                          </Button>
                          <Button size="sm" className="rounded-xl" onClick={() => handleSave(network.id)}>
                            <Save className="h-4 w-4 ml-1" /> حفظ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-primary/10 rounded-[20px] text-primary shrink-0">
                            <Wifi className="h-6 w-6" />
                          </div>
                          <div className="text-right min-w-0">
                            <h3 className="font-black text-base text-foreground truncate">{network.name}</h3>
                            <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-primary" />
                                {network.location}
                              </span>
                              {network.phoneNumber && (
                                <span className="flex items-center gap-1 font-mono" dir="ltr">
                                  <Phone className="h-3 w-3 text-primary" />
                                  {network.phoneNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Link href={`/networks-management/${network.id}`}>
                            <Button size="sm" className="h-9 px-3 rounded-xl font-black text-xs gap-1 shadow-xs">
                              <Settings className="h-3.5 w-3.5" />
                              <span>إدارة</span>
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(network)} className="h-9 w-9 rounded-xl bg-muted/50 text-primary">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[32px]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-center font-black">تأكيد حذف الشبكة</AlertDialogTitle>
                                <AlertDialogDescription className="text-center">
                                  هل أنت متأكد من حذف شبكة &quot;{network.name}&quot;؟
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0">
                                <AlertDialogCancel className="rounded-2xl h-11 mt-0">إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(network.id)} className="rounded-2xl h-11 bg-destructive hover:bg-destructive/90 font-bold">
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
}
