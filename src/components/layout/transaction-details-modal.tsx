'use client';

import React, { useState, useEffect } from 'react';
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
  Loader2,
  User,
  Trash2
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
  accountNumber?: string;
}

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionModalData | null;
  onSyncStatus?: (transid: string) => Promise<void>;
  isSyncing?: boolean;
  isAdmin?: boolean;
  onActionStatus?: (status: 'success' | 'failed') => void;
  onDeleteTransaction?: (tx: TransactionModalData) => void;
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

/**
 * استخراج بيانات المشترك لمنظومة الوادي
 */
export function getAlwadiSubscriberInfo(tx?: TransactionModalData | null): { name: string; number: string; display: string } | null {
  if (!tx) return null;
  const isAlwadi = (tx.transactionType || '').includes('الوادي') || (tx.transactionType || '').includes('وادي');
  
  let name = tx.subscriberName || '';
  let num = tx.cardNumber || tx.recipientPhoneNumber || tx.phone || tx.accountNumber || '';

  if (tx.notes) {
    if (!name) {
      const nameMatch = tx.notes.match(/(?:المشترك|اسم المشترك|الاسم)\s*:?\s*([^-\n,]+)/);
      if (nameMatch && nameMatch[1]) name = nameMatch[1].trim();
    }
    if (!num) {
      const cardMatch = tx.notes.match(/(?:كرت|رقم الكرت|الكرت)\s*:?\s*([0-9a-zA-Z]+)/);
      if (cardMatch && cardMatch[1]) num = cardMatch[1].trim();
    }
  }

  if (isAlwadi || name) {
    const parts = [];
    if (name) parts.push(name);
    if (num) parts.push(`كرت: ${num}`);
    return {
      name: name || 'مشترك الوادي',
      number: num,
      display: parts.length > 0 ? parts.join(' - ') : (num ? `كرت: ${num}` : 'مشترك الوادي')
    };
  }
  return null;
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
 * رسم بطاقة السند على Canvas مطابقة لتصميم المنبثق بنسبة 100% وبجودة عالية فائقة
 */
function drawModalExactToCanvas(
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
    subscriberName?: string;
    isAlwadi?: boolean;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;   // 720
  const height = canvas.height; // 940

  // 1. خلفية خارجية ناعمة
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  // 2. بطاقة المنبثق البيضاء الرئيسية (مطابقة لمنبثق التطبيق تماماً)
  const cardX = 30;
  const cardY = 30;
  const cardW = width - 60;
  const cardH = height - 60;
  const cardR = 32;

  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 3. ترويسة المنبثق بتدرج الحالة الدقيق
  const isSuccess = data.status === 'success';
  const isPending = data.status === 'pending';
  const isFailed = data.status === 'failed';

  const gradH = 175;
  const headerGrad = ctx.createLinearGradient(0, cardY, 0, cardY + gradH);
  if (isSuccess) {
    headerGrad.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
    headerGrad.addColorStop(0.6, 'rgba(34, 197, 94, 0.05)');
    headerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  } else if (isPending) {
    headerGrad.addColorStop(0, 'rgba(245, 158, 11, 0.15)');
    headerGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.05)');
    headerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  } else {
    headerGrad.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
    headerGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.05)');
    headerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  }

  ctx.fillStyle = headerGrad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardW, gradH, [cardR, cardR, 0, 0]);
  } else {
    ctx.rect(cardX, cardY, cardW, gradH);
  }
  ctx.fill();

  // أيقونة الحالة الدائرية في المنتصف
  const iconBoxSize = 58;
  const iconX = cardX + (cardW - iconBoxSize) / 2;
  const iconY = cardY + 20;
  const iconColor = isSuccess ? '#16a34a' : isPending ? '#f59e0b' : '#dc2626';

  ctx.fillStyle = iconColor;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(iconX, iconY, iconBoxSize, iconBoxSize, 18);
  } else {
    ctx.rect(iconX, iconY, iconBoxSize, iconBoxSize);
  }
  ctx.fill();

  // رسم علامة الأيقونة داخل المربع بدقة
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (isSuccess) {
    // Checkmark
    ctx.moveTo(iconX + 16, iconY + 29);
    ctx.lineTo(iconX + 25, iconY + 39);
    ctx.lineTo(iconX + 43, iconY + 19);
  } else if (isPending) {
    // Clock
    ctx.arc(iconX + 29, iconY + 29, 14, 0, Math.PI * 2);
    ctx.moveTo(iconX + 29, iconY + 20);
    ctx.lineTo(iconX + 29, iconY + 29);
    ctx.lineTo(iconX + 36, iconY + 29);
  } else {
    // X mark
    ctx.moveTo(iconX + 18, iconY + 18);
    ctx.lineTo(iconX + 40, iconY + 40);
    ctx.moveTo(iconX + 40, iconY + 18);
    ctx.lineTo(iconX + 18, iconY + 40);
  }
  ctx.stroke();

  // عنوان المنبثق
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('تفاصيل العملية', cardX + cardW / 2, iconY + iconBoxSize + 24);

  // الرقم المرجعي
  ctx.font = 'bold 14px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`الرقم المرجعي: ${data.refId}`, cardX + cardW / 2, iconY + iconBoxSize + 48);

  // شارة الجاهزية (الـ Badge الأخضر / الكهرماني / الأحمر)
  const badgeText = isSuccess ? 'تم التسديد بنجاح' : isPending ? 'قيد الانتظار' : 'فاشلة';
  const badgeBg = isSuccess ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2';
  const badgeBorder = isSuccess ? '#86efac' : isPending ? '#fde68a' : '#fca5a5';
  const badgeColor = isSuccess ? '#15803d' : isPending ? '#b45309' : '#b91c1c';

  const badgeY = iconY + iconBoxSize + 76;
  const badgeW = 160;
  const badgeH = 30;

  ctx.fillStyle = badgeBg;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX + (cardW - badgeW) / 2, badgeY - badgeH / 2, badgeW, badgeH, 15);
  } else {
    ctx.rect(cardX + (cardW - badgeW) / 2, badgeY - badgeH / 2, badgeW, badgeH);
  }
  ctx.fill();
  ctx.strokeStyle = badgeBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = badgeColor;
  ctx.font = 'bold 13px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(badgeText, cardX + cardW / 2, badgeY);

  // 4. صندوق المبلغ المدفوع
  const amountBoxY = badgeY + 28;
  const amountBoxH = 80;
  const amountBoxW = cardW - 60;
  const amountBoxX = cardX + 30;

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
  ctx.font = 'bold 11px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('المبلغ المدفوع', cardX + cardW / 2, amountBoxY + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 30px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(`${data.amount.toLocaleString('en-US')} ريال يمني`, cardX + cardW / 2, amountBoxY + 56);

  // 5. صفوف التفاصيل (مع خطوط مقطعة مطابقة تماماً للمنبثق)
  let rowY = amountBoxY + amountBoxH + 28;
  const rowLeft = amountBoxX + 6;
  const rowRight = amountBoxX + amountBoxW - 6;

  const drawRow = (label: string, value: string, isBlue = false) => {
    // خط مقطع
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rowLeft, rowY + 12);
    ctx.lineTo(rowRight, rowY + 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // التسمية
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(label, rowRight, rowY);

    // القيمة
    ctx.textAlign = 'left';
    ctx.fillStyle = isBlue ? '#1b52a4' : '#0f172a';
    ctx.font = isBlue ? 'bold 14px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif' : '700 13px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';

    let displayVal = value;
    if (ctx.measureText(displayVal).width > 320) {
      while (ctx.measureText(displayVal + '...').width > 320 && displayVal.length > 0) {
        displayVal = displayVal.slice(0, -1);
      }
      displayVal += '...';
    }
    ctx.fillText(displayVal, rowLeft, rowY);

    rowY += 40;
  };

  drawRow('الخدمة:', data.serviceName, true);

  if (data.isAlwadi && data.subscriberName) {
    drawRow('اسم المشترك:', data.subscriberName, true);
  }

  if (data.cardNumber) {
    drawRow('رقم الكرت:', data.cardNumber, true);
  }

  if (data.phone) {
    drawRow('الرقم المسدد له:', data.phone);
  }

  drawRow('التاريخ:', data.dateText);
  drawRow('الوقت:', data.timeText);

  // 6. صندوق ملاحظات العملية
  const notesBoxY = rowY + 6;
  const notesBoxH = 46;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('ملاحظات العملية', rowRight, notesBoxY);

  const notesY = notesBoxY + 10;
  ctx.fillStyle = isSuccess ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(amountBoxX, notesY, amountBoxW, notesBoxH, 12);
  } else {
    ctx.rect(amountBoxX, notesY, amountBoxW, notesBoxH);
  }
  ctx.fill();
  ctx.strokeStyle = isSuccess ? '#86efac' : isPending ? '#fde68a' : '#fca5a5';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = isSuccess ? '#15803d' : isPending ? '#b45309' : '#b91c1c';
  ctx.font = 'bold 12px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(data.notesText, rowRight - 12, notesY + notesBoxH / 2);

  // 7. تذييل البطاقة بهوية ستار موبايل
  const footerY = cardY + cardH - 30;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1b52a4';
  ctx.font = 'bold 14px "Almarai", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('تطبيق ستار موبايل | STAR MOBILE', cardX + cardW / 2, footerY);
}

