'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, updateDoc, increment, query, orderBy, writeBatch, setDoc, getDocs } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, useDoc, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  User as UserIcon,
  Users,
  Search,
  Trash2,
  Edit,
  PlusCircle,
  Crown,
  Wallet,
  Banknote,
  FileText,
  LayoutGrid,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
  MapPin,
  Percent,
  Smartphone,
  Wifi,
  SatelliteDish,
  Gamepad2,
  ListTodo,
  Loader2,
  Calendar,
  CheckCircle2,
  UserPlus,
  Coins,
  History as HistoryIcon,
  Key,
  Copy,
  XCircle,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type User = {
  id: string;
  displayName: string;
  phoneNumber?: string;
  balance?: number;
  accountType?: 'user' | 'network-owner';
  registrationDate?: string;
  location?: string;
  alwadiDiscount?: number;
  networksDiscount?: number;
  telecomDiscount?: number;
  gamesDiscount?: number;
  apiKey?: string;
  email?: string;
};

type AppSettings = {
    boxBalance?: number;
    totalDebts?: number;
};

type ClientDebt = {
  id: string;
  debtorName: string;
  amount: number;
  timestamp: string;
};

const filterOptions = [
    { label: 'الكل', value: 'all', icon: LayoutGrid },
    { label: 'لديه رصيد', value: 'with-balance', icon: Wallet },
    { label: 'مستخدمون', value: 'user', icon: UserIcon },
    { label: 'ملاك شبكات', value: 'network-owner', icon: Crown },
];

