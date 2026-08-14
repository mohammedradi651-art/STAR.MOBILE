'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Trash2, 
    Zap, 
    Clock, 
    Search, 
    CheckCircle2,
    Building2,
    CreditCard,
    Smartphone,
    PlusCircle,
    Loader2,
    XCircle,
    User
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = 'force-dynamic';

type BankNotif = {
    id: string;
    bank: 'alomqy' | 'kuraimi' | 'amjad';
    account?: string;
    reference?: string;
    amount: number;
    status: 'unpaid' | 'paid';
    timestamp: string;
    senderName: string;
    paidTo?: string;
    paidAt?: string;
    rawMessage?: string;
};

type UserType = {
    id: string;
    displayName: string;
    phoneNumber: string;
};

export default function DepositManagementPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

    // States for adding manual deposit
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [manualBank, setManualBank] = useState<'alomqy' | 'kuraimi' | 'amjad'>('alomqy');
    const [manualAccount, setManualAccount] = useState('');
    const [manualRef, setManualRef] = useState('');
    const [manualName, setManualName] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Notifications
    const bankQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, 'bankNotifications'), orderBy('timestamp', 'desc')) : null),
        [firestore]
    );
    const { data: notifications, isLoading } = useCollection<BankNotif>(bankQuery);

    // Fetch Users for Amjad Selection
    const usersQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, 'users'), orderBy('displayName')) : null),
        [firestore]
    );
    const { data: usersList } = useCollection<UserType>(usersQuery);

    const filterNotifs = (bank: string) => {
        return notifications?.filter(n => {
            const isBank = n.bank === bank;
            const matchesSearch = (n.senderName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (n.account || '').includes(searchTerm) || 
                                 (n.reference || '').includes(searchTerm) ||
                                 String(n.amount).includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
            return isBank && matchesSearch && matchesStatus;
        }) || [];
    };

    const handleDelete = (id: string) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'bankNotifications', id);
        deleteDocumentNonBlocking(docRef);
        toast({ title: "تم الحذف", description: "تم حذف إشعار الإيداع بنجاح." });
    };

    const handleAddManual = async () => {
        if (!manualAmount || !firestore) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى إدخال المبلغ على الأقل.' });
            return;
        }

        setIsSaving(true);
        const amountNum = parseFloat(manualAmount);

        // تجهيز البيانات الأساسية
        const data: any = {
            bank: manualBank,
            amount: amountNum,
            status: 'unpaid',
            timestamp: new Date().toISOString(),
            rawMessage: 'إضافة يدوية من الإدارة',
            senderName: manualName || 'إيداع يدوي'
        };

        // التحقق حسب نوع البنك
        if (manualBank === 'alomqy') {
            if (!manualAccount) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'رقم الحساب مطلوب للعمقي.' });
                setIsSaving(false);
                return;
            }
            data.account = manualAccount.trim();
        } else if (manualBank === 'kuraimi') {
            if (!manualRef) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'رقم المرجع مطلوب للكريمي.' });
                setIsSaving(false);
                return;
            }
            data.reference = manualRef.trim();
        } else if (manualBank === 'amjad') {
            if (!manualName) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'يجب اختيار العميل لبنك أمجاد.' });
                setIsSaving(false);
                return;
            }
            // في أمجاد، الاسم هو مفتاح المطابقة الأساسي
            data.senderName = manualName;
        }

        try {
            await addDocumentNonBlocking(collection(firestore, 'bankNotifications'), data);
            toast({ title: "نجاح", description: "تم إضافة الإيداع يدوياً بنجاح." });
            setIsAddDialogOpen(false);
            // Reset fields
            setManualAccount(''); setManualRef(''); setManualName(''); setManualAmount('');
        } catch (e) {
            toast({ variant: 'destructive', title: "فشل الحفظ", description: "حدث خطأ أثناء محاولة الحفظ." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950">
            <SimpleHeader title="إدارة الإيداعات البنكية" />
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6 pb-20">
                
                {/* زر إضافة إيداع يدوي */}
                <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="w-full h-14 rounded-3xl bg-mesh-gradient text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-transform border-none"
                >
                    <PlusCircle className="ml-2 h-6 w-6" />
                    إضافة إيداع يدوي
                </Button>

                {/* أدوات البحث والفلترة */}
                <Card className="rounded-[32px] border-none shadow-sm bg-white dark:bg-slate-900 p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="بحث بالاسم، الحساب أو المرجع..." 
                            className="h-11 pr-10 rounded-2xl bg-muted/20 border-none text-sm font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'unpaid', 'paid'].map((s) => (
                            <button 
                                key={s}
                                onClick={() => setStatusFilter(s as any)}
                                className={cn(
                                    "flex-1 h-9 rounded-xl text-[10px] font-black transition-all",
                                    statusFilter === s ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                                )}
                            >
                                {s === 'all' ? 'الكل' : s === 'unpaid' ? 'غير مدفوع' : 'مدفوع'}
                            </button>
                        ))}
                    </div>
                </Card>

                <Tabs defaultValue="alomqy" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 rounded-2xl h-12 p-1 mb-6">
                        <TabsTrigger value="alomqy" className="rounded-xl font-black text-[10px]">العمقي</TabsTrigger>
                        <TabsTrigger value="kuraimi" className="rounded-xl font-black text-[10px]">الكريمي</TabsTrigger>
                        <TabsTrigger value="amjad" className="rounded-xl font-black text-[10px]">أمجاد</TabsTrigger>
                    </TabsList>

                    {['alomqy', 'kuraimi', 'amjad'].map(bank => (
                        <TabsContent key={bank} value={bank} className="space-y-3 mt-0">
                            {isLoading ? (
                                [1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-[28px]" />)
                            ) : filterNotifs(bank).length === 0 ? (
                                <div className="text-center py-20 opacity-30">
                                    <Building2 className="h-16 w-16 mx-auto mb-4" />
                                    <p className="font-black text-sm uppercase">لا توجد إشعارات حالياً</p>
                                </div>
                            ) : (
                                filterNotifs(bank).map(notif => (
                                    <Card key={notif.id} className={cn(
                                        "rounded-[28px] border-none shadow-sm overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2",
                                        notif.status === 'unpaid' ? "bg-white dark:bg-slate-900 border-r-4 border-green-500" : "bg-muted/40 grayscale"
                                    )}>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "p-2.5 rounded-2xl shrink-0",
                                                        notif.status === 'unpaid' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {notif.bank === 'alomqy' ? <Zap className="w-5 h-5" /> : notif.bank === 'kuraimi' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                                                    </div>
                                                    <div className="text-right">
                                                        <h4 className="font-black text-sm text-foreground">{notif.senderName}</h4>
                                                        <p className="text-[10px] font-bold text-muted-foreground">
                                                            {notif.bank === 'alomqy' ? `الحساب: ${notif.account}` : notif.bank === 'kuraimi' ? `المرجع: ${notif.reference}` : `بنك أمجاد - حوالة واردة`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <p className={cn("text-lg font-black", notif.status === 'unpaid' ? "text-green-600" : "text-muted-foreground")}>
                                                        {notif.amount.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                                                    </p>
                                                    <div className="flex items-center justify-end gap-1.5 opacity-40">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        <span className="text-[9px] font-bold">{format(parseISO(notif.timestamp), 'Pp', { locale: ar })}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {notif.rawMessage && (
                                                <div className="bg-muted/30 p-2 rounded-xl text-[9px] text-muted-foreground italic font-bold">
                                                    "{notif.rawMessage}"
                                                </div>
                                            )}

                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted-foreground/10">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 rounded-xl text-destructive hover:bg-destructive/10 text-[10px] font-black">
                                                            <Trash2 className="w-3.5 h-3.5 ml-1.5" />
                                                            حذف
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[32px]">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-center font-black">تأكيد الحذف</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-center">سيتم حذف هذا الإشعار نهائياً من سجلات النظام.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-6">
                                                            <AlertDialogAction onClick={() => handleDelete(notif.id)} className="w-full rounded-2xl h-12 bg-destructive font-bold">تأكيد الحذف</AlertDialogAction>
                                                            <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-black">إلغاء</AlertDialogCancel>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>

            {/* Dialog for adding manual deposit */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl outline-none [&>button]:hidden">
                    <div className="bg-mesh-gradient p-8 text-center text-white relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
                        <DialogHeader>
                            <div className="bg-white/20 p-4 rounded-[28px] w-16 h-16 mx-auto mb-4 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                                <PlusCircle className="h-8 w-8 text-white" />
                            </div>
                            <DialogTitle className="text-2xl font-black text-white drop-shadow-md">إضافة إيداع يدوي</DialogTitle>
                            <DialogDescription className="text-xs text-white/70 font-bold mt-1 uppercase tracking-widest">تجاوز فشل الإرسال الآلي</DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 space-y-5 bg-[#F8FAFC] dark:bg-slate-950" dir="rtl">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">اختيار البنك المستلم</Label>
                            <Select value={manualBank} onValueChange={(v: any) => { setManualBank(v); setManualName(''); }}>
                                <SelectTrigger className="h-12 rounded-2xl bg-white border-2 border-primary/5 font-bold text-right flex-row-reverse">
                                    <SelectValue placeholder="اختر البنك" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="alomqy" className="font-bold">شركة العمقي للصرافة</SelectItem>
                                    <SelectItem value="kuraimi" className="font-bold">بنك الكريمي الإسلامي</SelectItem>
                                    <SelectItem value="amjad" className="font-bold">بنك أمجاد الإسلامي</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4 pt-2">
                            {manualBank === 'alomqy' && (
                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">رقم الحساب (العمقي)</Label>
                                    <Input 
                                        placeholder="مثال: 25******" 
                                        value={manualAccount} 
                                        onChange={e => setManualAccount(e.target.value.replace(/\D/g, ''))}
                                        className="h-12 rounded-2xl bg-white border-2 border-primary/5 text-center font-black text-lg tracking-widest"
                                    />
                                </div>
                            )}

                            {manualBank === 'kuraimi' && (
                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">رقم المرجع (الكريمي)</Label>
                                    <Input 
                                        placeholder="رقم العملية المكون من 8+ أرقام" 
                                        value={manualRef} 
                                        onChange={e => setManualRef(e.target.value.replace(/\D/g, ''))}
                                        className="h-12 rounded-2xl bg-white border-2 border-primary/5 text-center font-black text-lg tracking-widest"
                                    />
                                </div>
                            )}

                            {manualBank === 'amjad' && (
                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">اختر العميل (صاحب الحوالة)</Label>
                                    <Select value={manualName} onValueChange={setManualName}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-white border-2 border-primary/5 font-bold text-right flex-row-reverse">
                                            <SelectValue placeholder="ابحث عن اسم العميل..." />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl" className="max-h-[300px]">
                                            {usersList?.map(u => (
                                                <SelectItem key={u.id} value={u.displayName} className="font-bold">
                                                    {u.displayName} ({u.phoneNumber})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-2 px-2 opacity-60">
                                        <User className="w-3.5 h-3.5" />
                                        <p className="text-[9px] font-bold">يتم جلب الأسماء من قائمة المستخدمين لضمان المطابقة.</p>
                                    </div>
                                </div>
                            )}

                            {manualBank !== 'amjad' && (
                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">الاسم أو ملاحظة (اختياري)</Label>
                                    <Input 
                                        placeholder="اسم المودع" 
                                        value={manualName} 
                                        onChange={e => setManualName(e.target.value)}
                                        className="h-12 rounded-2xl bg-white border-2 border-primary/5 text-center font-bold text-sm"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">المبلغ المودع (ر.ي)</Label>
                                <Input 
                                    type="number"
                                    placeholder="0.00" 
                                    value={manualAmount} 
                                    onChange={e => setManualAmount(e.target.value)}
                                    className="h-12 rounded-2xl bg-white border-2 border-primary/5 text-center font-black text-xl text-primary"
                                />
                            </div>
                        </div>

                        <div className="pt-4 grid grid-cols-2 gap-3">
                            <Button 
                                onClick={handleAddManual}
                                className="h-12 rounded-2xl font-black bg-mesh-gradient text-white shadow-lg active:scale-95 transition-all border-none"
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'إضافة الآن'}
                            </Button>
                            <DialogClose asChild>
                                <Button variant="outline" className="h-12 rounded-2xl font-bold">إلغاء</Button>
                            </DialogClose>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Toaster />
        </div>
    );
}
