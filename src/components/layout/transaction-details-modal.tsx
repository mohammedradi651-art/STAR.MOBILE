'use client';

import React, { useState } from 'react';
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
  Loader2
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
 * دالة استخراج وتنسيق رقم الهاتف المسدد له
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

export const generateNumericId = (id: string): string => {
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

/**
 * رسم سند المعاملة على Canvas بجودة عالية ومظهر ملكي
 */
function drawReceiptToCanvas(
  canvas: HTMLCanvasElement,
  data: {
    serviceName: string;
    phone?: string;
    amount: number;
    refId: string;
    status: 'success' | 'pending' | 'failed';
    dateText: string;
    timeText: string;
    notesText: string;
    cardNumber?: string;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;

  // خلفية متدرجة فخمة
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#041B3B');
  bgGrad.addColorStop(0.35, '#0B254E');
  bgGrad.addColorStop(1, '#061329');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // بطاقة السند الداخلية
  const cardX = 35;
  const cardY = 35;
  const cardW = width - 70;
  const cardH = height - 70;
  const cardR = 26;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // شريط الرأس للبطاقة
  const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  headerGrad.addColorStop(0, '#0284c7');
  headerGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = headerGrad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardW, 110, [cardR, cardR, 0, 0]);
  } else {
    ctx.rect(cardX, cardY, cardW, 110);
  }
  ctx.fill();

  // نصوص الرأس
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('ستار موبايل | STAR MOBILE', cardX + cardW / 2, cardY + 44);

  ctx.font = 'bold 15px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#E0F2FE';
  ctx.fillText('سند عملية إلكتروني معتمد', cardX + cardW / 2, cardY + 80);

  // حالة العملية
  const statusColor = data.status === 'success' ? '#16a34a' : data.status === 'pending' ? '#d97706' : '#dc2626';
  const statusBg = data.status === 'success' ? '#dcfce7' : data.status === 'pending' ? '#fef3c7' : '#fee2e2';
  const statusText = data.status === 'success' ? 'تم التسديد بنجاح ✓' : data.status === 'pending' ? 'قيد الانتظار ⏳' : 'فاشلة ✕';

  const badgeY = cardY + 145;
  ctx.fillStyle = statusBg;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX + cardW / 2 - 120, badgeY - 18, 240, 36, 18);
  } else {
    ctx.rect(cardX + cardW / 2 - 120, badgeY - 18, 240, 36);
  }
  ctx.fill();
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = statusColor;
  ctx.font = 'bold 18px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(statusText, cardX + cardW / 2, badgeY);

  // الرقم المرجعي
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(`الرقم المرجعي: ${data.refId}`, cardX + cardW / 2, badgeY + 36);

  // مربع المبلغ
  const amountBoxY = badgeY + 60;
  const amountBoxH = 95;
  const amountBoxW = cardW - 70;
  const amountBoxX = cardX + 35;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(amountBoxX, amountBoxY, amountBoxW, amountBoxH, 16);
  } else {
    ctx.rect(amountBoxX, amountBoxY, amountBoxW, amountBoxH);
  }
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('المبلغ المدفوع', cardX + cardW / 2, amountBoxY + 28);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 34px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(`${data.amount.toLocaleString('en-US')} ريال يمني`, cardX + cardW / 2, amountBoxY + 65);

  // صفوف التفاصيل
  let rowY = amountBoxY + amountBoxH + 32;
  const rowLeft = amountBoxX + 10;
  const rowRight = amountBoxX + amountBoxW - 10;

  const drawRow = (label: string, value: string, isHighlight = false) => {
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rowLeft, rowY + 12);
    ctx.lineTo(rowRight, rowY + 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(label, rowRight, rowY);

    ctx.textAlign = 'left';
    ctx.fillStyle = isHighlight ? '#0284c7' : '#1e293b';
    ctx.font = isHighlight ? 'bold 16px "Segoe UI", Tahoma, Arial, sans-serif' : '600 15px "Segoe UI", Tahoma, Arial, sans-serif';
    
    let displayVal = value;
    if (ctx.measureText(displayVal).width > 340) {
      while (ctx.measureText(displayVal + '...').width > 340 && displayVal.length > 0) {
        displayVal = displayVal.slice(0, -1);
      }
      displayVal += '...';
    }
    ctx.fillText(displayVal, rowLeft, rowY);

    rowY += 44;
  };

  drawRow('الخدمة:', data.serviceName, true);
  if (data.phone) {
    drawRow('الرقم المسدد له:', data.phone);
  }
  if (data.cardNumber) {
    drawRow('رقم الكرت:', data.cardNumber, true);
  }
  drawRow('التاريخ:', data.dateText);
  drawRow('الوقت:', data.timeText);
  drawRow('ملاحظات العملية:', data.notesText);

  // التذييل
  const footerY = cardY + cardH - 52;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 15px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('شكراً لاستخدامكم ستار موبايل 💙', cardX + cardW / 2, footerY);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('خدمات تسديد وباقات وشحن فوري على مدار الساعة', cardX + cardW / 2, footerY + 22);
}