export function TransactionDetailsModal({
  isOpen,
  onOpenChange,
  transaction,
  onSyncStatus,
  isSyncing = false,
  isAdmin = false,
  onActionStatus,
  onDeleteTransaction
}: TransactionDetailsModalProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  // حالة اسم ورقم مشترك الوادي
  const [resolvedSubscriberName, setResolvedSubscriberName] = useState<string>('');
  const [resolvedCardNumber, setResolvedCardNumber] = useState<string>('');

  const phone = extractRecipientPhone(transaction);
  const isAlwadi = Boolean(transaction?.transactionType?.includes('الوادي') || transaction?.transactionType?.includes('وادي'));

  // استخراج وتحديث اسم المشترك ورقم الكرت لمنظومة الوادي
  useEffect(() => {
    if (!transaction) {
      setResolvedSubscriberName('');
      setResolvedCardNumber('');
      return;
    }

    if (transaction.subscriberName) {
      setResolvedSubscriberName(transaction.subscriberName);
    }
    if (transaction.cardNumber) {
      setResolvedCardNumber(transaction.cardNumber);
    }

    if (isAlwadi) {
      const cardMatch = (transaction.notes || '').match(/(?:كرت|رقم الكرت|الكرت)\s*:?\s*([0-9a-zA-Z]+)/);
      const nameMatch = (transaction.notes || '').match(/(?:المشترك|اسم المشترك|الاسم)\s*:?\s*([^-\n,]+)/);
      
      const cardNum = transaction.cardNumber || (cardMatch ? cardMatch[1] : '') || transaction.recipientPhoneNumber || '';
      if (cardNum && !resolvedCardNumber) {
        setResolvedCardNumber(cardNum);
      }

      if (nameMatch && nameMatch[1] && !transaction.subscriberName) {
        setResolvedSubscriberName(nameMatch[1].trim());
      } else if (!transaction.subscriberName && cardNum) {
        // فحص تلقائي لحظي من السيرفر لمعرفة اسم المشترك الحقيقي
        fetch('/api/alwadi/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: cardNum })
        })
          .then(res => res.json())
          .then(data => {
            if (data?.success && data?.data?.name) {
              setResolvedSubscriberName(data.data.name);
              if (data.data.cardNumber) setResolvedCardNumber(data.data.cardNumber);
            }
          })
          .catch(() => {});
      }
    }
  }, [transaction, isAlwadi]);

  if (!transaction) return null;

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

  // استخراج سبب الرفض إن وجد
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

  // نصوص الملاحظات الثابتة
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
   * توليد صورة السند المطابقة للمنبثق 100% وفتح واتساب مباشرة
   */
  const handleShareToWhatsApp = async () => {
    if (!transaction || isSharing) return;
    setIsSharing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 940;

      const refId = generateNumericId(transaction.id);
      const dateText = safeFormatDate(transaction.transactionDate || transaction.createdAt, 'eeee، d MMMM yyyy');
      const timeText = safeFormatDate(transaction.transactionDate || transaction.createdAt, 'h:mm:ss a');

      drawModalExactToCanvas(canvas, {
        serviceName: cleanTxType,
        phone: phone || undefined,
        amount: transaction.amount,
        refId,
        status: isSuccess ? 'success' : isPending ? 'pending' : 'failed',
        dateText,
        timeText,
        notesText: displayNotes,
        cardNumber: resolvedCardNumber || transaction.cardNumber,
        subscriberName: resolvedSubscriberName || undefined,
        isAlwadi
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (!blob) throw new Error('تعذر إنشاء صورة السند');

      const fileName = `سند_ستار_موبايل_${refId}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // مشاركة أصلية للموبايل (تفتح الواتساب مباشرة لإرسال الصورة)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'سند عملية - تطبيق ستار موبايل',
            text: `سند عملية: ${cleanTxType} بمبلغ ${transaction.amount.toLocaleString('en-US')} ريال`
          });
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // تحميل الصورة فوراً وفتح واتساب مباشرة
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const targetPhone = phone ? phone.replace(/\D/g, '').slice(-9) : '';
      const waUrl = targetPhone ? `https://wa.me/967${targetPhone}` : 'https://wa.me/';
      window.open(waUrl, '_blank');

      toast({
        title: "تم حفظ صورة السند",
        description: "تم تجهيز صورة السند وفتح واتساب لإرسالها."
      });
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
          "px-5 pt-5 pb-3 text-center relative overflow-hidden transition-all",
          isSuccess && "bg-gradient-to-b from-green-500/15 via-green-500/5 to-transparent",
          isPending && "bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent",
          isFailed && "bg-gradient-to-b from-red-500/15 via-red-500/5 to-transparent"
        )}>
          {/* أيقونة الحالة */}
          <div className="flex justify-center mb-2">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-transform",
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
          <div className="flex items-center justify-center gap-2 mt-2">
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

        {/* تفاصيل المعاملة */}
        <div className="px-5 py-2 space-y-2.5 text-xs sm:text-sm max-h-[55vh] overflow-y-auto no-scrollbar">
          
          {/* المبلغ المستقطع */}
          <div className="bg-muted/40 dark:bg-muted/20 p-3 rounded-2xl border border-border/50 text-center space-y-0.5">
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
          <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#1b52a4]" />
              الخدمة:
            </span>
            <span className="font-black text-foreground text-xs sm:text-sm text-left max-w-[65%] truncate">
              {cleanTxType}
            </span>
          </div>

          {/* اسم المشترك ورقم الكرت لمنظومة الوادي */}
          {isAlwadi && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
                <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
                  <User className="h-4 w-4 text-[#1b52a4]" />
                  اسم المشترك:
                </span>
                <span className="font-bold text-xs sm:text-sm text-[#1b52a4] text-left">
                  {resolvedSubscriberName || 'مشترك الوادي'}
                </span>
              </div>

              {(resolvedCardNumber || transaction.cardNumber) && (
                <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
                  <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#1b52a4]" />
                    رقم الكرت:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs sm:text-sm tracking-widest text-foreground">
                      {resolvedCardNumber || transaction.cardNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resolvedCardNumber || transaction.cardNumber || '', 'رقم الكرت')}
                      className="p-1 hover:bg-muted rounded text-[#1b52a4]"
                      title="نسخ رقم الكرت"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* الرقم المسدد له للاتصالات */}
          {!isAlwadi && phone ? (
            <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
              <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#1b52a4]" />
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
          <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#1b52a4]" />
              التاريخ:
            </span>
            <span className="font-bold text-xs text-foreground">
              {safeFormatDate(transaction.transactionDate || transaction.createdAt, 'eeee، d MMMM yyyy')}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
            <span className="text-muted-foreground text-xs font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#1b52a4]" />
              الوقت:
            </span>
            <span className="font-bold text-xs text-foreground">
              {safeFormatDate(transaction.transactionDate || transaction.createdAt, 'h:mm:ss a')}
            </span>
          </div>

          {/* تفاصيل كرت الشبكات إن وجد لغير الوادي */}
          {!isAlwadi && transaction.cardNumber && (
            <div className="bg-muted/40 p-3 rounded-xl border border-dashed border-primary/20 space-y-1.5 my-1">
              <div className="flex items-center gap-2 text-[#1b52a4] text-xs font-bold">
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

          {/* ملاحظات العملية */}
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

          {/* أزرار الإجراءات السريعة للمدير للعمليات المعلقة */}
          {isAdmin && onActionStatus && isPending && (
            <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/30 space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs font-black text-amber-900 dark:text-amber-300">
                <span>إجراءات المدير على العملية المعلقة:</span>
                <span className="text-[10px] font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">معلقة</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onActionStatus('success')}
                  className="h-9 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تحديد كناجحة</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => onActionStatus('failed')}
                  className="h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  <span>تحديد كفاشلة وإرجاع</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* أزرار الإجراءات السفلية: مشاركة مباشرة لواتساب وحذف وإغلاق */}
        <DialogFooter className={cn("p-4 pt-2 gap-2", isAdmin && onDeleteTransaction ? "grid grid-cols-3" : "grid grid-cols-2")}>
          <Button
            type="button"
            onClick={handleShareToWhatsApp}
            disabled={isSharing}
            variant="outline"
            className="w-full h-11 rounded-xl font-black text-xs sm:text-sm border-[#1b52a4]/20 hover:bg-[#1b52a4]/5 text-[#1b52a4] flex items-center justify-center gap-1.5"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري فتح واتساب...</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>مشاركة</span>
              </>
            )}
          </Button>

          {isAdmin && onDeleteTransaction && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (transaction) {
                  onDeleteTransaction(transaction);
                }
              }}
              className="w-full h-11 rounded-xl font-black text-xs sm:text-sm border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700 flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف</span>
            </Button>
          )}

          <DialogClose asChild>
            <Button
              type="button"
              className="w-full h-11 rounded-xl font-black text-xs sm:text-sm bg-[#1b52a4] hover:bg-[#16468e] text-white"
            >
              إغلاق
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
