'use client';

import React, { useState, useMemo } from 'react';
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
  Share2,
  Calendar, 
  Clock, 
  Activity,
  CheckCircle2,
  Clock3,
  XCircle,
  Loader2
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isTelecomService, getReadinessDetails } from '@/lib/telecom-order';
import { 
  TransactionDetailsModal, 
  extractRecipientPhone, 
  getAlwadiSubscriberInfo,
  generateNumericId 
} from '@/components/layout/transaction-details-modal';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

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
  accountNumber?: string;
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

/**
 * فحص ما إذا كانت العملية مؤهلة لاحتساب عمولة 2%
 * العمليات الناجحة فقط:
 * تسديدات يمن موبايل، الاتصالات، منظومة الوادي، الألعاب، كروت الشبكات
 */
export function isEligibleForCommission(tx: Transaction): boolean {
  const status = (tx.status || '').toLowerCase().trim();
  const readiness = (tx.readiness || '').trim();

  // استبعاد أي عملية غير ناجحة
  if (status === 'failed' || readiness.includes('فاشل')) return false;
  if (status === 'pending' || readiness.includes('انتظار')) return false;

  const type = (tx.transactionType || '').toLowerCase().trim();

  // استبعاد صريح للعمليات غير المؤهلة
  if (
    type.includes('تغذية') || 
    type.includes('إيداع') || 
    type.includes('استلام') || 
    type.includes('سحب') || 
    type.includes('تحويل') || 
    type.includes('استرجاع') || 
    type.includes('أرباح')
  ) {
    return false;
  }

  const isTelecom = isTelecomService(tx.transactionType) ||
    type.includes('يمن موبايل') ||
    type.includes('سبأفون') ||
    type.includes('سبافون') ||
    type.includes('يو') ||
    type.includes('واي') ||
    type.includes('عدن نت') ||
    type.includes('فورجي') ||
    type.includes('ثابت') ||
    type.includes('adsl') ||
    type.includes('إنترنت') ||
    type.includes('هاتف') ||
    type.includes('سداد');

  const isAlwadi = type.includes('وادي') || type.includes('الوادي');
  const isGames = type.includes('ألعاب') || type.includes('العاب') || type.includes('شدات');
  const isNetworks = type.includes('شبك') || type.includes('كرت') || type.includes('وايرلس');

  return isTelecom || isAlwadi || isGames || isNetworks;
}

