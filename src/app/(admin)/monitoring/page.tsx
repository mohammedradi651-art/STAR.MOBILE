'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    collectionGroup, 
    query, 
    orderBy, 
    limit, 
    onSnapshot, 
    FirestoreError,
    DocumentData,
    doc,
    getDoc
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Search, 
    Smartphone, 
    Wifi, 
    SatelliteDish, 
    Wallet, 
    Undo2, 
    Send, 
    ShoppingBag, 
    Gamepad2, 
    TrendingUp, 
    FileText, 
    Clock, 
    User as UserIcon, 
    Calendar, 
    Banknote, 
    Activity, 
    Tag,
    RefreshCw,
    Copy,
    Phone,
    Receipt,
    Check,
    X,
    AlertCircle,
    Droplets,
    Zap
} from 'lucide-react';
import { isTelecomService, getReadinessDetails } from '@/lib/telecom-order';
import { format, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

export const dynamic = 'force-dynamic';

export type MonitoredTransaction = {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  notes?: string;
  recipientPhoneNumber?: string;
  subscriberName?: string;
  cardNumber?: string;
  cardPassword?: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  status?: string;
  serviceType?: string;
  providerOrderId?: string | number;
  transid?: string;
  _parentUserId?: string;
};

// تحويل أي أرقام إلى أرقام إنجليزية (0-9)
const toEnDigits = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = typeof val === 'number' ? val.toLocaleString('en-US') : String(val);
    return str.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
};

const formatAmount = (num: number): string => {
    return toEnDigits(Number(num || 0).toLocaleString('en-US'));
};

const formatTxTime = (dateStr?: string) => {
    if (!dateStr) return '...';
    try {
        const date = parseISO(dateStr);
        const timeStr = format(date, 'hh:mm a');
        const dateStrFormatted = format(date, 'yyyy/MM/dd');
        if (isToday(date)) {
            return `اليوم ${toEnDigits(timeStr)}`;
        }
        return `${toEnDigits(dateStrFormatted)} - ${toEnDigits(timeStr)}`;
    } catch {
        return '...';
    }
};

const getTransactionIcon = (type: string = '') => {
    const t = type.toLowerCase();
    if (t.includes('استرجاع')) return Undo2;
    if (t.includes('تغذية') || t.includes('إيداع') || t.includes('استلام')) return Wallet;
    if (t.includes('تحويل')) return Send;
    if (t.includes('سحب')) return Banknote;
    if (t.includes('الوادي')) return SatelliteDish;
    if (t.includes('ماء') || t.includes('مياه')) return Droplets;
    if (t.includes('كهرباء')) return Zap;
    if (t.includes('شراء كرت') || t.includes('شبكة')) return Wifi;
    if (t.includes('سداد') || t.includes('رصيد') || t.includes('باقة')) return Smartphone;
    if (t.includes('تجديد') || t.includes('مدفوعات')) return SatelliteDish;
    if (t.includes('متجر') || t.includes('منتج')) return ShoppingBag;
    if (t.includes('ألعاب') || t.includes('شدات')) return Gamepad2;
    if (t.includes('أرباح')) return TrendingUp;
    return FileText;
};

// دوال تصنيف العمليات الدقيقة والصارمة
const isDepositTx = (tx: MonitoredTransaction) => {
    const t = (tx.transactionType || '').toLowerCase();
    const n = (tx.notes || '').toLowerCase();
    return t.includes('تغذية') || t.includes('إيداع') || t.includes('استلام') || t.includes('شحن حساب') || n.includes('إيداع') || n.includes('تغذية');
};

const isAlwadiTx = (tx: MonitoredTransaction) => {
    const t = (tx.transactionType || '').toLowerCase();
    const n = (tx.notes || '').toLowerCase();
    return t.includes('الوادي') || n.includes('الوادي') || t.includes('alwadi');
};

const isUtilitiesTx = (tx: MonitoredTransaction) => {
    const t = (tx.transactionType || '').toLowerCase();
    const n = (tx.notes || '').toLowerCase();
    return t.includes('ماء') || t.includes('مياه') || t.includes('كهرباء') || n.includes('مياه') || n.includes('كهرباء');
};

