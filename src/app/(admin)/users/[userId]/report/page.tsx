'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Phone, 
  Wallet, 
  FileText, 
  Printer, 
  Download,
  Calendar, 
  Clock, 
  Activity,
  CheckCircle2,
  Clock3,
  XCircle,
  TrendingUp,
  Percent
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isTelecomService, getReadinessDetails } from '@/lib/telecom-order';
import { TransactionDetailsModal, extractRecipientPhone, generateNumericId } from '@/components/layout/transaction-details-modal';
import { useToast } from '@/hooks/use-toast';

type UserProfile = {
  displayName: string;
  phoneNumber?: string;
  balance?: number;
  email?: string;
  role?: string;
};

type Transaction = {
  id: string;
  transactionDate: any;
  createdAt?: any;
  amount: number;
  transactionType: string;
  notes?: string;
  recipientPhoneNumber?: string;
  mobile?: string;
  phone?: string;
  subscriberName?: string;
  cardNumber?: string;
  cardPassword?: string;
  status?: string;
  readiness?: string;
  transid?: string;
  providerMessage?: string;
};

const getTransactionIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('تغذية') || t.includes('إيداع') || t.includes('استلام')) return '/icons/tadia.png';
  if (t.includes('تحويل')) return '/icons/tahwel.png';
  if (t.includes('شراء كرت')) return '/icons/shbkat.png';
  if (t.includes('سداد') || t.includes('رصيد') || t.includes('باقة')) return '/icons/rsed.png';
  if (t.includes('تجديد') || t.includes('مدفوعات') || t.includes('كهرباء') || t.includes('مياه')) return '/icons/mddfwt.png';
  if (t.includes('متجر') || t.includes('منتج')) return '/icons/slaa.png';
  if (t.includes('ألعاب') || t.includes('شدات')) return '/icons/alab.png';
  if (t.includes('سحب')) return '/icons/tahwel.png';
  return '/icons/rsed.png';
};

const safeFormatDate = (dateVal: any, formatStr: string) => {
  if (!dateVal) return 'الآن';
  try {
    const d = typeof dateVal === 'string' ? parseISO(dateVal) : new Date(dateVal);
    if (isValid(d)) {
      return format(d, formatStr, { locale: ar });
    }
  } catch (e) {}
  return 'الآن';
};