export default function UsersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'user' | 'with-balance' | 'network-owner'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [isManualDepositOpen, setIsManualDepositOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingPhoneNumber, setEditingPhoneNumber] = useState('');
  
  // API Key States
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // Debts States
  const [isDebtsListOpen, setIsDebtsListOpen] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState('');
  const [newDebtAmount, setNewDebtsAmount] = useState('');
  const [isAddingDebt, setIsAddingDebt] = useState(false);
  const [isClearingDebts, setIsClearingDebts] = useState(false);

  // Discount States
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discounts, setDiscounts] = useState({
    alwadi: 0,
    networks: 0,
    telecom: 0,
    games: 0
  });

  const [agentBalance, setAgentBalance] = useState<string | null>(null);
  const [baityBalance, setBaityBalance] = useState<string | null>(null);
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);

  const [isBoxEditingOpen, setIsBoxEditingOpen] = useState(false);
  const [newBoxValue, setNewBoxValue] = useState('');

  const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

  const usersCollection = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), orderBy('registrationDate', 'desc')) : null),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<User>(usersCollection);

  const adminUser = useMemo(() => {
    return users?.find(u => u.email === '770326828@shabakat.com' || u.id === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2');
  }, [users]);

  const debtsCollection = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'clientDebts'), orderBy('timestamp', 'desc')) : null),
    [firestore]
  );
  const { data: clientDebts, isLoading: isLoadingDebts } = useCollection<ClientDebt>(debtsCollection);

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'appSettings', 'global') : null),
    [firestore]
  );
  const { data: appSettings } = useDoc<AppSettings>(settingsDocRef);

  const boxBalance = appSettings?.boxBalance ?? 0;
  const totalDebts = appSettings?.totalDebts ?? 0;

  const totalUsersBalance = useMemo(() => {
    if (!users) return 0;
    return users.reduce((acc, user) => {
      if (user.phoneNumber === '770326828') return acc;
      return acc + (user.balance ?? 0);
    }, 0);
  }, [users]);

  const fetchAllBalances = useCallback(async () => {
    if (!isUserAdmin) return;
    setIsFetchingBalances(true);
    try {
      const transid = Date.now().toString().slice(-8);
      
      const telecomPromise = fetch('/api/telecom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'balance',
            mobile: '770326828',
            transid: transid,
        })
      }).then(res => res.json());

      const baityPromise = fetch('/api/baitynet/balance').then(res => res.json());

      const [telecomResult, baityResult] = await Promise.all([telecomPromise, baityPromise]);
      
      if (telecomResult && (telecomResult.resultCode === "0" || telecomResult.resultCode === 0) && telecomResult.balance !== undefined) {
        setAgentBalance(String(telecomResult.balance));
      } else {
        setAgentBalance('خطأ');
      }

      if (baityResult && baityResult.status === 200 && baityResult.data) {
        setBaityBalance(String(baityResult.data.balance || '0'));
      } else {
        setBaityBalance('خطأ');
      }

    } catch (e) {
      setAgentBalance('خطأ');
      setBaityBalance('خطأ');
      console.error("Agent Balances Fetch Failed:", e);
    } finally {
      setIsFetchingBalances(false);
    }
  }, [isUserAdmin]);

  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  const combinedProvidersBalance = useMemo(() => {
    const agent = parseFloat(agentBalance || '0');
    const baity = parseFloat(baityBalance || '0');
    const box = boxBalance;
    const debts = totalDebts;
    
    const safeAgent = isNaN(agent) ? 0 : agent;
    const safeBaity = isNaN(baity) ? 0 : baity;
    
    return safeAgent + safeBaity + box + debts;
  }, [agentBalance, baityBalance, boxBalance, totalDebts]);

  const netProfit = useMemo(() => {
    return combinedProvidersBalance - totalUsersBalance;
  }, [combinedProvidersBalance, totalUsersBalance]);
  
  const handleDelete = (userId: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', userId);
    deleteDocumentNonBlocking(userDocRef);
    toast({ title: "نجاح", description: "تم حذف المستخدم بنجاح." });
  };

  const handleTopUp = async () => {
    if (!selectedUser || !topUpAmount || !firestore) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;
  
    const userDocRef = doc(firestore, 'users', selectedUser.id);
    const userNotificationsRef = collection(firestore, 'users', selectedUser.id, 'notifications');
    
    updateDocumentNonBlocking(userDocRef, { balance: increment(amount) });
    addDocumentNonBlocking(userNotificationsRef, {
      title: 'تمت تغذية حسابك',
      body: `تمت إضافة مبلغ ${amount.toLocaleString('en-US')} ريال إلى رصيدك.`,
      timestamp: new Date().toISOString()
    });

    // إرسال واتساب تلقائي
    if (selectedUser.phoneNumber) {
        const newBalance = (selectedUser.balance || 0) + amount;
        const waMsg = `⭐ ستار موبايل\n\nمرحباً ${selectedUser.displayName}\n\nتم شحن رصيدك بنجاح ✅\n\nالمبلغ المضاف: ${amount.toLocaleString('en-US')} ر.ي\nرصيدك الجديد: ${newBalance.toLocaleString('en-US')} ر.ي\n\nشكراً لثقتك بنا 💙`;
        
        await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: selectedUser.phoneNumber,
                message: waMsg
            })
        }).catch(e => console.error("WhatsApp Notification Error", e));
    }

    toast({ title: "نجاح", description: `تمت إضافة الرصيد بنجاح.` });
    setIsTopUpDialogOpen(false);
    setTopUpAmount('');
  };
  
  const handleManualDeposit = async () => {
    if (!selectedUser || !topUpAmount || !firestore || !selectedUser.phoneNumber) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;

    const userDocRef = doc(firestore, 'users', selectedUser.id);
    const userTransactionsRef = collection(firestore, 'users', selectedUser.id, 'transactions');

    updateDocumentNonBlocking(userDocRef, { balance: increment(amount) });
    addDocumentNonBlocking(userTransactionsRef, {
        userId: selectedUser.id,
        transactionDate: new Date().toISOString(),
        amount: amount,
        transactionType: 'إيداع رصيد',
        notes: 'إيداع من الإدارة',
    });

    const newBalance = (selectedUser.balance ?? 0) + amount;
    const smsMessage = `ستار موبايل: تم إيداع (${amount.toLocaleString('en-US')}) ريال لحسابك. رصيدك الآن: (${newBalance.toLocaleString('en-US')}) ريال.`;
    
    // إرسال SMS
    fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phoneNumber: selectedUser.phoneNumber,
            message: smsMessage
        })
    }).catch(() => console.error("SMS Error"));

    // إرسال واتساب
    const waMsg = `⭐ ستار موبايل\n\nمرحباً ${selectedUser.displayName}\n\nتم شحن رصيدك بنجاح ✅\n\nالمبلغ المضاف: ${amount.toLocaleString('en-US')} ر.ي\nرصيدك الجديد: ${newBalance.toLocaleString('en-US')} ر.ي\n\nشكراً لثقتك بنا 💙`;
    await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phone: selectedUser.phoneNumber,
            message: waMsg
        })
    }).catch(e => console.error("WhatsApp Error", e));

    toast({ title: 'نجاح', description: 'تم الإيداع وإرسال الإشعارات للعميل.' });
    setIsManualDepositOpen(false);
    setTopUpAmount('');
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditingName(user.displayName);
    setEditingPhoneNumber(user.phoneNumber || '');
    setIsEditDialogOpen(true);
  };

  const handleApiKeyClick = (user: User) => {
      setSelectedUser(user);
      setTempApiKey(user.apiKey || '');
      setIsApiKeyDialogOpen(true);
  };

  const generateApiKey = () => {
    const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setTempApiKey(`star_${randomStr}`);
  };

  const handleClearTempApiKey = () => {
    setTempApiKey('');
  };

  const handleSaveApiKey = () => {
    if (!selectedUser || !firestore) return;
    const docRef = doc(firestore, 'users', selectedUser.id);
    updateDocumentNonBlocking(docRef, { apiKey: tempApiKey });
    
    if (tempApiKey) {
        toast({ title: "تم الحفظ", description: "تم تفعيل مفتاح الربط بنجاح." });
    } else {
        toast({ title: "تم الحذف", description: "تم تعطيل مفتاح الربط لهذا العميل." });
    }
    setIsApiKeyDialogOpen(false);
  };

  const handleDiscountClick = (user: User) => {
    setSelectedUser(user);
    setDiscounts({
        alwadi: user.alwadiDiscount || 0,
        networks: user.networksDiscount || 0,
        telecom: user.telecomDiscount || 0,
        games: user.gamesDiscount || 0
    });
    setIsDiscountDialogOpen(true);
  };

  const handleSaveDiscounts = () => {
    if (!selectedUser || !firestore) return;
    const docRef = doc(firestore, 'users', selectedUser.id);
    updateDocumentNonBlocking(docRef, {
        alwadiDiscount: Number(discounts.alwadi),
        networksDiscount: Number(discounts.networks),
        telecomDiscount: Number(discounts.telecom),
        gamesDiscount: Number(discounts.games)
    });
    toast({ title: "تم الحفظ", description: "تم تحديث خصومات المستخدم بنجاح." });
    setIsDiscountDialogOpen(false);
  };
  
  const handleSaveChanges = () => {
    if (!editingUser || !firestore) return;
    const docRef = doc(firestore, 'users', editingUser.id);
    updateDocumentNonBlocking(docRef, { displayName: editingName, phoneNumber: editingPhoneNumber });
    toast({ title: "نجاح", description: "تم تحديث المعلومات." });
    setIsEditDialogOpen(false);
  };

  const handleWithdraw = () => {
    if (!selectedUser || !withdrawAmount || !firestore) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0 || (selectedUser.balance ?? 0) < amount) return;
  
    const userRef = doc(firestore, 'users', selectedUser.id);
    const txCol = collection(firestore, 'users', selectedUser.id, 'transactions');

    updateDocumentNonBlocking(userRef, { balance: increment(-amount) });
    addDocumentNonBlocking(txCol, {
        userId: selectedUser.id,
        transactionDate: new Date().toISOString(),
        amount: amount,
        transactionType: 'سحب نقدي',
        notes: 'سحب نقدي من الإدارة',
    });

    toast({ title: "نجاح", description: `تم السحب بنجاح.` });
    setIsWithdrawDialogOpen(false);
    setWithdrawAmount('');
  };

  const handleSaveBoxBalance = () => {
    if (!firestore || !settingsDocRef) return;
    const val = parseFloat(newBoxValue);
    if (isNaN(val)) return;

    setDocumentNonBlocking(settingsDocRef, { boxBalance: val }, { merge: true });
    toast({ title: "تم التحديث", description: "تم تحديث مبلغ الصندوق بنجاح." });
    setIsBoxEditingOpen(false);
  };

  // Debts Management Logic
  const handleAddClientDebt = () => {
    if (!firestore || !newDebtorName || !newDebtAmount || !settingsDocRef) return;
    const amt = parseFloat(newDebtAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsAddingDebt(true);
    const debtCol = collection(firestore, 'clientDebts');
    
    addDocumentNonBlocking(debtCol, {
        debtorName: newDebtorName,
        amount: amt,
        timestamp: new Date().toISOString()
    });

    updateDocumentNonBlocking(settingsDocRef, { totalDebts: increment(amt) });

    toast({ title: "تمت الإضافة", description: `تم تسجيل دين على ${newDebtorName}.` });
    setNewDebtorName('');
    setNewDebtsAmount('');
    setIsAddingDebt(false);
  };

  const handleDeleteDebt = (debt: ClientDebt) => {
    if (!firestore || !settingsDocRef) return;
    const docRef = doc(firestore, 'clientDebts', debt.id);
    deleteDocumentNonBlocking(docRef);
    updateDocumentNonBlocking(settingsDocRef, { totalDebts: increment(-debt.amount) });
    toast({ title: "تم الحذف", description: "تم حذف سجل الدين بنجاح." });
  };

  const handleClearAllDebts = async () => {
    if (!firestore || !settingsDocRef || !clientDebts) return;
    setIsClearingDebts(true);
    
    const batch = writeBatch(firestore);
    clientDebts.forEach(d => {
        batch.delete(doc(firestore, 'clientDebts', d.id));
    });
    batch.update(settingsDocRef, { totalDebts: 0 });
    
    try {
        await batch.commit();
        toast({ title: "تم التصفير", description: "تم حذف كافة الديون وتصفير الإجمالي." });
    } catch (e) {
        toast({ variant: "destructive", title: "فشل التصفير" });
    } finally {
        setIsClearingDebts(false);
    }
  };

  const filteredUsers = users?.filter(user => {
    const searchMatch = (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || user.phoneNumber?.includes(searchTerm));
    if (!searchMatch) return false;
    if (accountTypeFilter === 'all') return true;
    if (accountTypeFilter === 'user') return user.accountType === 'user' || !user.accountType;
    if (accountTypeFilter === 'with-balance') return (user.balance ?? 0) > 0;
    if (accountTypeFilter === 'network-owner') return user.accountType === 'network-owner';
    return true;
  });

  const formatBalanceDisplay = (val: string | null) => {
    if (val === 'خطأ' || val === null) return 'خطأ';
    const num = parseFloat(val);
    if (isNaN(num)) return 'خطأ';
    return num.toLocaleString('en-US');
  };

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="إدارة المستخدمين" />
        <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-6 no-scrollbar">
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <Card className="relative overflow-hidden border-none shadow-lg bg-mesh-gradient text-white rounded-3xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-3">
                        <CardTitle className="text-[7px] font-black opacity-80 uppercase tracking-tight">رصيد شحنلي</CardTitle>
                        <RefreshCw 
                            className={cn("h-2.5 w-2.5 opacity-50 cursor-pointer", isFetchingBalances && "animate-spin")} 
                            onClick={fetchAllBalances}
                        />
                    </CardHeader>
                    <CardContent className="px-3 pb-4">
                        <div className="flex items-baseline gap-0.5" dir="rtl">
                            <h2 className="text-lg font-black text-white truncate">
                                {isFetchingBalances ? <Skeleton className="h-4 w-12 bg-white/20" /> : formatBalanceDisplay(agentBalance)}
                            </h2>
                            <span className="text-[7px] font-bold opacity-70">ر.ي</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-green-400 to-green-600 text-white rounded-3xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-3">
                        <CardTitle className="text-[7px] font-black opacity-80 uppercase tracking-tight">رصيد بيتي</CardTitle>
                        <RefreshCw 
                            className={cn("h-2.5 w-2.5 opacity-50 cursor-pointer", isFetchingBalances && "animate-spin")} 
                            onClick={fetchAllBalances}
                        />
                    </CardHeader>
                    <CardContent className="px-3 pb-4">
                        <div className="flex items-baseline gap-0.5" dir="rtl">
                            <h2 className="text-lg font-black text-white truncate">
                                {isFetchingBalances ? <Skeleton className="h-4 w-12 bg-white/20" /> : formatBalanceDisplay(baityBalance)}
                            </h2>
                            <span className="text-[7px] font-bold opacity-70">ر.ي</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-3xl cursor-pointer" onClick={() => setIsDebtsListOpen(true)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-3">
                        <CardTitle className="text-[7px] font-black opacity-80 uppercase tracking-tight">إجمالي الديون</CardTitle>
                        <PlusCircle className="h-2.5 w-2.5 opacity-50" />
                    </CardHeader>
                    <CardContent className="px-3 pb-4">
                        <div className="flex items-baseline gap-0.5" dir="rtl">
                            <h2 className="text-lg font-black text-white truncate">
                                {totalDebts.toLocaleString('en-US')}
                            </h2>
                            <span className="text-[7px] font-bold opacity-70">ر.ي</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-md bg-muted/40 rounded-[28px] p-4 grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-500">
                <div className="space-y-1 text-right border-l border-muted-foreground/10 px-1">
                    <div className="flex items-center gap-1 mb-1">
                        <BarChart3 className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-black text-primary/80 uppercase tracking-tighter">الرصيد المجمع</span>
                    </div>
                    <div className="text-base font-black text-primary truncate" dir="rtl">
                        {isFetchingBalances ? <Skeleton className="h-4 w-12" /> : (combinedProvidersBalance).toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                        <span className="text-[8px] mr-0.5">ر.ي</span>
                    </div>
                </div>
                
                <div className="space-y-1 text-right border-l border-muted-foreground/10 px-1">
                    <div className="flex items-center gap-1 mb-1">
                        {netProfit >= 0 ? <TrendingUp className="h-3 w-3 text-green-600" /> : <TrendingDown className="h-3 w-3 text-red-600" />}
                        <span className={cn("text-[9px] font-black uppercase tracking-tighter", netProfit >= 0 ? "text-green-600/80" : "text-red-600/80")}>
                            {netProfit >= 0 ? 'الأرباح' : 'العجز'}
                        </span>
                    </div>
                    <div className={cn("text-base font-black truncate", netProfit >= 0 ? "text-green-600" : "text-red-600")} dir="rtl">
                        {Math.abs(netProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                        <span className="text-[8px] mr-0.5">ر.ي</span>
                    </div>
                </div>

                <div className="space-y-1 text-right px-1 cursor-pointer hover:bg-muted/50 transition-colors rounded-xl p-1" onClick={() => {
                    setNewBoxValue(String(boxBalance));
                    setIsBoxEditingOpen(true);
                }}>
                    <div className="flex items-center gap-1 mb-1">
                        <Wallet className="h-3 w-3 text-red-600" />
                        <span className="text-[9px] font-black text-red-600/80 uppercase tracking-tighter">الصندوق</span>
                    </div>
                    <div className="text-base font-black text-red-600 truncate" dir="rtl">
                        {boxBalance.toLocaleString('en-US')} 
                        <span className="text-[8px] mr-0.5">ر.ي</span>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card className="relative overflow-hidden border-none shadow-sm bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-black text-primary uppercase tracking-widest">إجمالي الأرصدة</CardTitle>
                    <Wallet className="h-4 w-4 text-primary opacity-50" />
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-10 w-32" /> : <div className="text-2xl font-black text-primary text-right" dir="rtl">{totalUsersBalance.toLocaleString('en-US')} <span className="text-[10px]">ر.ي</span></div>}
                </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-muted/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">المستخدمين</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground opacity-50" />
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-10 w-24" /> : <div className="text-2xl font-black text-right" dir="rtl">{(users?.length ?? 0).toLocaleString('en-US')} <span className="text-[10px]">مستخدم</span></div>}
                </CardContent>
                </Card>
            </div>

            {/* Master API Key Card for Admin */}
            {isUserAdmin && adminUser && (
                <Card className="border-none shadow-xl bg-mesh-gradient text-white rounded-[32px] overflow-hidden animate-in zoom-in-95 duration-700">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/20">
                                    <ShieldCheck className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="font-black text-base text-white">مفتاح الربط الشامل (Master API)</h3>
                            </div>
                            <Badge className="bg-green-400 text-green-900 border-none font-black text-[9px] uppercase tracking-widest h-5">Master Scope</Badge>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-black/20 rounded-2xl p-4 border border-white/10">
                                <p className="text-[10px] font-bold text-white/60 mb-2 uppercase tracking-widest">مفتاح الوصول الخاص بالبوت</p>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        readOnly 
                                        value={adminUser.apiKey || 'لا يوجد مفتاح مفعل'} 
                                        className="bg-transparent border-none font-mono text-xs font-black text-white p-0 h-auto focus-visible:ring-0 placeholder:text-white/20"
                                    />
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-white hover:bg-white/10" 
                                        onClick={() => {
                                            if (adminUser.apiKey) {
                                                navigator.clipboard.writeText(adminUser.apiKey);
                                                toast({ title: "تم النسخ" });
                                            }
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-3 opacity-80">
                                <Zap className="h-4 w-4 text-yellow-300 shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold leading-relaxed">
                                    هذا المفتاح يمنح البوت صلاحية فحص رصيد أي مشترك عبر API الرصيد باستخدام باراميتر <code className="bg-black/30 px-1 rounded">?mobile=77xxxxxxx</code>
                                </p>
                            </div>

                            <Button 
                                onClick={() => handleApiKeyClick(adminUser)}
                                className="w-full h-10 bg-white/20 hover:bg-white/30 text-white font-black text-xs border border-white/10 rounded-xl"
                            >
                                <Settings className="ml-2 h-3.5 w-3.5" />
                                إدارة المفتاح الشامل
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
          </div>
          
          <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="ابحث عن مستخدم..." 
                className="w-full pr-10 h-12 rounded-2xl bg-muted/20 border-none focus-visible:ring-primary transition-all shadow-inner" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
          </div>
          
          <div>
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 mb-3">تصفية المستخدمين</h3>
            <div className="grid grid-cols-2 gap-3">
                {filterOptions.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setAccountTypeFilter(opt.value as any)}
                        className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 gap-2",
                            accountTypeFilter === opt.value
                                ? "border-primary bg-primary/5 text-primary shadow-sm scale-[1.02]"
                                : "border-transparent bg-card text-muted-foreground hover:bg-muted/50 shadow-sm"
                        )}
                    >
                        <opt.icon className={cn("h-5 w-5", accountTypeFilter === opt.value ? "text-primary" : "text-muted-foreground/60")} />
                        <span className="text-[11px] font-black">{opt.label}</span>
                    </button>
                ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1 mb-1">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest">النتائج ({filteredUsers?.length || 0})</h3>
            </div>
            {isLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-3xl" />)
            ) : filteredUsers?.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                    <Users className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-xs font-bold">لا يوجد مستخدمون مطابقون</p>
                </div>
            ) : (
                filteredUsers?.map((user) => (
                <Card key={user.id} className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-card">
                    <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/5 shadow-inner">
                                <UserIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="text-right space-y-0.5">
                                <div className='flex items-center gap-2'>
                                    <p className="font-black text-sm text-foreground">{user.displayName}</p>
                                    {user.accountType === 'network-owner' && (
                                        <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black h-4 px-1.5 rounded-md">
                                            مالك
                                        </Badge>
                                    )}
                                </div>
                                {user.location && (
                                    <p className="text-[10px] font-black text-primary/70 flex items-center gap-1">
                                        <MapPin className="h-2.5 w-2.5" />
                                        {user.location}
                                    </p>
                                )}
                                <p className="text-muted-foreground text-[10px] font-bold font-mono tracking-wider">{user.phoneNumber}</p>
                            </div>
                        </div>
                        <div className="text-primary font-black text-sm pt-1" dir="rtl">
                            {user.balance?.toLocaleString('en-US')} <span className="text-[9px] font-bold opacity-70">ر.ي</span>
                        </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-muted/50 flex items-center justify-end gap-2 flex-wrap">
                        <Link href={`/users/${user.id}/report`}>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                                <FileText className="h-4 w-4" />
                            </Button>
                        </Link>
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted/30 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[32px]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-center font-black">حذف المستخدم؟</AlertDialogTitle>
                                <AlertDialogDescription className="text-center">سيتم حذف المستخدم وبياناته نهائياً من النظام.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="grid grid-cols-2 gap-3 pt-4 sm:space-x-0">
                                <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user.id)} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                        
                        <Button variant="ghost" size="icon" onClick={() => handleApiKeyClick(user)} className="h-9 w-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all" title="مفتاح الربط API">
                            <Key className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} className="h-9 w-9 rounded-xl bg-muted/30 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                            <Edit className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" onClick={() => handleDiscountClick(user)} className="h-9 w-9 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 transition-all">
                            <Percent className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setIsWithdrawDialogOpen(true); }} className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all">
                            <Banknote className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setIsManualDepositOpen(true); }} className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                            <Wallet className="h-4 w-4" />
                        </Button>
                        <Button variant="default" size="icon" onClick={() => { setSelectedUser(user); setIsTopUpDialogOpen(true); }} className="h-9 w-9 rounded-xl shadow-lg shadow-primary/20 active:scale-90 transition-all">
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </div>
                    </CardContent>
                </Card>
                ))
            )}
          </div>
        </div>
      </div>
      <Toaster />

      {/* API Key Management Dialog */}
      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">مفتاح الربط API</DialogTitle>
                <DialogDescription className="text-center">إدارة مفتاح الربط الخارجي للمستخدم {selectedUser?.displayName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">مفتاح الربط الحالي</Label>
                    <div className="flex gap-2">
                        <Input 
                            value={tempApiKey} 
                            readOnly 
                            placeholder="لا يوجد مفتاح مفعل" 
                            className="h-12 rounded-2xl text-center font-mono font-bold text-sm bg-muted/30 border-dashed"
                        />
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl shrink-0" onClick={() => {
                            if (tempApiKey) {
                                navigator.clipboard.writeText(tempApiKey);
                                toast({ title: "تم النسخ" });
                            }
                        }}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" className="h-12 rounded-2xl font-black gap-2" onClick={generateApiKey}>
                        <RefreshCw className="h-4 w-4" />
                        توليد جديد
                    </Button>
                    <Button variant="destructive" className="h-12 rounded-2xl font-black gap-2" onClick={handleClearTempApiKey} disabled={!tempApiKey}>
                        <XCircle className="h-4 w-4" />
                        مسح المفتاح
                    </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold leading-relaxed">
                        ملاحظة: التغييرات لن تُحفظ إلا عند الضغط على "حفظ وإرسال".
                    </p>
                </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3">
                <Button onClick={handleSaveApiKey} className="w-full h-12 rounded-2xl font-black">حفظ وإرسال</Button>
                <Button variant="outline" onClick={() => setIsApiKeyDialogOpen(false)} className="w-full h-12 rounded-2xl font-black">إلغاء</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debts Comprehensive Center Dialog */}
      <Dialog open={isDebtsListOpen} onOpenChange={setIsDebtsListOpen}>
        <DialogContent className="rounded-[40px] max-sm p-0 overflow-hidden border-none shadow-2xl bg-[#F8FAFC] dark:bg-slate-950 max-h-[95vh] flex flex-col [&>button]:hidden">
            <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-8 text-center text-white relative shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <DialogHeader>
                    <div className="bg-white/20 p-4 rounded-[28px] w-20 h-20 mx-auto mb-4 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                        <Scale className="h-10 w-10 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-black text-white drop-shadow-md">سجل ديون العملاء</DialogTitle>
                    <div className="mt-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full inline-flex items-center gap-2 border border-white/20">
                        <Coins className="w-3.5 h-3.5" />
                        <p className="text-xs font-black" dir="rtl">{totalDebts.toLocaleString('en-US')} ر.ي</p>
                    </div>
                </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar bg-white dark:bg-slate-950 rounded-t-[40px] -mt-6 p-6 space-y-8 relative z-10">
                
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <UserPlus className="h-4 w-4 text-orange-600" />
                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">تسجيل مديونية جديدة</h3>
                    </div>
                    <Card className="rounded-[28px] border-none shadow-md bg-[#FFF9F2] dark:bg-orange-900/10 p-5 space-y-4">
                        <div className="space-y-4">
                            <div className="relative">
                                <Input 
                                    placeholder="اسم العميل الرباعي" 
                                    value={newDebtorName} 
                                    onChange={e => setNewDebtorName(e.target.value)} 
                                    className="h-12 bg-white dark:bg-slate-900 border-none rounded-2xl pr-11 font-bold text-right shadow-sm focus-visible:ring-orange-500"
                                />
                                <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-600/50" />
                            </div>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    placeholder="المبلغ المطلوب (ر.ي)" 
                                    value={newDebtAmount} 
                                    onChange={e => setNewDebtsAmount(e.target.value)} 
                                    className="h-12 bg-white dark:bg-slate-900 border-none rounded-2xl pr-11 font-black text-center text-lg shadow-sm focus-visible:ring-orange-500"
                                />
                                <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-600/50" />
                            </div>
                            <Button 
                                onClick={handleAddClientDebt} 
                                className="w-full h-12 rounded-2xl font-black bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-500/20 transition-all active:scale-95" 
                                disabled={isAddingDebt || !newDebtorName || !newDebtAmount}
                            >
                                {isAddingDebt ? <Loader2 className="animate-spin h-5 w-5" /> : 'حفظ المديونية'}
                            </Button>
                        </div>
                    </Card>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <HistoryIcon className="h-4 w-4 text-orange-600" />
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">قائمة الديون الحالية</h3>
                        </div>
                        <Badge className="bg-orange-100 text-orange-600 border-none font-black h-5">{clientDebts?.length || 0}</Badge>
                    </div>

                    {isLoadingDebts ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-[24px]" />)}
                        </div>
                    ) : clientDebts && clientDebts.length > 0 ? (
                        <div className="space-y-3">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 rounded-xl text-[10px] font-black">
                                        <Trash2 className="w-3.5 h-3.5 ml-2" />
                                        تصفير كافة المديونيات (0)
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[32px]">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-center font-black">تصفير الديون؟</AlertDialogTitle>
                                        <AlertDialogDescription className="text-center">سيتم حذف كافة سجلات الديون المسجلة حالياً وتصفير الإجمالي. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:space-x-0">
                                        <AlertDialogAction onClick={handleClearAllDebts} className="w-full rounded-2xl h-12 bg-destructive hover:bg-destructive/90 font-bold" disabled={isClearingDebts}>
                                            {isClearingDebts ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد التصفير'}
                                        </AlertDialogAction>
                                        <AlertDialogCancel className="w-full rounded-2xl h-12 mt-0">إلغاء</AlertDialogCancel>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {clientDebts.map(debt => (
                                <Card key={debt.id} className="rounded-[24px] border-none shadow-sm bg-[#F4F7F9] dark:bg-slate-900 group hover:bg-white transition-all">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                                                <UserIcon className="h-4.5 w-4.5 text-orange-600" />
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-sm text-foreground">{debt.debtorName}</p>
                                                <div className="flex items-center gap-1.5 opacity-40">
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    <span className="text-[8px] font-bold">{format(parseISO(debt.timestamp), 'P', { locale: ar })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-left" dir="rtl">
                                                <p className="text-sm font-black text-orange-600">{debt.amount.toLocaleString()} <span className="text-[8px]">ر.ي</span></p>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteDebt(debt)}
                                                className="p-2 hover:bg-destructive/10 rounded-lg text-destructive transition-colors group-hover:opacity-100 opacity-20"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 opacity-30 flex flex-col items-center">
                            <div className="bg-muted p-5 rounded-full mb-4">
                                <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">السجل فارغ من المديونيات</p>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="p-6 bg-white dark:bg-slate-950 border-t shrink-0">
                <Button variant="outline" className="w-full h-12 rounded-2xl font-black text-foreground/70" onClick={() => setIsDebtsListOpen(false)}>إغلاق السجل</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">تعديل تسعيرة العميل</DialogTitle>
                <DialogDescription className="text-center">حدد نسبة الخصم لكل خدمة (مثال: 2 تعني خصم 2%)</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-6">
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase"><SatelliteDish className="w-3.5 h-3.5" /> منظومة الوادي (%)</Label>
                    <Input type="number" value={discounts.alwadi} onChange={e => setDiscounts({...discounts, alwadi: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl text-center text-lg font-black" />
                </div>
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase"><Wifi className="w-3.5 h-3.5" /> الشبكات (%)</Label>
                    <Input type="number" value={discounts.networks} onChange={e => setDiscounts({...discounts, networks: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl text-center text-lg font-black" />
                </div>
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase"><Smartphone className="w-3.5 h-3.5" /> الرصيد والاتصالات (%)</Label>
                    <Input type="number" value={discounts.telecom} onChange={e => setDiscounts({...discounts, telecom: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl text-center text-lg font-black" />
                </div>
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase"><Gamepad2 className="w-3.5 h-3.5" /> الألعاب وشحن الشدات (%)</Label>
                    <Input type="number" value={discounts.games} onChange={e => setDiscounts({...discounts, games: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl text-center text-lg font-black" />
                </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3">
                <Button onClick={handleSaveDiscounts} className="w-full h-12 rounded-2xl font-black">حفظ التغييرات</Button>
                <Button variant="outline" onClick={() => setIsDiscountDialogOpen(false)} className="w-full h-12 rounded-2xl font-black">إلغاء</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">تعديل بيانات المستخدم</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">الاسم الرباعي</Label>
                    <Input value={editingName} onChange={e => setEditingName(e.target.value)} placeholder="الاسم الكامل" className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">رقم الهاتف</Label>
                    <Input value={editingPhoneNumber} onChange={e => setEditingPhoneNumber(e.target.value)} placeholder="7xxxxxxxx" className="h-12 rounded-2xl" />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSaveChanges} className="w-full h-12 rounded-2xl font-black">حفظ التغييرات</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTopUpDialogOpen} onOpenChange={setIsTopUpDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">تغذية رصيد (صامتة)</DialogTitle>
                <DialogDescription className="text-center">سيتم إضافة المبلغ للرصيد مع إشعار داخلي فقط.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">المبلغ المطلوب إضافته</Label>
                <Input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl text-center text-xl font-black shadow-inner" />
            </div>
            <DialogFooter>
                <Button onClick={handleTopUp} className="w-full h-12 rounded-2xl font-black">تأكيد التغذية</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualDepositOpen} onOpenChange={setIsManualDepositOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">إيداع وتبليغ SMS تلقائي</DialogTitle>
                <DialogDescription className="text-center">سيتم إضافة المبلغ وإرسال رسالة SMS فورية لهاتف العميل.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">مبلغ الإيداع</Label>
                <Input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl text-center text-xl font-black shadow-inner" />
            </div>
            <DialogFooter>
                <Button onClick={handleManualDeposit} className="w-full h-12 rounded-2xl font-black">تأكيد وإرسال SMS</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">سحب نقدي من الرصيد</DialogTitle>
                <DialogDescription className="text-center">سيتم خصم المبلغ من رصيد المستخدم حالاً.</DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center">
                <p className="text-[10px] font-bold text-primary mb-2">الرصيد المتاح: {selectedUser?.balance?.toLocaleString()} ريال</p>
                <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">المبلغ المراد سحبه</Label>
                <Input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl text-center text-xl font-black border-destructive/20 focus-visible:ring-destructive shadow-inner" />
            </div>
            <DialogFooter>
                <Button onClick={handleWithdraw} className="w-full h-12 rounded-2xl font-black bg-destructive hover:bg-destructive/90">تأكيد السحب النقدي</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBoxEditingOpen} onOpenChange={setIsBoxEditingOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">تعديل مبلغ الصندوق</DialogTitle>
                <DialogDescription className="text-center">أدخل المبلغ الحالي المتوفر في الصندوق يدوياً.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label className="text-[10px] font-black text-muted-foreground uppercase mr-1">المبلغ الحالي</Label>
                <Input type="number" value={newBoxValue} onChange={e => setNewBoxValue(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl text-center text-xl font-black border-red-200 focus-visible:ring-red-500 shadow-inner" />
            </div>
            <DialogFooter>
                <Button onClick={handleSaveBoxBalance} className="w-full h-12 rounded-2xl font-black bg-red-600 hover:bg-red-700">تحديث المبلغ</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