const isWithdrawalTx = (tx: MonitoredTransaction) => {
    const t = (tx.transactionType || '').toLowerCase();
    const n = (tx.notes || '').toLowerCase();
    return t.includes('سحب') || n.includes('سحب');
};

const isNetworksTx = (tx: MonitoredTransaction) => {
    if (isAlwadiTx(tx)) return false;
    const t = (tx.transactionType || '').toLowerCase();
    const n = (tx.notes || '').toLowerCase();
    return t.includes('شراء كرت') || t.includes('شبكة') || t.includes('كرت شبكة');
};

const isTelecomTx = (tx: MonitoredTransaction) => {
    // ممنوع منعاً باتاً إضافة الإيداعات في السداد!
    if (isDepositTx(tx)) return false;
    if (isAlwadiTx(tx)) return false;
    if (isUtilitiesTx(tx)) return false;
    if (isWithdrawalTx(tx)) return false;
    if (isNetworksTx(tx)) return false;

    const t = (tx.transactionType || '').toLowerCase();
    const n = (tx.notes || '').toLowerCase();

    return t.includes('سداد') || 
           t.includes('باقة') || 
           t.includes('رصيد') || 
           t.includes('يمن موبايل') || 
           t.includes('سبأفون') || 
           t.includes('يو') || 
           t.includes('you') || 
           t.includes('واي') || 
           t.includes('عدن نت') || 
           t.includes('اتصالات') || 
           n.includes('باقة') || 
           n.includes('رصيد');
};

// دوال فحص التوقيت الدقيقة
const isTxToday = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
        const date = parseISO(dateStr);
        return isToday(date);
    } catch {
        return false;
    }
};

const isTxThisMonth = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
        const date = parseISO(dateStr);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } catch {
        return false;
    }
};

// تعريف التبويبات مع تبويب "الكل" للمشتركين
const TABS = [
    { id: 'all', label: 'الكل', icon: Activity },
    { id: 'deposits', label: 'الإيداعات', icon: Wallet },
    { id: 'sdad', label: 'السداد', icon: Smartphone },
    { id: 'networks', label: 'الشبكات', icon: Wifi },
    { id: 'alwadi', label: 'منظومة الوادي', icon: SatelliteDish },
    { id: 'utilities', label: 'الماء والكهرباء', icon: Droplets },
    { id: 'withdrawals', label: 'طلبات السحب', icon: Banknote },
] as const;

type TabKey = typeof TABS[number]['id'];
type DateFilterKey = 'today' | 'month' | 'all';