function UserReportPage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch user profile
  const userDocRef = useMemoFirebase(
    () => (firestore && userId ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userDocRef);

  // Fetch user transactions
  const transactionsQuery = useMemoFirebase(
    () => (firestore && userId ? query(collection(firestore, 'users', userId, 'transactions'), orderBy('transactionDate', 'desc')) : null),
    [firestore, userId]
  );
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const isLoading = isLoadingProfile || isLoadingTransactions;

  // فحص حالة عملية معلقة
  const handleSyncStatus = async (transid: string) => {
    if (!transid || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/payment/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transid })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: data.status === 'success' ? 'عملية ناجحة' : data.status === 'failed' ? 'عملية فاشلة' : 'تحديث الحالة',
          description: data.message
        });
        if (selectedTx && (selectedTx.id === transid || selectedTx.transid === transid)) {
          setSelectedTx(prev => prev ? {
            ...prev,
            status: data.status || prev.status,
            readiness: data.readiness || prev.readiness,
            notes: data.reason ? `${prev.notes || ''}\nالسبب: ${data.reason}` : prev.notes
          } : null);
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * تصدير وطباعة كشف الحساب الكامل بتنسيق PDF أنيق واحترافي
   * يشمل شعار ستار موبايل، بيانات العميل، جدول العمليات، إجمالي المبالغ، وعمولة العميل 2%
   */
  const handleExportPDF = () => {
    if (!transactions || !userProfile) {
      toast({ variant: 'destructive', title: 'تنبيه', description: 'لا توجد بيانات متاحة للتصدير' });
      return;
    }

    // احتساب إجمالي العمليات المسددة وعمولة العميل 2%
    const paidTxs = transactions.filter(tx => {
      const isCredit = tx.transactionType.includes('تغذية') || 
                       tx.transactionType.includes('إيداع') || 
                       tx.transactionType.includes('استلام') || 
                       tx.transactionType.includes('أرباح') || 
                       tx.transactionType.includes('استرجاع');
      return !isCredit;
    });

    const totalPaidAmount = paidTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const customerCommission = Math.round(totalPaidAmount * 0.02); // عمولة العميل 2%
    const currentBalance = userProfile.balance ?? 0;
    const nowStr = format(new Date(), 'eeee، d MMMM yyyy - h:mm a', { locale: ar });

    // بناء صفوف الجدول
    const rowsHtml = transactions.map((tx, idx) => {
      const isCredit = tx.transactionType.includes('تغذية') || 
                       tx.transactionType.includes('إيداع') || 
                       tx.transactionType.includes('استلام') || 
                       tx.transactionType.includes('أرباح') || 
                       tx.transactionType.includes('استرجاع');

      const cleanTitle = (tx.transactionType || '')
        .replace(/\s*\(?api\)?/gi, '')
        .replace(/\s*-\s*api/gi, '')
        .trim();

      const phone = extractRecipientPhone(tx);
      const readiness = getReadinessDetails(tx);
      const dateStr = safeFormatDate(tx.transactionDate || tx.createdAt, 'yyyy/MM/dd - h:mm a');

      let statusColor = '#16a34a';
      let statusBg = '#dcfce7';
      if (readiness.status === 'pending' || tx.status === 'pending') {
        statusColor = '#d97706';
        statusBg = '#fef3c7';
      } else if (readiness.status === 'failed' || tx.status === 'failed') {
        statusColor = '#dc2626';
        statusBg = '#fee2e2';
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #64748b; font-size: 11px;">${idx + 1}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 11px; color: #475569;">${dateStr}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: bold; font-size: 12px; color: #0f172a;">${cleanTitle}</td>
          <td style="padding: 10px 8px; text-align: center; font-family: monospace; font-weight: bold; font-size: 12px; color: #0284c7;">${phone || '—'}</td>
          <td style="padding: 10px 8px; text-align: left; font-weight: 900; font-size: 12px; color: ${isCredit ? '#16a34a' : '#0f172a'};">${Number(tx.amount).toLocaleString('en-US')} ر.ي</td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor}33;">
              ${readiness.text}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>كشف حساب - ${userProfile.displayName} - تطبيق ستار موبايل</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
          * { box-sizing: border-box; font-family: 'Tajawal', Tahoma, Arial, sans-serif; }
          body { margin: 0; padding: 25px; color: #0f172a; background: #fff; font-size: 12px; }
          @page { size: A4 portrait; margin: 12mm; }
          .header-table { width: 100%; border-bottom: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
          .brand-title { font-size: 24px; font-weight: 900; color: #0284c7; margin: 0; }
          .brand-subtitle { font-size: 13px; color: #64748b; font-weight: bold; margin-top: 4px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px; margin-bottom: 20px; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 2px; }
          .meta-value { font-size: 13px; font-weight: 800; color: #0f172a; }
          table.tx-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          table.tx-table th { background: #0284c7; color: #fff; padding: 10px 8px; font-size: 11px; font-weight: 800; text-align: right; }
          .summary-card { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; border-radius: 14px; padding: 18px; margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
          .summary-title { font-size: 11px; font-weight: bold; opacity: 0.9; margin-bottom: 4px; }
          .summary-number { font-size: 20px; font-weight: 900; }
          .footer-note { text-align: center; font-size: 11px; color: #94a3b8; font-weight: bold; margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <h1 class="brand-title">⭐ تطبيق ستار موبايل</h1>
              <div class="brand-subtitle">كشف حساب مالي تفصيلي موثق</div>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <div style="font-size: 11px; font-weight: bold; color: #64748b;">تاريخ ووقت الإصدار:</div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${nowStr}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">الرقم المرجعي: SM-STMT-${userId.slice(0, 8).toUpperCase()}</div>
            </td>
          </tr>
        </table>

        <div class="meta-box">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">اسم العميل:</span>
              <span class="meta-value">${userProfile.displayName || 'عميل معتمد'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">رقم الهاتف:</span>
              <span class="meta-value" style="font-family: monospace;">${userProfile.phoneNumber || 'غير مسجل'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">الرصيد الحالي:</span>
              <span class="meta-value" style="color: #0284c7;">${currentBalance.toLocaleString('en-US')} ريال</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">إجمالي العمليات:</span>
              <span class="meta-value">${transactions.length} عملية</span>
            </div>
          </div>
        </div>

        <table class="tx-table">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th style="width: 140px;">التاريخ والوقت</th>
              <th>الخدمة / العملية</th>
              <th style="width: 110px; text-align: center;">الرقم المسدد له</th>
              <th style="width: 110px; text-align: left;">المبلغ</th>
              <th style="width: 85px; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- ملخص الحساب والعمولة 2% -->
        <div class="summary-card">
          <div>
            <div class="summary-title">إجمالي المبالغ المسددة</div>
            <div class="summary-number">${totalPaidAmount.toLocaleString('en-US')} <span style="font-size: 12px; font-weight: normal;">ر.ي</span></div>
          </div>
          <div style="border-right: 1px solid rgba(255,255,255,0.25); border-left: 1px solid rgba(255,255,255,0.25);">
            <div class="summary-title">عمولة العميل المكتسبة (2%) ⭐</div>
            <div class="summary-number" style="color: #fef08a;">${customerCommission.toLocaleString('en-US')} <span style="font-size: 12px; font-weight: normal;">ر.ي</span></div>
          </div>
          <div>
            <div class="summary-title">الرصيد المتاح الحالي</div>
            <div class="summary-number">${currentBalance.toLocaleString('en-US')} <span style="font-size: 12px; font-weight: normal;">ر.ي</span></div>
          </div>
        </div>

        <div class="footer-note">
          تم إصدار هذا الكشف آلياً عبر نظام إدارة تطبيق ستار موبايل | خدمات الشحن والتسديد الفوري 💙
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'تنبيه النوافذ المنبثقة',
        description: 'يرجى السماح بالنوافذ المنبثقة لفتح كشف الحساب وتصديره كـ PDF.'
      });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 450);
  };

  const renderTransactionList = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      );
    }

    if (!transactions || transactions.length === 0) {
      return (
        <div className="text-center py-12 bg-muted/10 rounded-3xl border border-dashed border-border/50">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm font-bold text-muted-foreground">لا توجد عمليات مسجلة لهذا العميل حتى الآن.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {transactions.map((tx) => {
          const isCredit = tx.transactionType.includes('تغذية') || 
                           tx.transactionType.includes('إيداع') || 
                           tx.transactionType.includes('استلام') || 
                           tx.transactionType.includes('أرباح') || 
                           tx.transactionType.includes('استرجاع');

          const iconSrc = getTransactionIcon(tx.transactionType);
          const phone = extractRecipientPhone(tx);
          const readiness = getReadinessDetails(tx);
          const cleanTitle = (tx.transactionType || '')
            .replace(/\s*\(?api\)?/gi, '')
            .replace(/\s*-\s*api/gi, '')
            .trim();

          return (
            <Card 
              key={tx.id} 
              onClick={() => {
                setSelectedTx(tx);
                setIsModalOpen(true);
                if (isTelecomService(tx.transactionType) && (tx.status === 'pending' || tx.readiness === 'قيد الانتظار')) {
                  handleSyncStatus(tx.transid || tx.id);
                }
              }}
              className="rounded-2xl border-border/50 shadow-sm overflow-hidden bg-card cursor-pointer hover:bg-muted/40 transition-all active:scale-[0.99]"
            >
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                {/* أيقونة العملية الحديثة */}
                <div className="p-1 bg-muted/30 rounded-xl border border-border/50 shrink-0">
                  <div className="relative h-9 w-9">
                    <Image src={iconSrc} alt="Tx Icon" fill className="object-contain" priority />
                  </div>
                </div>

                {/* تفاصيل العملية */}
                <div className="flex-1 text-right overflow-hidden">
                  <p className="font-bold text-foreground text-sm truncate">{cleanTitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-muted-foreground font-semibold">
                      {safeFormatDate(tx.transactionDate || tx.createdAt, 'd MMMM yyyy - h:mm a')}
                    </p>
                    {phone && (
                      <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                        {phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* المبلغ والحالة */}
                <div className="text-left shrink-0">
                  <p className={cn("font-black text-sm sm:text-base", isCredit ? 'text-green-600' : 'text-destructive')}>
                    {tx.amount.toLocaleString('en-US')} ر.ي
                  </p>
                  <span className={cn("text-[10px] font-black block mt-0.5", readiness.colorClass)}>
                    {readiness.text}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full bg-background" dir="rtl">
      <SimpleHeader title={userProfile ? `كشف حساب: ${userProfile.displayName}` : 'تحميل التقرير...'} />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full pb-20 no-scrollbar">
        {/* كارت ملخص بيانات العميل مع زر التصدير */}
        <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                بيانات حساب العميل
              </CardTitle>

              {/* زر تصدير كشف الحساب الكامل PDF */}
              <Button
                type="button"
                onClick={handleExportPDF}
                disabled={isLoading || !transactions || transactions.length === 0}
                className="h-10 px-4 rounded-xl font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2 self-start sm:self-auto"
              >
                <Printer className="w-4 h-4" />
                <span>كشف حساب كامل (PDF)</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {isLoadingProfile ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            ) : userProfile ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-muted/30 p-3 rounded-2xl border border-border/40">
                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                    اسم العميل:
                  </span>
                  <span className="font-black text-sm text-foreground">{userProfile.displayName}</span>
                </div>

                <div className="bg-muted/30 p-3 rounded-2xl border border-border/40">
                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-1">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    رقم الهاتف:
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground">{userProfile.phoneNumber || 'غير متوفر'}</span>
                </div>

                <div className="bg-muted/30 p-3 rounded-2xl border border-border/40">
                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-1">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    الرصيد الحالي:
                  </span>
                  <span className="font-black text-base text-primary">{(userProfile.balance ?? 0).toLocaleString('en-US')} ريال</span>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">لم يتم العثور على بيانات المستخدم.</p>
            )}
          </CardContent>
        </Card>

        {/* قائمة العمليات بالتصميم الجديد الحديث */}
        <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              سجل العمليات المفصلة
            </CardTitle>
            {transactions && (
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {transactions.length} عملية
              </span>
            )}
          </CardHeader>
          <CardContent className="p-4">
            {renderTransactionList()}
          </CardContent>
        </Card>
      </div>

      {/* منبثق تفاصيل العملية المحدث */}
      <TransactionDetailsModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        transaction={selectedTx}
        onSyncStatus={handleSyncStatus}
        isSyncing={isSyncing}
      />
    </div>
  );
}

export default UserReportPage;
