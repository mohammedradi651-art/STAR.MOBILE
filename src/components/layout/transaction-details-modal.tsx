'use client';

import React from 'react';
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
import { 
  Tag, 
  Banknote, 
  Calendar, 
  Clock, 
  Activity, 
  CreditCard, 
  Copy, 
  Smartphone, 
  CheckCircle2, 
  Clock3, 
  XCircle,
  Share2,
  RefreshCw,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getReadinessDetails, isTelecomService } from '@/lib/telecom-order';

export interface TransactionModalData {
  id: string;
  transactionDate?: any;
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
}

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionModalData | null;
  onSyncStatus?: (transid: string) => Promise<void>;
  isSyncing?: boolean;
}

/**
 * دالة ذكية لاستخراج وتنسيق رقم الهاتف المسدد له
 * تبحث في الحقول المختلفة وفي نص الملاحظات كبديل
 */
export function extractRecipientPhone(tx?: TransactionModalData | null): string {
  if (!tx) return '';
  const raw = tx.recipientPhoneNumber || tx.mobile || tx.phone || '';
  if (raw && String(raw).trim().length >= 6) {
    return String(raw).trim();
  }

  // البحث في الملاحظات
  if (tx.notes) {
    const match = tx.notes.match(/(?:إلى رقم|للرقم|رقم|الجوال|الهاتف)\s*:?\s*(\b7\d{8}\b|\b0\d{7,8}\b|\b\d{9}\b)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

const generateNumericId = (id: string): string => {
  if (!id) return '000000';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString();
  if (hashStr.length >= 6) return hashStr.slice(0, 6);
  return ("000000" + hashStr).slice(-6);
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

export function TransactionDetailsModal({
  isOpen,
  onOpenChange,
  transaction,
  onSyncStatus,
  isSyncing = false
}: TransactionDetailsModalProps) {
  const { toast } = useToast();

  if (!transaction) return null;

  const phone = extractRecipientPhone(transaction);
  const readiness = getReadinessDetails(transaction);
  const transId = transaction.transid || transaction.id;
  const isFailed = readiness.status === 'failed' || transaction.status === 'failed';
  const isPending = readiness.status === 'pending' || transaction.status === 'pending';
  const isSuccess = readiness.status === 'success' || transaction.status === 'success';

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: `تم نسخ ${label} إلى الحافظة بنجاح.`
    });
  };

  const handleShareWhatsApp = () => {
    const statusText = isSuccess ? 'ناجحة ✅' : isPending ? 'قيد الانتظار ⏳' : 'فاشلة ❌';
    const dateText = safeFormatDate(transaction.transactionDate || transaction.createdAt, 'yyyy/MM/dd - h:mm a');

    let msg = `⭐ *ستار موبايل - إشعار عملية*\n`;
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `🔹 *الخدمة:* ${transaction.transactionType}\n`;
    if (phone) msg += `📱 *الرقم المسدد له:* ${phone}\n`;
    msg += `💰 *المبلغ:* ${transaction.amount.toLocaleString('en-US')} ريال\n`;
    msg += `🔖 *رقم العملية:* ${transId}\n`;
    msg += `⚡ *الحالة:* ${statusText}\n`;
    msg += `📅 *التاريخ:* ${dateText}\n`;
    if (transaction.cardNumber) {
      msg += `💳 *رقم الكرت:* ${transaction.cardNumber}\n`;
    }
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `شكراً لاستخدامك ستار موبايل 💙`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[36px] max-w-[92vw] sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden outline-none" dir="rtl">
        {/* Header Banner مع تدرج الحالة */}
        <div className={cn(
          "px-6 pt-7 pb-6 text-center relative overflow-hidden transition-all",
          isSuccess && "bg-gradient-to-b from-green-500/15 via-green-500/5 to-transparent",
          isPending && "bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent",
          isFailed && "bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent"
        )}>
          {/* أيقونة الحالة الدائرية */}
          <div className="flex justify-center mb-3">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform",
              isSuccess && "bg-green-600 text-white shadow-green-600/30",
              isPending && "bg-amber-500 text-white shadow-amber-500/30",
              isFailed && "bg-red-600 text-white shadow-red-600/30"
            )}>
              {isSuccess && <CheckCircle2 className="w-8 h-8" />}
              {isPending && <Clock3 className="w-8 h-8 animate-pulse" />}
              {isFailed && <XCircle className="w-8 h-8" />}
            </div>
          </div>

          <DialogTitle className="text-xl font-black text-foreground tracking-tight">
            تفاصيل العملية
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-bold mt-1">
            الرقم المرجعي: <span className="font-mono text-foreground">{generateNumericId(transaction.id)}</span>
          </DialogDescription>

          {/* شارة الجاهزية */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={cn(
              "font-black text-xs px-3.5 py-1 rounded-full border shadow-sm flex items-center gap-1.5",
              readiness.bgClass
            )}>
              {isSuccess && <CheckCircle2 className="w-3.5 h-3.5" />}
              {isPending && <Clock3 className="w-3.5 h-3.5 animate-spin" />}
              {isFailed && <XCircle className="w-3.5 h-3.5" />}
              {readiness.text}
            </span>

            {/* زر التحديث اللحظي للعمليات المعلقة */}
            {isPending && onSyncStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSyncStatus(transId)}
                disabled={isSyncing}
                className="h-7 px-2.5 rounded-full text-xs font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                <RefreshCw className={cn("w-3 h-3 ml-1", isSyncing && "animate-spin")} />
                {isSyncing ? 'جاري الفحص...' : 'فحص الحالة'}
              </Button>
            )}
          </div>
        </div>

        {/* تفاصيل المعاملة */}
        <div className="px-6 py-2 space-y-3.5 text-sm max-h-[60vh] overflow-y-auto no-scrollbar">
          
          {/* المبلغ المستقطع */}
          <div className="bg-muted/40 dark:bg-muted/20 p-4 rounded-2xl border border-border/50 text-center space-y-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              المبلغ المدفوع
            </span>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-2xl font-black text-foreground tracking-tight">
                {transaction.amount.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-bold text-muted-foreground">ريال يمني</span>
            </div>
          </div>

          {/* نوع الخدمة */}
          <div className="flex justify-between items-center py-2.5 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              الخدمة:
            </span>
            <span className="font-black text-foreground text-xs sm:text-sm text-left max-w-[60%]">
              {transaction.transactionType}
            </span>
          </div>

          {/* الرقم المسدد له */}
          {phone ? (
            <div className="flex justify-between items-center py-2.5 border-b border-dashed border-border/60">
              <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                الرقم المسدد له:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm tracking-widest text-foreground">
                  {phone}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(phone, 'رقم الجوال')}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                  title="نسخ الرقم"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          {/* رقم المعاملة TransID */}
          <div className="flex justify-between items-center py-2.5 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              رقم العملية:
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-foreground select-all">
                {transId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(transId, 'رقم العملية')}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                title="نسخ رقم العملية"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* التاريخ والوقت */}
          <div className="flex justify-between items-center py-2.5 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              التاريخ:
            </span>
            <span className="font-bold text-xs text-foreground">
              {safeFormatDate(transaction.transactionDate || transaction.createdAt, 'eeee، d MMMM yyyy')}
            </span>
          </div>

          <div className="flex justify-between items-center py-2.5 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              الوقت:
            </span>
            <span className="font-bold text-xs text-foreground">
              {safeFormatDate(transaction.transactionDate || transaction.createdAt, 'h:mm:ss a')}
            </span>
          </div>

          {/* تفاصيل الكرت إن وجد */}
          {transaction.cardNumber && (
            <div className="bg-muted/40 p-4 rounded-2xl border border-dashed border-primary/20 space-y-2 mt-2">
              <div className="flex items-center gap-2 text-primary text-xs font-bold">
                <CreditCard className="w-4 h-4" />
                <span>بيانات الكرت المستخرج:</span>
              </div>
              <div className="flex justify-between items-center bg-card p-3 rounded-xl border">
                <span className="text-[10px] text-muted-foreground font-bold">رقم الكرت:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base tracking-widest text-foreground">
                    {transaction.cardNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(transaction.cardNumber!, 'رقم الكرت')}
                    className="p-1 hover:bg-muted rounded text-primary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* الملاحظات الإضافية أو سبب الرفض (بدون ذكر عبارة إرجاع المبلغ) */}
          {transaction.notes && (
            <div className="pt-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">
                {isFailed ? 'سبب تعذر العملية' : 'ملاحظات العملية'}
              </p>
              <div className={cn(
                "p-3 rounded-xl text-xs font-bold leading-relaxed",
                isFailed ? "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20" : "bg-muted/40 text-foreground border border-border/50"
              )}>
                {/* تنظيف أي ذكر قديم لعبارة استرجاع المبلغ لضمان عدم ظهورها */}
                {transaction.notes
                  .replace(/تمت?\s*إعادة\s*المبلغ[^\n.]*/gi, '')
                  .replace(/تم\s*استرجاع\s*المبلغ[^\n.]*/gi, '')
                  .trim() || 'فشلت المعاملة من قبل المزود.'}
              </div>
            </div>
          )}
        </div>

        {/* أزرار الإجراءات السفلية */}
        <DialogFooter className="p-6 pt-3 grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            onClick={handleShareWhatsApp}
            variant="outline"
            className="w-full h-12 rounded-2xl font-black text-xs sm:text-sm border-primary/20 hover:bg-primary/5 text-primary flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            مشاركة واتساب
          </Button>

          <DialogClose asChild>
            <Button
              type="button"
              className="w-full h-12 rounded-2xl font-black text-xs sm:text-sm"
            >
              إغلاق
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