function UserReportPage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // خيارات التصفية: الافتراضي اليوم فقط
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'current_month' | 'custom_month'>('today');
  const [customMonth, setCustomMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));

  // جلب بيانات العميل
  const userDocRef = useMemoFirebase(
    () => (firestore && userId ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userDocRef);

  // جلب العمليات
  const transactionsQuery = useMemoFirebase(
    () => (firestore && userId ? query(collection(firestore, 'users', userId, 'transactions'), orderBy('transactionDate', 'desc')) : null),
    [firestore, userId]
  );
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const isLoading = isLoadingProfile || isLoadingTransactions;

  // تصفية العمليات حسب الفترة المحددة
  const { filteredTransactions, periodLabel } = useMemo(() => {
    if (!transactions) return { filteredTransactions: [], periodLabel: '' };

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const currentMonthStr = format(new Date(), 'yyyy-MM');

    if (filterPeriod === 'today') {
      const list = transactions.filter(tx => {
        const d = tx.transactionDate || tx.createdAt;
        if (!d) return false;
        try {
          const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
          return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === todayStr;
        } catch {
          return false;
        }
      });
      return {
        filteredTransactions: list,
        periodLabel: `اليوم (${format(new Date(), 'd MMMM yyyy', { locale: ar })})`
      };
    }

    if (filterPeriod === 'current_month') {
      const list = transactions.filter(tx => {
        const d = tx.transactionDate || tx.createdAt;
        if (!d) return false;
        try {
          const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
          return isValid(parsed) && format(parsed, 'yyyy-MM') === currentMonthStr;
        } catch {
          return false;
        }
      });
      return {
        filteredTransactions: list,
        periodLabel: `شهر ${format(new Date(), 'MMMM yyyy', { locale: ar })}`
      };
    }

    // شهر محدد
    const list = transactions.filter(tx => {
      const d = tx.transactionDate || tx.createdAt;
      if (!d) return false;
      try {
        const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
        return isValid(parsed) && format(parsed, 'yyyy-MM') === customMonth;
      } catch {
        return false;
      }
    });

    let customLabel = customMonth;
    try {
      const [y, m] = customMonth.split('-');
      const dObj = new Date(Number(y), Number(m) - 1, 1);
      customLabel = `شهر ${format(dObj, 'MMMM yyyy', { locale: ar })}`;
    } catch {}

    return {
      filteredTransactions: list,
      periodLabel: customLabel
    };
  }, [transactions, filterPeriod, customMonth]);

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
   * إنشاء ملف PDF عالي الجودة لكشف الحساب المحدد وإرساله مباشرة عبر واتساب (بدل الطباعة)
   */
  const handleSendPdfToWhatsApp = async () => {
    if (!filteredTransactions || !userProfile || isGeneratingPdf) {
      toast({ variant: 'destructive', title: 'تنبيه', description: 'لا توجد بيانات متاحة في الفترة المحددة' });
      return;
    }

    setIsGeneratingPdf(true);

    try {
      // الحسابات المالية الدقيقة
      const paidTxs = filteredTransactions.filter(tx => {
        const t = (tx.transactionType || '').toLowerCase();
        return !t.includes('تغذية') && !t.includes('إيداع') && !t.includes('استلام') && !t.includes('أرباح') && !t.includes('استرجاع');
      });
      const totalPaidAmount = paidTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const eligibleTxs = filteredTransactions.filter(isEligibleForCommission);
      const totalEligibleAmount = eligibleTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const customerCommission = Math.round(totalEligibleAmount * 0.02); // 2% فقط من المؤهلة
      const currentBalance = userProfile.balance ?? 0;

      // إنشاء Canvas بجودة A4 عالية (1200 x 1700)
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1700;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('تعذر تجهيز لوحة الرسم');

      // خلفية بيضاء نقية
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ترويسة التقرير بأزرق ستار موبايل الأصلي
      const topBarH = 140;
      ctx.fillStyle = '#1b52a4';
      ctx.fillRect(0, 0, canvas.width, topBarH);

      // تحميل الشعار ورسمه
      try {
        const logoImg = new window.Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
          logoImg.src = '/logo.jpeg';
        });
        if (logoImg.width) {
          ctx.drawImage(logoImg, 40, 20, 100, 100);
        }
      } catch (e) {}

      // نصوص الترويسة بدون إيموجي
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px "Almarai", Tahoma, Arial, sans-serif';
      ctx.fillText('تطبيق ستار موبايل', canvas.width - 50, 60);

      ctx.font = 'bold 18px "Almarai", Tahoma, Arial, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('كشف حساب مالي تفصيلي معتمد', canvas.width - 50, 100);

      // صندوق بيانات العميل
      const metaBoxY = topBarH + 30;
      const metaBoxH = 110;
      const metaBoxW = canvas.width - 80;
      const metaBoxX = 40;

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, 16);
      else ctx.rect(metaBoxX, metaBoxY, metaBoxW, metaBoxH);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const colW = metaBoxW / 4;
      const drawMeta = (idx: number, label: string, val: string, isBlue = false) => {
        const cx = metaBoxX + metaBoxW - (idx * colW) - (colW / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(label, cx, metaBoxY + 40);

        ctx.fillStyle = isBlue ? '#1b52a4' : '#0f172a';
        ctx.font = 'bold 18px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(val, cx, metaBoxY + 75);
      };

      drawMeta(0, 'اسم العميل', userProfile.displayName || 'عميل');
      drawMeta(1, 'رقم الهاتف', userProfile.phoneNumber || 'غير مسجل');
      drawMeta(2, 'الرصيد المتاح', `${currentBalance.toLocaleString('en-US')} ر.ي`, true);
      drawMeta(3, 'الفترة المحددة', periodLabel);

      // جدول العمليات
      const tableY = metaBoxY + metaBoxH + 30;
      const tableW = canvas.width - 80;
      const tableX = 40;
      const thH = 46;

      ctx.fillStyle = '#1b52a4';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tableX, tableY, tableW, thH, [12, 12, 0, 0]);
      else ctx.rect(tableX, tableY, tableW, thH);
      ctx.fill();

      // عناوين الجدول
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px "Almarai", Tahoma, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('#', tableX + tableW - 30, tableY + 26);
      ctx.textAlign = 'right';
      ctx.fillText('التاريخ والوقت', tableX + tableW - 220, tableY + 26);
      ctx.fillText('الخدمة والعملية / المشترك', tableX + tableW - 600, tableY + 26);
      ctx.textAlign = 'center';
      ctx.fillText('الرقم / الكرت', tableX + tableW - 830, tableY + 26);
      ctx.fillText('المبلغ (ر.ي)', tableX + tableW - 980, tableY + 26);
      ctx.fillText('الحالة', tableX + 60, tableY + 26);

      // صفوف العمليات
      let currentY = tableY + thH;
      const rowH = 48;
      const maxRows = Math.min(filteredTransactions.length, 18);

      for (let i = 0; i < maxRows; i++) {
        const tx = filteredTransactions[i];
        const isEven = i % 2 === 0;
        ctx.fillStyle = isEven ? '#FFFFFF' : '#f8fafc';
        ctx.fillRect(tableX, currentY, tableW, rowH);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, currentY + rowH);
        ctx.lineTo(tableX + tableW, currentY + rowH);
        ctx.stroke();

        const cleanTitle = (tx.transactionType || '')
          .replace(/\s*\(?api\)?/gi, '')
          .replace(/\s*-\s*api/gi, '')
          .trim();

        const phone = extractRecipientPhone(tx);
        const alwadiInfo = getAlwadiSubscriberInfo(tx);
        const readiness = getReadinessDetails(tx);
        const dateStr = safeFormatDate(tx.transactionDate || tx.createdAt, 'yyyy/MM/dd - h:mm a');

        // #
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 13px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(String(i + 1), tableX + tableW - 30, currentY + 28);

        // التاريخ
        ctx.textAlign = 'right';
        ctx.fillStyle = '#475569';
        ctx.font = '13px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(dateStr, tableX + tableW - 220, currentY + 28);

        // الخدمة والمشترك
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px "Almarai", Tahoma, Arial, sans-serif';
        if (alwadiInfo) {
          ctx.fillText(`${cleanTitle} (${alwadiInfo.name})`, tableX + tableW - 600, currentY + 28);
        } else {
          ctx.fillText(cleanTitle, tableX + tableW - 600, currentY + 28);
        }

        // الرقم / الكرت
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1b52a4';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(phone || alwadiInfo?.number || tx.cardNumber || '—', tableX + tableW - 830, currentY + 28);

        // المبلغ
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 15px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(Number(tx.amount).toLocaleString('en-US'), tableX + tableW - 980, currentY + 28);

        // الحالة
        ctx.font = 'bold 12px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillStyle = readiness.status === 'success' ? '#16a34a' : readiness.status === 'pending' ? '#d97706' : '#dc2626';
        ctx.fillText(readiness.text, tableX + 60, currentY + 28);

        currentY += rowH;
      }

      if (filteredTransactions.length === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(tableX, currentY, tableW, 90);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 16px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText('لا توجد عمليات مسجلة في هذه الفترة المحددة', tableX + tableW / 2, currentY + 50);
        currentY += 90;
      }

      // صندوق الملخص المالي بالألوان الرسمية وحساب العمولة 2%
      const summaryY = Math.max(currentY + 24, canvas.height - 240);
      const summaryH = 120;
      const summaryW = canvas.width - 80;
      const summaryX = 40;

      const sumGrad = ctx.createLinearGradient(summaryX, summaryY, summaryX + summaryW, summaryY);
      sumGrad.addColorStop(0, '#0f3875');
      sumGrad.addColorStop(1, '#1b52a4');
      ctx.fillStyle = sumGrad;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(summaryX, summaryY, summaryW, summaryH, 16);
      else ctx.rect(summaryX, summaryY, summaryW, summaryH);
      ctx.fill();

      const sumColW = summaryW / 4;
      const drawSummaryItem = (idx: number, title: string, numStr: string, isYellow = false) => {
        const cx = summaryX + summaryW - (idx * sumColW) - (sumColW / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 13px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(title, cx, summaryY + 45);

        ctx.fillStyle = isYellow ? '#FEF08A' : '#FFFFFF';
        ctx.font = '900 24px "Almarai", Tahoma, Arial, sans-serif';
        ctx.fillText(numStr, cx, summaryY + 85);
      };

      drawSummaryItem(0, 'إجمالي المبالغ المسددة', `${totalPaidAmount.toLocaleString('en-US')} ر.ي`);
      drawSummaryItem(1, 'المبالغ المؤهلة للعمولة', `${totalEligibleAmount.toLocaleString('en-US')} ر.ي`);
      drawSummaryItem(2, 'عمولة العميل المعتمدة (2%)', `${customerCommission.toLocaleString('en-US')} ر.ي`, true);
      drawSummaryItem(3, 'الرصيد المتاح الحالي', `${currentBalance.toLocaleString('en-US')} ر.ي`);

      // تذييل الصفحة
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px "Almarai", Tahoma, Arial, sans-serif';
      ctx.fillText('تم إصدار هذا الكشف آلياً عبر نظام إدارة تطبيق ستار موبايل لخدمات الاتصالات والمدفوعات الإلكترونية', canvas.width / 2, canvas.height - 40);

      // توليد ملف الـ PDF بواسطة jsPDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      const pdfBlob = pdf.output('blob');

      const fileName = `كشف_حساب_${(userProfile.displayName || 'العميل').replace(/\s+/g, '_')}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // فتح واتساب مباشرة لإرسال ملف الـ PDF
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `كشف حساب - ${userProfile.displayName}`,
            text: `كشف حساب مالي للعميل ${userProfile.displayName} عن ${periodLabel}`
          });
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // بديل للمتصفحات الأخرى: تنزيل الـ PDF وفتح محادثة واتساب العميل مباشرة
      const fileUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(fileUrl);

      const rawPhone = (userProfile.phoneNumber || '').replace(/\D/g, '').slice(-9);
      const waMsg = encodeURIComponent(
        `مرحباً ${userProfile.displayName}،\nمرفق لكم كشف الحساب المالي من تطبيق ستار موبايل عن ${periodLabel}.\nالرصيد المتاح: ${currentBalance.toLocaleString('en-US')} ريال.`
      );
      const waUrl = rawPhone ? `https://wa.me/967${rawPhone}?text=${waMsg}` : `https://web.whatsapp.com/send?text=${waMsg}`;
      window.open(waUrl, '_blank');

      toast({
        title: "تم استخراج ملف الـ PDF",
        description: "تم تجهيز ملف كشف الحساب وفتح واتساب لإرساله للعميل مباشرة."
      });
    } catch (err: any) {
      console.error('PDF WhatsApp share error:', err);
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'حدث خطأ أثناء استخراج ملف الـ PDF.'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // قائمة العمليات المعروضة في شريط أكبر ارتفاعاً ومريحاً
  const renderTransactionList = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      );
    }

    if (!filteredTransactions || filteredTransactions.length === 0) {
      return (
        <div className="text-center py-12 bg-muted/10 rounded-3xl border border-dashed border-border/50">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            لا توجد عمليات مسجلة في {periodLabel}.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredTransactions.map((tx) => {
          const isCredit = tx.transactionType.includes('تغذية') || 
                           tx.transactionType.includes('إيداع') || 
                           tx.transactionType.includes('استلام') || 
                           tx.transactionType.includes('أرباح') || 
                           tx.transactionType.includes('استرجاع');

          const iconSrc = getTransactionIcon(tx.transactionType);
          const phone = extractRecipientPhone(tx);
          const alwadiInfo = getAlwadiSubscriberInfo(tx);
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
              className="rounded-2xl border-border/50 shadow-sm overflow-hidden bg-card cursor-pointer hover:bg-muted/30 transition-all active:scale-[0.99] min-h-[84px] flex items-center"
            >
              <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4 w-full">
                {/* الأيقونة بحجم مناسب ومريح */}
                <div className="p-2 bg-muted/40 rounded-2xl border border-border/50 shrink-0">
                  <div className="relative h-10 w-10">
                    <Image src={iconSrc} alt="Tx Icon" fill className="object-contain" priority />
                  </div>
                </div>

                {/* تفاصيل العملية وسطر المشترك لمنظومة الوادي */}
                <div className="flex-1 text-right overflow-hidden space-y-1">
                  <p className="font-black text-foreground text-sm sm:text-base truncate">{cleanTitle}</p>
                  
                  {/* سطر المشترك لمنظومة الوادي (اسمه ورقمه) */}
                  {alwadiInfo && (
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#1b52a4]">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span>المشترك: {alwadiInfo.display}</span>
                    </div>
                  )}

                  {/* التاريخ ورقم الهاتف المسدد له */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {safeFormatDate(tx.transactionDate || tx.createdAt, 'd MMMM yyyy - h:mm a')}
                    </span>
                    {phone && (
                      <span className="text-[11px] font-mono font-bold text-[#1b52a4] bg-[#1b52a4]/10 px-2 py-0.5 rounded-md">
                        {phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* المبلغ والحالة */}
                <div className="text-left shrink-0 space-y-1">
                  <p className={cn("font-black text-base sm:text-lg", isCredit ? 'text-green-600' : 'text-foreground')}>
                    {Number(tx.amount).toLocaleString('en-US')} ر.ي
                  </p>
                  <span className={cn("text-xs font-bold block", readiness.colorClass)}>
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
        {/* كارت ملخص بيانات العميل مع زر إرسال PDF عبر واتساب مباشرة */}
        <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-[#1b52a4]" />
                بيانات حساب العميل
              </CardTitle>

              {/* زر إرسال كشف حساب PDF عبر واتساب مباشرة بدلاً من الطباعة */}
              <Button
                type="button"
                onClick={handleSendPdfToWhatsApp}
                disabled={isLoading || isGeneratingPdf || !filteredTransactions || filteredTransactions.length === 0}
                className="h-11 px-4 rounded-xl font-black text-xs sm:text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-sm flex items-center gap-2 self-start sm:self-auto"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تجهيز PDF...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>إرسال كشف PDF عبر واتساب</span>
                  </>
                )}
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
                    <User className="h-3.5 w-3.5 text-[#1b52a4]" />
                    اسم العميل:
                  </span>
                  <span className="font-black text-sm text-foreground">{userProfile.displayName}</span>
                </div>

                <div className="bg-muted/30 p-3 rounded-2xl border border-border/40">
                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-1">
                    <Phone className="h-3.5 w-3.5 text-[#1b52a4]" />
                    رقم الهاتف:
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground">{userProfile.phoneNumber || 'غير متوفر'}</span>
                </div>

                <div className="bg-muted/30 p-3 rounded-2xl border border-border/40">
                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-1">
                    <Wallet className="h-3.5 w-3.5 text-[#1b52a4]" />
                    الرصيد الحالي:
                  </span>
                  <span className="font-black text-base text-[#1b52a4]">{(userProfile.balance ?? 0).toLocaleString('en-US')} ريال</span>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">لم يتم العثور على بيانات المستخدم.</p>
            )}
          </CardContent>
        </Card>

        {/* شريط الفلترة الزمنية: اليوم (الافتراضي) - الشهر الحالي - اختيار شهر آخر */}
        <div className="bg-card p-3 rounded-2xl border border-border/50 shadow-sm space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
              <Button
                type="button"
                size="sm"
                variant={filterPeriod === 'today' ? 'default' : 'ghost'}
                onClick={() => setFilterPeriod('today')}
                className={cn(
                  "h-8 px-4 rounded-lg text-xs font-bold transition-all",
                  filterPeriod === 'today' ? "bg-[#1b52a4] hover:bg-[#16468e] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                اليوم
              </Button>

              <Button
                type="button"
                size="sm"
                variant={filterPeriod === 'current_month' ? 'default' : 'ghost'}
                onClick={() => setFilterPeriod('current_month')}
                className={cn(
                  "h-8 px-4 rounded-lg text-xs font-bold transition-all",
                  filterPeriod === 'current_month' ? "bg-[#1b52a4] hover:bg-[#16468e] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                الشهر الحالي
              </Button>

              <Button
                type="button"
                size="sm"
                variant={filterPeriod === 'custom_month' ? 'default' : 'ghost'}
                onClick={() => setFilterPeriod('custom_month')}
                className={cn(
                  "h-8 px-4 rounded-lg text-xs font-bold transition-all",
                  filterPeriod === 'custom_month' ? "bg-[#1b52a4] hover:bg-[#16468e] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                اختيار شهر آخر
              </Button>
            </div>

            {filterPeriod === 'custom_month' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">تحديد الشهر:</span>
                <input
                  type="month"
                  value={customMonth}
                  onChange={(e) => setCustomMonth(e.target.value)}
                  className="h-8 px-2.5 text-xs font-bold rounded-lg border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-[#1b52a4]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1 border-t border-border/40 font-semibold">
            <span>الفترة المعروضة: <strong className="text-foreground">{periodLabel}</strong></span>
            <span>عدد العمليات: <strong className="text-foreground">{filteredTransactions.length} عملية</strong></span>
          </div>
        </div>

        {/* قائمة العمليات بشريط أكبر ارتفاعاً ومريحاً */}
        <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#1b52a4]" />
              سجل العمليات
            </CardTitle>
            <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {filteredTransactions.length} عملية في {filterPeriod === 'today' ? 'اليوم' : 'الفترة'}
            </span>
          </CardHeader>
          <CardContent className="p-4">
            {renderTransactionList()}
          </CardContent>
        </Card>
      </div>

      {/* منبثق تفاصيل العملية المحدث المطابق 100% */}
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