export default function MonitoringPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // التبويب الافتراضي وفلتر الفترة
    const [activeTab, setActiveTab] = useState<TabKey>('all');
    const [dateFilter, setDateFilter] = useState<DateFilterKey>('today');
    const [transactions, setTransactions] = useState<MonitoredTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<MonitoredTransaction | null>(null);
    const [activeClientName, setActiveClientName] = useState<string>('');
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [needsIndex, setNeedsIndex] = useState(false);
    const [usersMap, setUsersMap] = useState<Record<string, { displayName?: string; phoneNumber?: string }>>({});

    // دالة استبعاد عمليات حساب المدير 770326828 نهائياً
    const isAdminTx = useCallback((tx: MonitoredTransaction) => {
        const parent = tx._parentUserId || tx.userId || '';
        const phone = tx.userPhone || '';
        const name = tx.userName || '';
        
        // استبعاد أي عملية خاصة بحساب المدير نفسه
        if (parent === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2' || parent === user?.uid) return true;
        if (tx.userId === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2' || tx.userId === user?.uid) return true;
        if (phone.includes('770326828')) return true;
        if (name.includes('مدير النظام')) return true;
        
        return false;
    }, [user?.uid]);

    // جلب أسماء وأرقام المشتركين المعروضين في القائمة تلقائياً
    useEffect(() => {
        if (!firestore) return;
        const uidsToFetch = Array.from(new Set(
            transactions
                .filter(t => !isAdminTx(t))
                .map(t => t.userId || t._parentUserId)
                .filter((id): id is string => Boolean(id && !usersMap[id]))
        )).slice(0, 35);

        if (uidsToFetch.length === 0) return;

        uidsToFetch.forEach(uid => {
            getDoc(doc(firestore, 'users', uid)).then(snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    setUsersMap(prev => ({
                        ...prev,
                        [uid]: { displayName: d.displayName, phoneNumber: d.phoneNumber }
                    }));
                }
            }).catch(() => {});
        });
    }, [transactions, firestore, usersMap, isAdminTx]);

    // جلب اسم العميل الحقيقي عند فتح المنبثق إذا لم يكن محفوظاً في العملية
    useEffect(() => {
        if (!selectedTx) {
            setActiveClientName('');
            return;
        }

        const cached = usersMap[selectedTx.userId || selectedTx._parentUserId || ''];
        if (cached?.displayName) {
            setActiveClientName(cached.displayName);
            return;
        }

        if (selectedTx.userName) {
            setActiveClientName(selectedTx.userName);
            return;
        }

        if (selectedTx.subscriberName) {
            setActiveClientName(selectedTx.subscriberName);
            return;
        }

        const uid = selectedTx.userId || selectedTx._parentUserId;
        if (uid && firestore) {
            setActiveClientName('جاري جلب الاسم...');
            getDoc(doc(firestore, 'users', uid))
                .then((snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setActiveClientName(data.displayName || data.phoneNumber || 'عميل');
                    } else {
                        setActiveClientName('عميل');
                    }
                })
                .catch(() => {
                    setActiveClientName('عميل');
                });
        } else {
            setActiveClientName('عميل');
        }
    }, [selectedTx, firestore, usersMap]);

    const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

    // جلب عمليات المشتركين مع دعم الفهرسة والاحتياطي الموسّع
    const setupTransactionsListener = useCallback(() => {
        if (!firestore || !isUserAdmin) return () => {};

        setIsLoading(true);

        const parseDocs = (snapshotDocs: DocumentData[]) => {
            const list: MonitoredTransaction[] = [];
            for (const docSnap of snapshotDocs) {
                const data = docSnap.data();
                const parentUserId = docSnap.ref.parent?.parent?.id;
                list.push({
                    id: docSnap.id,
                    transactionDate: data.transactionDate || data.createdAt || '',
                    amount: Number(data.amount || 0),
                    transactionType: data.transactionType || 'عملية',
                    notes: data.notes || '',
                    recipientPhoneNumber: data.recipientPhoneNumber || '',
                    subscriberName: data.subscriberName || '',
                    cardNumber: data.cardNumber || '',
                    cardPassword: data.cardPassword || '',
                    userId: data.userId || parentUserId || '',
                    userName: data.userName || '',
                    userPhone: data.userPhone || '',
                    status: data.status || '',
                    serviceType: data.serviceType || '',
                    providerOrderId: data.providerOrderId || '',
                    transid: data.transid || '',
                    _parentUserId: parentUserId,
                });
            }
            // ترتيب تنازلي حاسم من الأحدث إلى الأقدم
            list.sort((a, b) => {
                const timeA = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
                const timeB = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
                return timeB - timeA;
            });
            return list;
        };

        let isPrimaryActive = true;
        let fallbackUnsubscribe: (() => void) | null = null;

        // استعلام مباشر مفهرس تنازلياً لـ 300 عملية
        const primaryQuery = query(
            collectionGroup(firestore, 'transactions'),
            orderBy('transactionDate', 'desc'),
            limit(300)
        );

        const primaryUnsubscribe = onSnapshot(
            primaryQuery,
            (snapshot) => {
                if (!isPrimaryActive) return;
                setNeedsIndex(false);
                const list = parseDocs(snapshot.docs);
                setTransactions(list);
                setIsLoading(false);
                setIsRefreshing(false);
            },
            (error: FirestoreError) => {
                console.warn("Primary query warning, using fallback limit:", error.message);
                if (error.message?.includes('index') || error.message?.includes('COLLECTION_GROUP')) {
                    setNeedsIndex(true);
                }
                isPrimaryActive = false;

                try {
                    // استعلام احتياطي موسّع لـ 1000 عملية ليغطي عمليات المشتركين لليوم والشهر بالكامل
                    const fallbackQuery = query(
                        collectionGroup(firestore, 'transactions'),
                        limit(1000)
                    );

                    fallbackUnsubscribe = onSnapshot(
                        fallbackQuery,
                        (fallbackSnap) => {
                            const list = parseDocs(fallbackSnap.docs);
                            setTransactions(list);
                            setIsLoading(false);
                            setIsRefreshing(false);
                        },
                        () => {
                            setIsLoading(false);
                            setIsRefreshing(false);
                        }
                    );
                } catch {
                    setIsLoading(false);
                    setIsRefreshing(false);
                }
            }
        );

        return () => {
            isPrimaryActive = false;
            primaryUnsubscribe();
            if (fallbackUnsubscribe) fallbackUnsubscribe();
        };
    }, [firestore, isUserAdmin]);

    useEffect(() => {
        const unsubscribe = setupTransactionsListener();
        return () => unsubscribe();
    }, [setupTransactionsListener]);

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        setupTransactionsListener();
        setTimeout(() => setIsRefreshing(false), 700);
        toast({ title: "تم التحديث", description: "تم جلب آخر عمليات المشتركين." });
    };

    const handleCopy = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(toEnDigits(text));
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 1800);
        toast({ title: "تم النسخ", description: `تم نسخ ${fieldName} بنجاح.` });
    };

    // تصفية عمليات المشتركين فقط (استبعاد المدير)، وتطبيق فلتر الفترة والتبويب والبحث كاملاً من الأحدث للأقدم
    const currentTabTransactions = useMemo(() => {
        const q = toEnDigits(searchTerm).trim().toLowerCase();

        // 1. تصفية عمليات المدير نهائياً (إبقاء المشتركين فقط)
        const subscriberOnly = transactions.filter(tx => !isAdminTx(tx));

        // 2. تصفية الفترة الزمنية (اليوم / هذا الشهر / الكل)
        const filteredByDate = subscriberOnly.filter(tx => {
            if (dateFilter === 'today') {
                return isTxToday(tx.transactionDate);
            }
            if (dateFilter === 'month') {
                return isTxThisMonth(tx.transactionDate);
            }
            return true;
        });

        // 3. تصفية حسب نوع التبويب
        const filteredByType = filteredByDate.filter(tx => {
            if (activeTab === 'all') return true;
            switch (activeTab) {
                case 'deposits':
                    return isDepositTx(tx);
                case 'sdad':
                    return isTelecomTx(tx);
                case 'networks':
                    return isNetworksTx(tx);
                case 'alwadi':
                    return isAlwadiTx(tx);
                case 'utilities':
                    return isUtilitiesTx(tx);
                case 'withdrawals':
                    return isWithdrawalTx(tx);
                default:
                    return true;
            }
        });

        // 4. تصفية بالبحث إذا وجد
        const searched = filteredByType.filter(tx => {
            if (!q) return true;
            const userInfo = usersMap[tx.userId || tx._parentUserId || ''];
            const userName = (userInfo?.displayName || tx.userName || '').toLowerCase();
            const userPhone = toEnDigits(userInfo?.phoneNumber || tx.userPhone || '').toLowerCase();
            const recipientPhone = toEnDigits(tx.recipientPhoneNumber || '').toLowerCase();
            const cardNum = toEnDigits(tx.cardNumber || '').toLowerCase();
            const notes = (tx.notes || '').toLowerCase();
            const type = (tx.transactionType || '').toLowerCase();

            return type.includes(q) ||
                   notes.includes(q) ||
                   recipientPhone.includes(q) ||
                   cardNum.includes(q) ||
                   userName.includes(q) ||
                   userPhone.includes(q);
        });

        // إرجاع كافة العمليات كاملة مرتبة من الأحدث للأقدم
        return searched;
    }, [transactions, activeTab, searchTerm, dateFilter, isAdminTx, usersMap]);

    // حساب إحصائيات دقيقة للمشتركين فقط تتفاعل مع الفترة المختارة
    const stats = useMemo(() => {
        let totalSdad = 0;
        let totalDeposit = 0;
        let totalCards = 0;
        let periodCount = 0;
        let todayCount = 0;
        let monthCount = 0;

        const subscriberOnly = transactions.filter(tx => !isAdminTx(tx));

        for (const tx of subscriberOnly) {
            if (!tx.transactionDate) continue;
            const isTodayTx = isTxToday(tx.transactionDate);
            const isMonthTx = isTxThisMonth(tx.transactionDate);

            if (isTodayTx) todayCount++;
            if (isMonthTx) monthCount++;

            const matchPeriod = 
                dateFilter === 'today' ? isTodayTx :
                dateFilter === 'month' ? isMonthTx : true;

            if (matchPeriod) {
                periodCount++;
                if (isTelecomTx(tx)) {
                    totalSdad += tx.amount;
                } else if (isDepositTx(tx)) {
                    totalDeposit += tx.amount;
                } else if (isNetworksTx(tx)) {
                    totalCards += tx.amount;
                }
            }
        }

        return { 
            totalSdad, 
            totalDeposit, 
            totalCards, 
            periodCount, 
            todayCount, 
            monthCount, 
            totalCount: subscriberOnly.length 
        };
    }, [transactions, dateFilter, isAdminTx]);

    if (!isUserAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-[#0048ad]" />
                <h2 className="text-lg font-black text-foreground">عذراً، هذه الصفحة للمدير فقط</h2>
                <p className="text-xs text-muted-foreground">ليس لديك صلاحية الوصول لسجل مراقبة العمليات.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950">
            <SimpleHeader title="مراقبة العمليات" />

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-28">

                {/* حقل تصفية العمليات: عمليات اليوم أو عمليات الشهر أو الكل */}
                <div className="grid grid-cols-3 gap-1.5 bg-card p-1.5 rounded-2xl border border-border/60 shadow-xs">
                    <button
                        onClick={() => setDateFilter('today')}
                        className={cn(
                            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all",
                            dateFilter === 'today'
                                ? "bg-[#0048ad] text-white shadow-xs scale-[1.02]"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-bold"
                        )}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>عمليات اليوم</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                            dateFilter === 'today' ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        )}>
                            {toEnDigits(stats.todayCount)}
                        </span>
                    </button>

                    <button
                        onClick={() => setDateFilter('month')}
                        className={cn(
                            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all",
                            dateFilter === 'month'
                                ? "bg-[#0048ad] text-white shadow-xs scale-[1.02]"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-bold"
                        )}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>عمليات الشهر</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                            dateFilter === 'month' ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        )}>
                            {toEnDigits(stats.monthCount)}
                        </span>
                    </button>

                    <button
                        onClick={() => setDateFilter('all')}
                        className={cn(
                            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black transition-all",
                            dateFilter === 'all'
                                ? "bg-[#0048ad] text-white shadow-xs scale-[1.02]"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-bold"
                        )}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        <span>كافة العمليات</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                            dateFilter === 'all' ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        )}>
                            {toEnDigits(stats.totalCount)}
                        </span>
                    </button>
                </div>

                {needsIndex && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-bold text-[11px]">لتفعيل الفهرسة السحابية التلقائية في فايربيس (نقرة واحدة):</span>
                        </div>
                        <a 
                            href="https://console.firebase.google.com/v1/r/project/studio-239662212-1b7b6/firestore/indexes?create_exemption=Cmhwcm9qZWN0cy9zdHVkaW8tMjM5NjYyMjEyLTFiN2I2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy90cmFuc2FjdGlvbnMvZmllbGRzL3RyYW5zYWN0aW9uRGF0ZRACGhMKD3RyYW5zYWN0aW9uRGF0ZRAC" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-black text-white bg-[#0048ad] hover:bg-[#00388a] px-3 py-1.5 rounded-xl shrink-0 transition-colors"
                        >
                            تفعيل الفهرس
                        </a>
                    </div>
                )}

                {/* كرت الإحصائيات الموحد بلون التطبيق الأساسي #0048ad */}
                <Card className="rounded-[28px] border-none shadow-md bg-gradient-to-br from-[#0048ad] to-[#00337c] text-white p-4 overflow-hidden relative">
                    <div className="flex items-center justify-between pb-3 border-b border-white/15">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                            </span>
                            <span className="text-xs font-black text-white">
                                {dateFilter === 'today' ? 'إحصائيات المشتركين اليوم' : dateFilter === 'month' ? 'إحصائيات المشتركين للشهر' : 'إحصائيات المشتركين الإجمالية'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-white/15 px-2.5 py-0.5 rounded-full font-mono">
                                {toEnDigits(stats.periodCount)} عملية
                            </span>
                            <button 
                                onClick={handleManualRefresh}
                                className="p-1 hover:bg-white/15 rounded-xl transition-colors text-white"
                                title="تحديث"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                            </button>
                        </div>
                    </div>

                    {/* المبالغ بالأرقام الإنجليزية ولون موحد */}
                    <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                        <div className="bg-white/10 p-2 rounded-2xl">
                            <span className="text-[10px] font-bold text-white/80 block mb-0.5">السداد والباقات</span>
                            <p className="text-sm font-black font-mono tracking-tight">
                                {formatAmount(stats.totalSdad)}
                            </p>
                            <span className="text-[9px] text-white/70 block">ر.ي</span>
                        </div>

                        <div className="bg-white/10 p-2 rounded-2xl">
                            <span className="text-[10px] font-bold text-white/80 block mb-0.5">الإيداعات والشحن</span>
                            <p className="text-sm font-black font-mono tracking-tight">
                                {formatAmount(stats.totalDeposit)}
                            </p>
                            <span className="text-[9px] text-white/70 block">ر.ي</span>
                        </div>

                        <div className="bg-white/10 p-2 rounded-2xl">
                            <span className="text-[10px] font-bold text-white/80 block mb-0.5">كروت الشبكات</span>
                            <p className="text-sm font-black font-mono tracking-tight">
                                {formatAmount(stats.totalCards)}
                            </p>
                            <span className="text-[9px] text-white/70 block">ر.ي</span>
                        </div>
                    </div>
                </Card>

                {/* حقل البحث السريع */}
                <div className="relative">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="بحث باسم العميل، الهاتف، الخدمة، الكرت..." 
                        className="h-10 pr-9 pl-9 rounded-2xl bg-card border-border/50 text-xs font-bold shadow-xs focus:ring-2 focus:ring-[#0048ad]/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')} 
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full text-muted-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* شريط التبويبات مع الكل وبلون التطبيق المعتمد */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black transition-all shrink-0 border",
                                    isActive
                                        ? "bg-[#0048ad] border-[#0048ad] text-white shadow-xs"
                                        : "bg-card border-border/60 text-muted-foreground hover:text-foreground font-bold"
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* عنوان القسم ومؤشر عدد العمليات */}
                <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-[11px] font-black text-foreground flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-[#0048ad]" />
                        <span>عمليات المشتركين ({toEnDigits(currentTabTransactions.length)})</span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                            - {TABS.find(t => t.id === activeTab)?.label}
                        </span>
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span>من الأحدث للأقدم</span>
                    </span>
                </div>

                {/* قائمة عمليات المشتركين كاملة مرتبة من الأحدث للأقدم */}
                <div className="space-y-2">
                    {isLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-18 w-full rounded-2xl" />
                            ))}
                        </div>
                    ) : currentTabTransactions.length === 0 ? (
                        <Card className="rounded-3xl border-none shadow-xs p-8 text-center bg-card space-y-2">
                            <FileText className="w-8 h-8 mx-auto text-muted-foreground/50" />
                            <p className="font-black text-xs text-foreground">لا توجد عمليات مسجلة</p>
                            <p className="text-[11px] text-muted-foreground">
                                {dateFilter === 'today' 
                                    ? `لم يتم العثور على أي عمليات للمشتركين اليوم في قسم ${TABS.find(t => t.id === activeTab)?.label}. يمكنك الضغط على "عمليات الشهر" أعلاه.`
                                    : `لم يتم العثور على أي عمليات للمشتركين في قسم ${TABS.find(t => t.id === activeTab)?.label}.`}
                            </p>
                        </Card>
                    ) : (
                        currentTabTransactions.map((tx) => {
                            const Icon = getTransactionIcon(tx.transactionType);
                            const isDeposit = isDepositTx(tx);
                            const userInfo = usersMap[tx.userId || tx._parentUserId || ''];
                            const clientDisplay = userInfo?.displayName || tx.userName || tx.subscriberName || 'مشترك';
                            const phoneDisplay = toEnDigits(userInfo?.phoneNumber || tx.userPhone || tx.recipientPhoneNumber || '');

                            return (
                                <Card 
                                    key={tx.id} 
                                    className="rounded-2xl border border-border/40 shadow-xs overflow-hidden bg-card hover:border-[#0048ad]/30 transition-all cursor-pointer active:scale-[0.99]"
                                    onClick={() => setSelectedTx(tx)}
                                >
                                    <CardContent className="p-3 flex items-center justify-between gap-3">
                                        
                                        {/* الأيقونة والتفاصيل */}
                                        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                                            <div className="p-2.5 rounded-xl shrink-0 bg-[#0048ad]/10 text-[#0048ad]">
                                                <Icon className="w-4 h-4" />
                                            </div>

                                            <div className="text-right overflow-hidden flex-1">
                                                <h4 className="font-black text-xs text-foreground truncate">
                                                    {tx.transactionType}
                                                </h4>

                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 truncate max-w-[130px]">
                                                        <UserIcon className="w-3 h-3 text-[#0048ad] shrink-0" />
                                                        <span className="truncate">{clientDisplay}</span>
                                                    </span>

                                                    {phoneDisplay && (
                                                        <span className="text-[9px] font-bold font-mono text-muted-foreground/80 bg-muted/60 px-1 rounded">
                                                            {phoneDisplay}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[9px] font-bold text-muted-foreground/75 flex items-center gap-1 mt-0.5 font-mono">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {formatTxTime(tx.transactionDate)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* المبلغ والمؤشرات بالإنجليزية */}
                                        <div className="text-left shrink-0 pl-1">
                                            <p className={cn(
                                                "font-black text-xs font-mono tracking-tight",
                                                isDeposit ? "text-emerald-600 dark:text-emerald-400" : "text-[#0048ad] dark:text-blue-400"
                                            )}>
                                                {isDeposit ? '+' : '-'} {formatAmount(tx.amount)} <span className="text-[9px] font-sans">ر.ي</span>
                                            </p>

                                            {tx.recipientPhoneNumber && (
                                                <p className="text-[9px] font-bold font-mono text-muted-foreground mt-0.5 text-left bg-muted/40 px-1 py-0.5 rounded inline-block">
                                                    {toEnDigits(tx.recipientPhoneNumber)}
                                                </p>
                                            )}

                                            {tx.cardNumber && (
                                                <p className="text-[9px] font-bold font-mono text-[#0048ad] mt-0.5 text-left">
                                                    كرت: {toEnDigits(tx.cardNumber)}
                                                </p>
                                            )}

                                            {isTelecomService(tx.transactionType) && (() => {
                                                const readiness = getReadinessDetails(tx);
                                                return (
                                                    <span className={cn("text-[8px] font-black block mt-0.5 text-left", readiness.colorClass)}>
                                                        {readiness.text}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>

            {/* نافذة تفاصيل العملية المنبثقة */}
            <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
                <DialogContent className="rounded-3xl max-w-sm p-0 overflow-hidden border-none shadow-2xl bg-card">
                    {selectedTx && (() => {
                        const isDeposit = isDepositTx(selectedTx);
                        const clientDisplay = activeClientName || selectedTx.userName || selectedTx.subscriberName || 'عميل';
                        const phoneDisplay = toEnDigits(selectedTx.userPhone || selectedTx.recipientPhoneNumber || 'غير متوفر');

                        return (
                            <>
                                <div className="p-5 text-center text-white bg-[#0048ad] relative">
                                    <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-white/20 flex items-center justify-center">
                                        <Receipt className="w-5 h-5 text-white" />
                                    </div>
                                    <DialogHeader>
                                        <DialogTitle className="text-white text-center font-black text-base">
                                            تفاصيل العملية
                                        </DialogTitle>
                                        <DialogDescription className="text-white/90 text-center text-xs font-bold mt-1">
                                            العميل: {clientDisplay}
                                        </DialogDescription>
                                    </DialogHeader>
                                </div>

                                <div className="p-5 space-y-3 text-xs max-h-[60vh] overflow-y-auto no-scrollbar" dir="rtl">
                                    
                                    <div className="bg-muted/40 p-3.5 rounded-2xl text-center space-y-0.5 border border-border/30">
                                        <span className="text-[10px] font-bold text-muted-foreground">المبلغ الإجمالي</span>
                                        <h3 className={cn(
                                            "text-xl font-black font-mono",
                                            isDeposit ? "text-emerald-600 dark:text-emerald-400" : "text-[#0048ad] dark:text-blue-400"
                                        )}>
                                            {formatAmount(selectedTx.amount)} <span className="text-xs font-sans">ريال</span>
                                        </h3>
                                    </div>

                                    <div className="space-y-2 border-y py-2.5 border-dashed">
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-[#0048ad]" /> نوع العملية:</span>
                                            <span className="font-black text-foreground">{selectedTx.transactionType}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-[#0048ad]" /> اسم العميل:</span>
                                            <span className="font-bold text-foreground">{clientDisplay}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#0048ad]" /> الهاتف:</span>
                                            <span className="font-mono font-bold text-foreground">{phoneDisplay}</span>
                                        </div>

                                        {selectedTx.recipientPhoneNumber && (
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-muted-foreground flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-[#0048ad]" /> الرقم المستهدف:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-foreground">{toEnDigits(selectedTx.recipientPhoneNumber)}</span>
                                                    <button 
                                                        onClick={() => handleCopy(selectedTx.recipientPhoneNumber!, 'الرقم')}
                                                        className="p-1 hover:bg-muted rounded text-muted-foreground"
                                                    >
                                                        {copiedField === 'الرقم' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {selectedTx.cardNumber && (
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-muted-foreground flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-[#0048ad]" /> رقم الكرت:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-[#0048ad] dark:text-blue-400">{toEnDigits(selectedTx.cardNumber)}</span>
                                                    <button 
                                                        onClick={() => handleCopy(selectedTx.cardNumber!, 'رقم الكرت')}
                                                        className="p-1 hover:bg-muted rounded text-muted-foreground"
                                                    >
                                                        {copiedField === 'رقم الكرت' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#0048ad]" /> التوقيت:</span>
                                            <span className="font-bold text-foreground font-mono">
                                                {formatTxTime(selectedTx.transactionDate)}
                                            </span>
                                        </div>

                                        {isTelecomService(selectedTx.transactionType) && (() => {
                                            const readiness = getReadinessDetails(selectedTx);
                                            return (
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-[#0048ad]" /> حالة الجاهزية:</span>
                                                    <span className={cn("font-black text-[10px] px-2 py-0.5 rounded-full border", readiness.bgClass)}>
                                                        {readiness.text}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {selectedTx.notes && (
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-muted-foreground">ملاحظات:</span>
                                            <p className="bg-muted/40 p-2.5 rounded-xl text-xs font-bold leading-relaxed text-foreground border border-border/30">
                                                {selectedTx.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter className="p-4 pt-0">
                                    <DialogClose asChild>
                                        <Button className="w-full h-10 rounded-xl font-black bg-[#0048ad] hover:bg-[#00388a] text-white">إغلاق</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            <Toaster />
        </div>
    );
}