export function TransactionDetailsModal({
  isOpen,
  onOpenChange,
  transaction,
  onSyncStatus,
  isSyncing = false
}: TransactionDetailsModalProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  if (!transaction) return null;

  const phone = extractRecipientPhone(transaction);
  const readiness = getReadinessDetails(transaction);
  const transId = transaction.transid || transaction.id;
  const isFailed = readiness.status === 'failed' || transaction.status === 'failed';
  const isPending = readiness.status === 'pending' || transaction.status === 'pending';
  const isSuccess = readiness.status === 'success' || transaction.status === 'success';

  // تنظيف اسم الخدمة من أي ذكر للـ API
  const cleanTxType = (transaction.transactionType || '')
    .replace(/\s*\(?api\)?/gi, '')
    .replace(/\s*-\s*api/gi, '')
    .trim();

  // استخراج سبب الرفض إن وجد بدون أي ذكر لاسترجاع الرصيد
  let cleanProviderReason = '';
  if (transaction.providerMessage) {
    cleanProviderReason = transaction.providerMessage;
  } else if (transaction.notes) {
    cleanProviderReason = transaction.notes;
  }
  cleanProviderReason = cleanProviderReason
    .replace(/تمت?\s*إعادة\s*المبلغ[^\n.]*/gi, '')
    .replace(/تم\s*استرجاع\s*المبلغ[^\n.]*/gi, '')
    .replace(/السبب\s*من\s*المزود\s*:\s*/gi, '')
    .replace(/السبب\s*:\s*/gi, '')
    .replace(/\s*\(?api\)?/gi, '')
    .replace(/\s*-\s*api/gi, '')
    .trim();
  if (!cleanProviderReason) cleanProviderReason = 'فشلت المعاملة من قبل المزود';

  // الملاحظات الثابتة حسب متطلبات المستخدم بدقة
  const displayNotes = isSuccess
    ? 'تم التسديد بنجاح'
    : isPending
    ? 'قيد الانتظار'
    : `فاشلة: ${cleanProviderReason}`;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: `تم نسخ ${label} إلى الحافظة بنجاح.`
    });
  };

  /**
   * توليد صورة السند ومشاركتها مباشرة كصورة عبر الواتساب أو منصات التواصل
   */
  const handleShareReceiptImage = async () => {
    if (!transaction || isSharing) return;
    setIsSharing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 750;
      canvas.height = 960;

      const refId = generateNumericId(transaction.id);
      const dateText = safeFormatDate(transaction.transactionDate || transaction.createdAt, 'yyyy/MM/dd');
      const timeText = safeFormatDate(transaction.transactionDate || transaction.createdAt, 'h:mm:ss a');

      drawReceiptToCanvas(canvas, {
        serviceName: cleanTxType,
        phone: phone || undefined,
        amount: transaction.amount,
        refId,
        status: isSuccess ? 'success' : isPending ? 'pending' : 'failed',
        dateText,
        timeText,
        notesText: displayNotes,
        cardNumber: transaction.cardNumber
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (!blob) {
        throw new Error('تعذر تجهيز صورة السند');
      }

      const fileName = `سند_ستار_موبايل_${refId}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // مشاركة أصلية للموبايل (تفتح الواتساب مع إرفاق الصورة مباشرة)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'سند عملية - ستار موبايل',
            text: `سند عملية: ${cleanTxType} بمبلغ ${transaction.amount.toLocaleString('en-US')} ريال`
          });
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // بديل للمتصفحات الأخرى: حفظ الصورة وفتح الواتساب
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "تم حفظ صورة السند",
        description: "تم تنزيل صورة السند بنجاح لإرسالها عبر الواتساب."
      });

      window.open('https://wa.me/', '_blank');
    } catch (err: any) {
      console.error('Receipt generation error:', err);
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'حدث خطأ أثناء استخراج صورة السند.'
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] max-w-[92vw] sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden outline-none" dir="rtl">
        {/* شريط الرأس المدمج والتدرج */}
        <div className={cn(
          "px-5 pt-4 pb-3 text-center relative overflow-hidden transition-all",
          isSuccess && "bg-gradient-to-b from-green-500/15 via-green-500/5 to-transparent",
          isPending && "bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent",
          isFailed && "bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent"
        )}>
          {/* أيقونة الحالة */}
          <div className="flex justify-center mb-1.5">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shadow-md transition-transform",
              isSuccess && "bg-green-600 text-white shadow-green-600/30",
              isPending && "bg-amber-500 text-white shadow-amber-500/30",
              isFailed && "bg-red-600 text-white shadow-red-600/30"
            )}>
              {isSuccess && <CheckCircle2 className="w-6 h-6" />}
              {isPending && <Clock3 className="w-6 h-6 animate-pulse" />}
              {isFailed && <XCircle className="w-6 h-6" />}
            </div>
          </div>

          <DialogTitle className="text-lg font-black text-foreground tracking-tight">
            تفاصيل العملية
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-bold mt-0.5">
            الرقم المرجعي: <span className="font-mono text-foreground">{generateNumericId(transaction.id)}</span>
          </DialogDescription>

          {/* شارة الجاهزية */}
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <span className={cn(
              "font-black text-xs px-3 py-0.5 rounded-full border shadow-sm flex items-center gap-1.5",
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
                className="h-6 px-2 rounded-full text-[11px] font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                <RefreshCw className={cn("w-3 h-3 ml-1", isSyncing && "animate-spin")} />
                {isSyncing ? 'جاري الفحص...' : 'فحص الحالة'}
              </Button>
            )}
          </div>
        </div>

        {/* تفاصيل المعاملة المدمجة */}
        <div className="px-5 py-1 space-y-2 text-xs sm:text-sm max-h-[52vh] overflow-y-auto no-scrollbar">
          
          {/* المبلغ المستقطع */}
          <div className="bg-muted/40 dark:bg-muted/20 p-2.5 rounded-xl border border-border/50 text-center space-y-0.5">
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

          {/* نوع الخدمة (نظيفة تماماً من كلمة API) */}
          <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              الخدمة:
            </span>
            <span className="font-black text-foreground text-xs sm:text-sm text-left max-w-[65%] truncate">
              {cleanTxType}
            </span>
          </div>

          {/* الرقم المسدد له إن وجد */}
          {phone ? (
            <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border/60">
              <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                الرقم المسدد له:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-xs sm:text-sm tracking-widest text-foreground">
                  {phone}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(phone, 'رقم الجوال')}
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
                  title="نسخ الرقم"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          {/* التاريخ والوقت */}
          <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              التاريخ:
            </span>
            <span className="font-bold text-xs text-foreground">
              {safeFormatDate(transaction.transactionDate || transaction.createdAt, 'eeee، d MMMM yyyy')}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-dashed border-border/60">
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
            <div className="bg-muted/40 p-3 rounded-xl border border-dashed border-primary/20 space-y-1.5 my-1">
              <div className="flex items-center gap-2 text-primary text-xs font-bold">
                <CreditCard className="w-4 h-4" />
                <span>بيانات الكرت المستخرج:</span>
              </div>
              <div className="flex justify-between items-center bg-card p-2 rounded-lg border">
                <span className="text-[10px] text-muted-foreground font-bold">رقم الكرت:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm tracking-widest text-foreground">
                    {transaction.cardNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(transaction.cardNumber!, 'رقم الكرت')}
                    className="p-1 hover:bg-muted rounded text-primary"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ملاحظات العملية بنصوص ثابتة ودقيقة */}
          <div className="pt-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">
              ملاحظات العملية
            </p>
            <div className={cn(
              "p-2.5 rounded-xl text-xs font-bold leading-relaxed",
              isSuccess && "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20",
              isPending && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
              isFailed && "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
            )}>
              {displayNotes}
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات السفلية: مشاركة وإغلاق */}
        <DialogFooter className="p-4 pt-2 grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={handleShareReceiptImage}
            disabled={isSharing}
            variant="outline"
            className="w-full h-10 rounded-xl font-black text-xs sm:text-sm border-primary/20 hover:bg-primary/5 text-primary flex items-center justify-center gap-1.5"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التجهيز...</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>مشاركة</span>
              </>
            )}
          </Button>

          <DialogClose asChild>
            <Button
              type="button"
              className="w-full h-10 rounded-xl font-black text-xs sm:text-sm"
            >
              إغلاق
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
