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
  Zap,
  Settings
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
  
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discounts, setDiscounts] = useState({ alwadi: 0, networks: 0, telecom: 0, games: 0 });

  const isUserAdmin = user?.email === '770326828@shabakat.com' || user?.uid === 'wsy8bUcULSYX2J9Q9WyisiFX5ki2';

  const usersCollection = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), orderBy('registrationDate', 'desc')) : null),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<User>(usersCollection);

  const getFirstLast = (name?: string) => {
    if (!name) return 'عميلنا';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
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
    const shortName = getFirstLast(selectedUser.displayName);
    const smsMessage = `ستار موبايل\nمرحباً ${shortName}،\nتم ايداع مبلغ ${amount.toLocaleString('en-US')} ريال إلى حسابك\n\nالرصيد الحالي: ${newBalance.toLocaleString('en-US')} ريال`;
    
    fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selectedUser.phoneNumber, message: smsMessage })
    }).catch(() => {});

    toast({ title: 'نجاح', description: 'تم الإيداع وإرسال الإشعار.' });
    setIsManualDepositOpen(false);
    setTopUpAmount('');
  };

  const handleSaveChanges = () => {
    if (!editingUser || !firestore) return;
    const docRef = doc(firestore, 'users', editingUser.id);
    updateDocumentNonBlocking(docRef, { displayName: editingName, phoneNumber: editingPhoneNumber });
    toast({ title: "نجاح" });
    setIsEditDialogOpen(false);
  };

  const handleDelete = (userId: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'users', userId));
    toast({ title: "نجاح" });
  };

  if (!isUserAdmin) return null;

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="إدارة المستخدمين" />
        <div className="flex-1 overflow-y-auto p-4 pb-36 space-y-6 no-scrollbar">
          <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input type="text" placeholder="بحث..." className="w-full pr-10 h-12 rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="space-y-3">
            {isLoading ? <Skeleton className="h-48 w-full rounded-3xl" /> : users?.filter(u => u.displayName.includes(searchTerm) || u.phoneNumber?.includes(searchTerm)).map((u) => (
                <Card key={u.id} className="rounded-3xl border-none shadow-sm mb-3">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl"><UserIcon className="h-5 w-5 text-primary" /></div>
                                <div>
                                    <p className="font-black text-sm">{u.displayName}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground">{u.phoneNumber}</p>
                                </div>
                            </div>
                            <div className="text-left">
                                <p className="font-black text-primary text-sm">{u.balance?.toLocaleString()} ر.ي</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="ghost" size="icon" className="rounded-xl bg-muted/30" onClick={() => { setSelectedUser(u); setIsWithdrawDialogOpen(true); }}><Banknote className="h-4 w-4 text-destructive" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-xl bg-muted/30" onClick={() => { setSelectedUser(u); setIsManualDepositOpen(true); }}><Wallet className="h-4 w-4 text-primary" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-xl bg-muted/30" onClick={() => { setEditingUser(u); setEditingName(u.displayName); setEditingPhoneNumber(u.phoneNumber || ''); setIsEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-xl bg-muted/30" onClick={() => handleDelete(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={isManualDepositOpen} onOpenChange={setIsManualDepositOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader>
                <DialogTitle className="text-center font-black">إيداع وتبليغ SMS</DialogTitle>
                <DialogDescription className="text-center">سيتم إضافة المبلغ وإرسال رسالة SMS فورية.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label className="text-[10px] font-black uppercase">مبلغ الإيداع</Label>
                <Input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="0.00" className="h-12 rounded-2xl text-center text-xl font-black" />
            </div>
            <DialogFooter><Button onClick={handleManualDeposit} className="w-full h-12 rounded-2xl font-black">تأكيد وإرسال SMS</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-[32px] max-sm p-6 [&>button]:hidden">
            <DialogHeader><DialogTitle className="text-center font-black">تعديل البيانات</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <Input value={editingName} onChange={e => setEditingName(e.target.value)} placeholder="الاسم" className="h-12 rounded-2xl" />
                <Input value={editingPhoneNumber} onChange={e => setEditingPhoneNumber(e.target.value)} placeholder="الجوال" className="h-12 rounded-2xl" />
            </div>
            <DialogFooter><Button onClick={handleSaveChanges} className="w-full h-12 rounded-2xl font-black">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  );
}
