'use client';

import React, { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
    User,
    Check,
    X,
    AlertCircle,
    Phone,
    Inbox,
    ArrowUpRight,
    MessageSquare,
    RefreshCw
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { useOrderDocArray, updateOrderItemInDoc } from '@/lib/order-unified';
import { collection, query, orderBy, doc, updateDoc, increment, writeBatch, limit } from 'firebase/firestore';
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

type DepositRequest = {
    id: string;
    transactionId?: string;
    userId: string;
    userName: string;
    userPhone: string;
    bank: 'alomqy' | 'kuraimi' | 'amjad';
    bankName: string;
    account?: string;
    reference?: string;
    refOrAccount: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    readiness: 'قيد الانتظار' | 'جاهزة' | 'فاشلة';
    methodName?: string;
    rejectReason?: string;
    createdAt: string;
    timestamp: string;
    approvedAt?: string;
    rejectedAt?: string;
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
    const [mainView, setMainView] = useState<'requests' | 'bank_notifs'>('requests');

    // States for adding manual deposit
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [manualBank, setManualBank] = useState<'alomqy' | 'kuraimi' | 'amjad'>('alomqy');
    const [manualAccount, setManualAccount] = useState('');
    const [manualRef, setManualRef] = useState('');
    const [manualName, setManualName] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // States for handling customer deposit requests
    const [processingReqId, setProcessingReqId] = useState<string | null>(null);
    const [selectedReqForReject, setSelectedReqForReject] = useState<DepositRequest | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const [selectedReqForApprove, setSelectedReqForApprove] = useState<DepositRequest | null>(null);
    const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);

    // Fetch Notifications
    const bankQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, 'bankNotifications'), orderBy('timestamp', 'desc'), limit(100)) : null),
        [firestore]
    );
    const { data: notifications, isLoading } = useCollection<BankNotif>(bankQuery);

    // Fetch Deposit Requests from clients
    const { data: depositRequests, isLoading: isLoadingDepReqs } = useOrderDocArray<DepositRequest>('depositRequests', 'requests');

    const { pendingRequests, archivedRequests } = useMemo(() => {
        const pending: DepositRequest[] = [];
        const archived: DepositRequest[] = [];
        depositRequests?.forEach(r => {
            if (r.status === 'pending') {
                pending.push(r);
            } else {
                archived.push(r);
            }
        });
        return { pendingRequests: pending, archivedRequests: archived };
    }, [depositRequests]);

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

    const filterRequests = (list: DepositRequest[]) => {
        return list.filter(r => {
            const matchesSearch = (r.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (r.userPhone || '').includes(searchTerm) ||
                                 (r.refOrAccount || '').includes(searchTerm) ||
                                 String(r.amount).includes(searchTerm) ||
                                 (r.bankName || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
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
            data.senderName = manualName;
            data.reference = Math.floor(10000000 + Math.random() * 90000000).toString();
        }

        try {
            await addDocumentNonBlocking(collection(firestore, 'bankNotifications'), data);
            toast({ title: "نجاح", description: "تم إضافة الإيداع يدوياً بنجاح." });
            setIsAddDialogOpen(false);
            setManualAccount(''); setManualRef(''); setManualName(''); setManualAmount('');
        } catch (e) {
            toast({ variant: 'destructive', title: "فشل الحفظ", description: "حدث خطأ أثناء محاولة الحفظ." });
        } finally {
            setIsSaving(false);
        }
    };

    // --- موافقة على طلب إيداع العميل ---
    const handleApproveDeposit = async () => {
        if (!selectedReqForApprove || !firestore) return;
        const req = selectedReqForApprove;
        setProcessingReqId(req.id);
        try {
            const now = new Date().toISOString();
            const batch = writeBatch(firestore);

            // 1. زيادة رصيد العميل فوراً
            const userRef = doc(firestore, 'users', req.userId);
            batch.update(userRef, { balance: increment(req.amount) });

            // 2. تحديث حالة طلب الإيداع داخل Order/depositRequests
            await updateOrderItemInDoc(firestore, 'depositRequests', req.id, {
                status: 'approved',
                readiness: 'جاهزة',
                approvedAt: now
            });

            // 3. تحديث حركة المستخدم
            if (req.transactionId) {
                const txRef = doc(firestore, `users/${req.userId}/transactions`, req.transactionId);
                batch.update(txRef, {
                    status: 'success',
                    readiness: 'جاهزة',
                    completedAt: now,
                    notes: `تم تأكيد الإيداع وإضافة مبلغ ${req.amount.toLocaleString()} ر.ي إلى محفظتك بنجاح.`
                });
            }

            // 4. إشعار العميل
            const notifRef = doc(collection(firestore, `users/${req.userId}/notifications`));
            batch.set(notifRef, {
                id: notifRef.id,
                title: 'تم شحن رصيدك بنجاح ✅',
                body: `تمت الموافقة على طلب تغذية رصيدك بمبلغ ${req.amount.toLocaleString()} ر.ي عبر ${req.bankName}. الرصيد متاح في محفظتك الآن.`,
                type: 'deposit_approved',
                read: false,
                createdAt: now,
                timestamp: now
            });

            await batch.commit();

            toast({
                title: "تمت الموافقة بنجاح 🎉",
                description: `تم شحن ${req.amount.toLocaleString()} ر.ي لحساب ${req.userName || req.userPhone}.`
            });
            setIsApproveDialogOpen(false);
            setSelectedReqForApprove(null);
        } catch (error: any) {
            console.error("Error approving deposit:", error);
            toast({
                variant: 'destructive',
                title: 'فشل في الموافقة',
                description: error.message || 'حدث خطأ أثناء تنفيذ الموافقة.'
            });
        } finally {
            setProcessingReqId(null);
        }
    };

    // --- رفض طلب إيداع العميل مع السبب ---
    const handleConfirmReject = async () => {
        if (!selectedReqForReject || !firestore) return;
        const req = selectedReqForReject;
        const reason = rejectReason.trim() || 'لم يتم العثور على إيداع مطابق في البنك';
        setProcessingReqId(req.id);
        try {
            const now = new Date().toISOString();
            const batch = writeBatch(firestore);

            // 1. تحديث طلب الإيداع إلى مرفوض داخل Order/depositRequests
            await updateOrderItemInDoc(firestore, 'depositRequests', req.id, {
                status: 'rejected',
                readiness: 'فاشلة',
                rejectReason: reason,
                rejectedAt: now
            });

            // 2. تحديث حركة المستخدم إلى فاشلة مع السبب
            if (req.transactionId) {
                const txRef = doc(firestore, `users/${req.userId}/transactions`, req.transactionId);
                batch.update(txRef, {
                    status: 'failed',
                    readiness: 'فاشلة',
                    rejectReason: reason,
                    providerMessage: reason,
                    failedAt: now,
                    notes: `تم رفض طلب الإيداع. السبب: ${reason}`
                });
            }

            // 3. إرسال إشعار للعميل يوضح سبب الرفض
            const notifRef = doc(collection(firestore, `users/${req.userId}/notifications`));
            batch.set(notifRef, {
                id: notifRef.id,
                title: 'تعذر قبول طلب التغذية ❌',
                body: `تم رفض طلب تغذية رصيدك بمبلغ ${req.amount.toLocaleString()} ر.ي. السبب: ${reason}`,
                type: 'deposit_rejected',
                read: false,
                createdAt: now,
                timestamp: now
            });

            await batch.commit();

            toast({
                title: "تم رفض الطلب",
                description: "تم تحديث حالة العملية للمستخدم وحفظ سبب الرفض بنجاح."
            });
            setIsRejectDialogOpen(false);
            setSelectedReqForReject(null);
            setRejectReason('');
        } catch (error: any) {
            console.error("Error rejecting deposit:", error);
            toast({
                variant: 'destructive',
                title: 'فشل في الرفض',
                description: error.message || 'حدث خطأ أثناء رفض الطلب.'
            });
        } finally {
            setProcessingReqId(null);
        }
    };

    const formatDateSafe = (iso?: string) => {
        if (!iso) return '...';
        try {
            return format(parseISO(iso), 'd MMM, h:mm a', { locale: ar });
        } catch {
            return iso;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-slate-950 text-right" dir="rtl">
            <SimpleHeader title="إدارة الإيداعات والتغذية" />
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-5 pb-24">
                
                {/* مفتاح التبديل الرئيسي بين طلبات العملاء وإشعارات البنوك */}
                <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setMainView('requests')}
                        className={cn(
                            "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all relative",
                            mainView === 'requests'
                                ? "bg-primary text-white shadow-md scale-[1.01]"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <User className="h-4 w-4" />
                        <span>طلبات تغذية العملاء</span>
                        {pendingRequests.length > 0 && (
                            <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                                {pendingRequests.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setMainView('bank_notifs')}
                        className={cn(
                            "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all",
                            mainView === 'bank_notifs'
                                ? "bg-primary text-white shadow-md scale-[1.01]"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Building2 className="h-4 w-4" />
                        <span>إشعارات البنوك الواردة</span>
                    </button>
                </div>

                {/* زر إضافة إيداع يدوي */}
                <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="w-full h-13 rounded-2xl bg-mesh-gradient text-white font-black text-sm shadow-lg shadow-primary/20 active:scale-95 transition-transform border-none"
                >
                    <PlusCircle className="ml-2 h-5 w-5" />
                    إضافة إيداع يدوي للنظام
                </Button>

                {/* أدوات البحث */}
                <Card className="rounded-[24px] border-none shadow-sm bg-white dark:bg-slate-900 p-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder={mainView === 'requests' ? "بحث باسم العميل، الهاتف، المرجع أو المبلغ..." : "بحث بالاسم، الحساب أو المرجع..."} 
                            className="h-11 pr-10 rounded-xl bg-muted/20 border-none text-xs font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </Card>

                {/* 1. عرض طلبات تغذية العملاء */}
                {mainView === 'requests' && (
                    <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-2xl h-11 p-1 mb-4">
                            <TabsTrigger value="pending" className="rounded-xl font-black text-xs">
                                قيد الانتظار ({pendingRequests.length})
                            </TabsTrigger>
                            <TabsTrigger value="archived" className="rounded-xl font-black text-xs">
                                الأرشيف السجل ({archivedRequests.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* الطلبات قيد الانتظار */}
                        <TabsContent value="pending" className="space-y-3 mt-0">
                            {isLoadingDepReqs ? (
                                [1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-[24px]" />)
                            ) : filterRequests(pendingRequests).length === 0 ? (
                                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[28px] border border-dashed border-muted p-6">
                                    <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="font-black text-sm text-foreground">لا توجد طلبات تغذية معلقة حالياً</p>
                                    <p className="text-xs text-muted-foreground mt-1">أي طلب يرسله العميل ولا يطابق إشعاراً آلياً سيظهر هنا للمراجعة والموافقة اليدوية.</p>
                                </div>
                            ) : (
                                filterRequests(pendingRequests).map(req => (
                                    <Card key={req.id} className="rounded-[28px] border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden border-r-4 border-amber-500 animate-in fade-in-0 slide-in-from-bottom-2">
                                        <CardContent className="p-4 space-y-4">
                                            {/* الرأس: اسم العميل والمبلغ */}
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                                                            <User className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-sm text-foreground">{req.userName || 'عميل'}</h4>
                                                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {req.userPhone || 'بدون هاتف'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-left">
                                                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                                        {req.amount.toLocaleString()} <span className="text-xs font-bold">ر.ي</span>
                                                    </p>
                                                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none text-[9px] font-black">
                                                        ⏳ قيد الانتظار
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* التفاصيل البنكية */}
                                            <div className="bg-muted/40 p-3 rounded-2xl space-y-1.5 text-xs font-bold">
                                                <div className="flex justify-between items-center text-muted-foreground">
                                                    <span className="flex items-center gap-1.5">
                                                        <Building2 className="h-3.5 w-3.5 text-primary" />
                                                        البنك المستلم:
                                                    </span>
                                                    <span className="text-foreground font-black">{req.bankName}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-muted-foreground">
                                                    <span className="flex items-center gap-1.5">
                                                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                                                        {req.bank === 'kuraimi' ? 'رقم المرجع:' : req.bank === 'alomqy' ? 'رقم الحساب:' : 'اسم المحول:'}
                                                    </span>
                                                    <span className="font-mono text-foreground font-black text-sm bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                                        {req.refOrAccount || 'غير محدد'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-muted-foreground pt-1 border-t border-muted/50 text-[10px]">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        وقت الطلب:
                                                    </span>
                                                    <span>{formatDateSafe(req.createdAt || req.timestamp)}</span>
                                                </div>
                                            </div>

                                            {/* زري الإجراء: موافق أو إلغاء */}
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <Button
                                                    onClick={() => {
                                                        setSelectedReqForApprove(req);
                                                        setIsApproveDialogOpen(true);
                                                    }}
                                                    disabled={processingReqId === req.id}
                                                    className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                                                >
                                                    {processingReqId === req.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin ml-1.5" />
                                                    ) : (
                                                        <Check className="h-4 w-4 ml-1.5" />
                                                    )}
                                                    موافق (إضافة الرصيد)
                                                </Button>

                                                <Button
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setSelectedReqForReject(req);
                                                        setRejectReason('');
                                                        setIsRejectDialogOpen(true);
                                                    }}
                                                    disabled={processingReqId === req.id}
                                                    className="h-11 rounded-xl font-black text-xs active:scale-95 transition-all shadow-md shadow-destructive/20"
                                                >
                                                    <X className="h-4 w-4 ml-1.5" />
                                                    إلغاء مع السبب
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>

                        {/* أرشيف الطلبات (المقبولة والمرفوضة) */}
                        <TabsContent value="archived" className="space-y-3 mt-0">
                            {filterRequests(archivedRequests).length === 0 ? (
                                <div className="text-center py-16 opacity-40">
                                    <Clock className="h-12 w-12 mx-auto mb-2" />
                                    <p className="font-black text-sm">لا توجد عمليات مؤرشفة بعد</p>
                                </div>
                            ) : (
                                filterRequests(archivedRequests).map(req => {
                                    const isApproved = req.status === 'approved';
                                    return (
                                        <Card key={req.id} className="rounded-[24px] border-none shadow-sm bg-white dark:bg-slate-900 p-4 space-y-2.5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-black text-sm text-foreground">{req.userName}</h4>
                                                    <p className="text-[10px] font-bold text-muted-foreground">{req.bankName} - {req.refOrAccount}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-base font-black text-foreground">
                                                        {req.amount.toLocaleString()} <span className="text-[10px]">ر.ي</span>
                                                    </p>
                                                    <Badge className={cn(
                                                        "text-[9px] font-black border-none",
                                                        isApproved ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"
                                                    )}>
                                                        {isApproved ? 'جاهزة (مقبولة)' : 'فاشلة (مرفوضة)'}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {req.rejectReason && (
                                                <div className="bg-red-500/10 p-2.5 rounded-xl text-xs text-red-600 font-bold border border-red-500/20">
                                                    سبب الرفض: {req.rejectReason}
                                                </div>
                                            )}

                                            <div className="text-[9px] text-muted-foreground font-bold flex justify-between pt-1 border-t border-muted/40">
                                                <span>تاريخ الإرسال: {formatDateSafe(req.createdAt)}</span>
                                                <span>{req.approvedAt ? `تاريخ القبول: ${formatDateSafe(req.approvedAt)}` : req.rejectedAt ? `تاريخ الرفض: ${formatDateSafe(req.rejectedAt)}` : ''}</span>
                                            </div>
                                        </Card>
                                    );
                                })
                            )}
                        </TabsContent>
                    </Tabs>
                )}

                {/* 2. عرض إشعارات البنوك الواردة */}
                {mainView === 'bank_notifs' && (
                    <div className="space-y-4">
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
                                    {s === 'all' ? 'الكل' : s === 'unpaid' ? 'غير مسددة' : 'مسددة'}
                                </button>
                            ))}
                        </div>

                        <Tabs defaultValue="alomqy" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/50 rounded-2xl h-11 p-1 mb-4">
                                <TabsTrigger value="alomqy" className="rounded-xl font-black text-xs">العمقي</TabsTrigger>
                                <TabsTrigger value="kuraimi" className="rounded-xl font-black text-xs">الكريمي</TabsTrigger>
                                <TabsTrigger value="amjad" className="rounded-xl font-black text-xs">أمجاد</TabsTrigger>
                            </TabsList>

                            {['alomqy', 'kuraimi', 'amjad'].map(bank => (
                                <TabsContent key={bank} value={bank} className="space-y-3 mt-0">
                                    {isLoading ? (
                                        [1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-[24px]" />)
                                    ) : filterNotifs(bank).length === 0 ? (
                                        <div className="text-center py-16 opacity-30">
                                            <Building2 className="h-14 w-14 mx-auto mb-3" />
                                            <p className="font-black text-xs uppercase">لا توجد إشعارات حالياً</p>
                                        </div>
                                    ) : (
                                        filterNotifs(bank).map(notif => (
                                            <Card key={notif.id} className={cn(
                                                "rounded-[24px] border-none shadow-sm overflow-hidden",
                                                notif.status === 'unpaid' ? "bg-white dark:bg-slate-900 border-r-4 border-green-500" : "bg-muted/40 grayscale"
                                            )}>
                                                <CardContent className="p-4 space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={cn(
                                                                "p-2 rounded-xl shrink-0",
                                                                notif.status === 'unpaid' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                                                            )}>
                                                                {notif.bank === 'alomqy' ? <Zap className="w-4 h-4" /> : notif.bank === 'kuraimi' ? <CreditCard className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                                                            </div>
                                                            <div className="text-right">
                                                                <h4 className="font-black text-xs text-foreground">{notif.senderName}</h4>
                                                                <p className="text-[10px] font-bold text-muted-foreground">
                                                                    {notif.bank === 'alomqy' ? `الحساب: ${notif.account}` : `المرجع: ${notif.reference}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className={cn("text-base font-black", notif.status === 'unpaid' ? "text-green-600" : "text-muted-foreground")}>
                                                                {notif.amount.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                                                            </p>
                                                            <div className="flex items-center justify-end gap-1 opacity-40">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                <span className="text-[8px] font-bold">{formatDateSafe(notif.timestamp)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {notif.rawMessage && (
                                                        <div className="bg-muted/30 p-2 rounded-xl text-[9px] text-muted-foreground italic font-bold">
                                                            "{notif.rawMessage}"
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted/30">
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="h-7 rounded-lg text-destructive hover:bg-destructive/10 text-[10px] font-black">
                                                                    <Trash2 className="w-3 h-3 ml-1" />
                                                                    حذف
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-[28px]" dir="rtl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-center font-black">تأكيد الحذف</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-center">سيتم حذف هذا الإشعار نهائياً من سجلات النظام.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-4">
                                                                    <AlertDialogAction onClick={() => handleDelete(notif.id)} className="w-full rounded-xl h-11 bg-destructive font-bold">تأكيد الحذف</AlertDialogAction>
                                                                    <AlertDialogCancel className="w-full rounded-xl h-11 mt-0 font-black">إلغاء</AlertDialogCancel>
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
                )}
            </div>

            {/* Dialog تأكيد الموافقة على طلب الإيداع */}
            <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                <AlertDialogContent className="rounded-[32px] text-right" dir="rtl">
                    <AlertDialogHeader>
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                            <Check className="h-7 w-7" />
                        </div>
                        <AlertDialogTitle className="text-center font-black text-lg">تأكيد قبول طلب التغذية</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-xs font-bold leading-relaxed">
                            هل أنت متأكد من إضافة مبلغ <span className="font-black text-emerald-600 text-sm">{selectedReqForApprove?.amount.toLocaleString()} ر.ي</span> إلى رصيد العميل <span className="font-black text-foreground">{selectedReqForApprove?.userName}</span>؟
                            <br />
                            سيتم تحديث العملية فوراً إلى <span className="text-emerald-600 font-black">"جاهزة"</span> في حساب العميل.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4">
                        <Button
                            onClick={handleApproveDeposit}
                            disabled={Boolean(processingReqId)}
                            className="w-full rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                        >
                            {processingReqId ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Check className="h-4 w-4 ml-2" />}
                            نعم، إضافة الرصيد
                        </Button>
                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0 font-bold">إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog رفض طلب الإيداع مع ذكر السبب */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="rounded-[32px] max-w-sm p-6 text-right outline-none" dir="rtl">
                    <DialogHeader>
                        <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-2">
                            <X className="h-7 w-7" />
                        </div>
                        <DialogTitle className="text-center font-black text-lg">رفض طلب التغذية</DialogTitle>
                        <DialogDescription className="text-center text-xs font-bold">
                            يرجى توضيح سبب الرفض ليظهر في كشف حساب العميل وإشعاره بالعملية:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="bg-muted/40 p-3 rounded-2xl text-xs space-y-1">
                            <p className="font-bold text-muted-foreground">العميل: <span className="font-black text-foreground">{selectedReqForReject?.userName}</span></p>
                            <p className="font-bold text-muted-foreground">المبلغ: <span className="font-black text-emerald-600">{selectedReqForReject?.amount.toLocaleString()} ر.ي</span></p>
                            <p className="font-bold text-muted-foreground">المرجع/الحساب: <span className="font-black text-foreground">{selectedReqForReject?.refOrAccount}</span></p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black text-muted-foreground">سبب الرفض</Label>
                            <Textarea
                                placeholder="مثال: لم نجد إشعار الإيداع في كشف الحساب البنكي / رقم العملية غير صحيح"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="min-h-[90px] rounded-2xl bg-muted/20 border-2 border-primary/5 text-xs font-bold leading-relaxed resize-none"
                            />
                        </div>

                        {/* اقتراحات أسباب سريعة */}
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                'لم يتم العثور على الإيداع في البنك',
                                'رقم المرجع غير مطابق للعملية',
                                'المبلغ غير مطابق للإشعار',
                                'الحساب غير صحيح'
                            ].map((quick) => (
                                <button
                                    key={quick}
                                    type="button"
                                    onClick={() => setRejectReason(quick)}
                                    className="text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground px-2 py-1 rounded-lg font-bold transition-all"
                                >
                                    {quick}
                                </button>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="grid grid-cols-2 gap-3 mt-2">
                        <Button
                            variant="destructive"
                            onClick={handleConfirmReject}
                            disabled={Boolean(processingReqId)}
                            className="w-full rounded-2xl h-12 font-black shadow-lg shadow-destructive/20"
                        >
                            {processingReqId ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <X className="h-4 w-4 ml-2" />}
                            تأكيد الرفض
                        </Button>
                        <DialogClose asChild>
                            <Button variant="outline" className="w-full rounded-2xl h-12 font-bold">تراجع</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog إضافة إيداع يدوي */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="rounded-[40px] max-w-sm p-0 overflow-hidden border-none shadow-2xl outline-none [&>button]:hidden">
                    <div className="bg-mesh-gradient p-7 text-center text-white relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
                        <DialogHeader>
                            <div className="bg-white/20 p-3 rounded-[24px] w-14 h-14 mx-auto mb-3 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                                <PlusCircle className="h-7 w-7 text-white" />
                            </div>
                            <DialogTitle className="text-xl font-black text-white drop-shadow-md">إضافة إيداع يدوي</DialogTitle>
                            <DialogDescription className="text-xs text-white/70 font-bold mt-1">تسجيل إيداع بنكي مباشرة في النظام</DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-5 space-y-4 bg-[#F8FAFC] dark:bg-slate-950" dir="rtl">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">اختيار البنك المستلم</Label>
                            <Select value={manualBank} onValueChange={(v: any) => { setManualBank(v); setManualName(''); }}>
                                <SelectTrigger className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 font-bold text-right flex-row-reverse">
                                    <SelectValue placeholder="اختر البنك" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="alomqy" className="font-bold">شركة العمقي للصرافة</SelectItem>
                                    <SelectItem value="kuraimi" className="font-bold">بنك الكريمي الإسلامي</SelectItem>
                                    <SelectItem value="amjad" className="font-bold">بنك أمجاد الإسلامي</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3 pt-1">
                            {manualBank === 'alomqy' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">رقم الحساب (العمقي)</Label>
                                    <Input 
                                        placeholder="مثال: 25******" 
                                        value={manualAccount} 
                                        onChange={e => setManualAccount(e.target.value.replace(/\D/g, ''))}
                                        className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 text-center font-black text-lg tracking-widest"
                                    />
                                </div>
                            )}

                            {manualBank === 'kuraimi' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">رقم المرجع (الكريمي)</Label>
                                    <Input 
                                        placeholder="رقم العملية المكون من 8+ أرقام" 
                                        value={manualRef} 
                                        onChange={e => setManualRef(e.target.value.replace(/\D/g, ''))}
                                        className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 text-center font-black text-lg tracking-widest"
                                    />
                                </div>
                            )}

                            {manualBank === 'amjad' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">اختر العميل (صاحب الحوالة)</Label>
                                    <Select value={manualName} onValueChange={setManualName}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 font-bold text-right flex-row-reverse">
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
                                </div>
                            )}

                            {manualBank !== 'amjad' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">الاسم أو ملاحظة (اختياري)</Label>
                                    <Input 
                                        placeholder="اسم المودع" 
                                        value={manualName} 
                                        onChange={e => setManualName(e.target.value)}
                                        className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 text-center font-bold text-xs"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-black text-muted-foreground uppercase mr-1">المبلغ المودع (ر.ي)</Label>
                                <Input 
                                    type="number"
                                    placeholder="0.00" 
                                    value={manualAmount} 
                                    onChange={e => setManualAmount(e.target.value)}
                                    className="h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/5 text-center font-black text-xl text-primary"
                                />
                            </div>
                        </div>

                        <div className="pt-3 grid grid-cols-2 gap-3">
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
