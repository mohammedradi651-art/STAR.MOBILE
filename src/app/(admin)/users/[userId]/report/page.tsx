'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Loader2,
  Trash2,
  AlertTriangle,
  Printer
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
function isEligibleForCommission(tx: Transaction): boolean {
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

/**
 * توليد كود HTML لكشف الحساب متعدد الصفحات مطابق 100% لتصميم الطباعة الفاخر
 * يدعم الطباعة والتصدير كـ PDF متعدد الصفحات بمتجهات فائقة الدقة وبدون أي تشويش
 */
function generateStatementHtml(
  userProfile: UserProfile,
  txs: Transaction[],
  periodLabel: string,
  userId: string
): string {
  const eligibleTxs = txs.filter(isEligibleForCommission);
  const totalEligibleAmount = eligibleTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const customerCommission = Math.round(totalEligibleAmount * 0.02);
  const paidTxs = txs.filter(tx => {
    const t = (tx.transactionType || '').toLowerCase();
    return !t.includes('تغذية') && !t.includes('إيداع') && !t.includes('استلام') && !t.includes('أرباح') && !t.includes('استرجاع');
  });
  const totalPaidAmount = paidTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const currentBalance = userProfile.balance ?? 0;
  const nowStr = format(new Date(), 'eeee، d MMMM yyyy - h:mm a', { locale: ar });
  const refId = `SM-STMT-${userId.slice(0, 8).toUpperCase()}`;

  const rawPhone = (userProfile.phoneNumber || '').replace(/\D/g, '').slice(-9);
  const waMsg = encodeURIComponent(
    `⭐ *تطبيق ستار موبايل - كشف حساب مالي تفصيلي*\n\n` +
    `👤 *العميل:* ${userProfile.displayName}\n` +
    `📅 *الفترة:* ${periodLabel}\n` +
    `🔢 *عدد العمليات:* ${txs.length} عملية\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💳 *إجمالي المسدد:* ${totalPaidAmount.toLocaleString('en-US')} ريال\n` +
    `⭐ *عمولة العميل المعتمدة (2%):* ${customerCommission.toLocaleString('en-US')} ريال\n` +
    `💰 *الرصيد المتاح الحالي:* ${currentBalance.toLocaleString('en-US')} ريال\n` +
    `━━━━━━━━━━━━━━━\n` +
    `تم توثيق كشف الحساب آلياً عبر نظام إدارة ستار موبايل.`
  );
  const waUrl = rawPhone ? `https://wa.me/967${rawPhone}?text=${waMsg}` : `https://web.whatsapp.com/send?text=${waMsg}`;

  const rowsHtml = txs.map((tx, idx) => {
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
    const alwadiInfo = getAlwadiSubscriberInfo(tx);
    const readiness = getReadinessDetails(tx);
    const dateStr = safeFormatDate(tx.transactionDate || tx.createdAt, 'yyyy/MM/dd - h:mm a');

    let statusColor = '#16a34a';
    let statusBg = '#dcfce7';
    let statusBorder = '#86efac';
    if (readiness.status === 'pending' || tx.status === 'pending') {
      statusColor = '#d97706';
      statusBg = '#fef3c7';
      statusBorder = '#fde68a';
    } else if (readiness.status === 'failed' || tx.status === 'failed') {
      statusColor = '#dc2626';
      statusBg = '#fee2e2';
      statusBorder = '#fca5a5';
    }

    const titleWithInfo = alwadiInfo ? `${cleanTitle} <span style="color: #64748b; font-size: 11px;">(${alwadiInfo.name})</span>` : cleanTitle;
    const phoneOrCard = phone || alwadiInfo?.number || tx.cardNumber || '—';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 9px 8px; text-align: center; font-weight: bold; color: #64748b; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 9px 8px; text-align: right; font-size: 11px; color: #475569; white-space: nowrap;">${dateStr}</td>
        <td style="padding: 9px 8px; text-align: right; font-weight: bold; font-size: 12px; color: #0f172a;">${titleWithInfo}</td>
        <td style="padding: 9px 8px; text-align: center; font-family: monospace; font-weight: bold; font-size: 12px; color: #1b52a4; direction: ltr;">${phoneOrCard}</td>
        <td style="padding: 9px 8px; text-align: left; font-weight: 900; font-size: 13px; color: ${isCredit ? '#16a34a' : '#0f172a'}; white-space: nowrap;">${Number(tx.amount).toLocaleString('en-US')} <span style="font-size: 10px; font-weight: normal; color: #64748b;">ر.ي</span></td>
        <td style="padding: 9px 8px; text-align: center; white-space: nowrap;">
          <span style="display: inline-block; padding: 3px 9px; border-radius: 9999px; font-size: 10px; font-weight: 800; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusBorder};">
            ${readiness.text}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>كشف حساب - ${userProfile.displayName || 'العميل'} - تطبيق ستار موبايل</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      font-family: 'Tajawal', Tahoma, Arial, sans-serif;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-size: 12px;
    }
    .page-wrap {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
    }
    .page-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 32px 36px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header-table {
      width: 100%;
      border-bottom: 3px solid #1b52a4;
      padding-bottom: 16px;
      margin-bottom: 22px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      color: #1b52a4;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #64748b;
      font-weight: bold;
      margin-top: 5px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 22px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    table.tx-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    table.tx-table thead {
      display: table-header-group;
    }
    table.tx-table tr {
      page-break-inside: avoid;
    }
    table.tx-table th {
      background: #1b52a4;
      color: #ffffff;
      padding: 11px 9px;
      font-size: 11px;
      font-weight: 800;
      text-align: right;
    }
    .summary-card {
      background: linear-gradient(135deg, #1b52a4 0%, #0f3875 100%);
      color: #ffffff;
      border-radius: 16px;
      padding: 20px 24px;
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 6px 16px rgba(27, 82, 164, 0.2);
    }
    .summary-title {
      font-size: 11px;
      font-weight: bold;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .summary-number {
      font-size: 19px;
      font-weight: 900;
    }
    .footer-note {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      font-weight: bold;
      margin-top: 30px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      page-break-inside: avoid;
    }
    .action-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #0f172a;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      border-bottom: 1px solid #334155;
    }
    .btn {
      cursor: pointer;
      border: none;
      border-radius: 10px;
      padding: 9px 18px;
      font-weight: 800;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-print {
      background: #1b52a4;
      color: #fff;
    }
    .btn-print:hover {
      background: #2563eb;
    }
    .btn-wa {
      background: #16a34a;
      color: #fff;
    }
    .btn-wa:hover {
      background: #15803d;
    }
    .btn-close {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-close:hover {
      background: #475569;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 10mm;
      }
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .page-wrap {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .page-card {
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }
      .no-print {
        display: none !important;
      }
      table.tx-table {
        page-break-inside: auto;
      }
      table.tx-table thead {
        display: table-header-group;
      }
      table.tx-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      .summary-card, .meta-box, .header-table, .footer-note {
        page-break-inside: avoid;
      }
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <!-- شريط التحكم العلوي للمشرف (يختفي تلقائياً عند الطباعة) -->
  <div class="action-bar no-print">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-weight: 900; font-size: 14px;">⭐ تطبيق ستار موبايل</span>
      <span style="background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: bold;">
        كشف حساب: ${userProfile.displayName || 'العميل'} (${txs.length} عملية)
      </span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button class="btn btn-print" onclick="window.print()">
        🖨️ طباعة أو حفظ كـ PDF متعدد الصفحات
      </button>
      <a class="btn btn-wa" href="${waUrl}" target="_blank">
        📲 إرسال الكشف عبر واتساب للعميل
      </a>
      <button class="btn btn-close" onclick="window.close()">
        ✖️ إغلاق
      </button>
    </div>
  </div>

  <div class="page-wrap">
    <div class="page-card">
      <table class="header-table">
        <tr>
          <td style="text-align: right; vertical-align: middle;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo.jpeg" alt="Logo" style="width: 60px; height: 60px; border-radius: 14px; object-fit: contain; border: 1px solid #e2e8f0;" onerror="this.style.display='none'" />
              <div>
                <h1 class="brand-title">تطبيق ستار موبايل</h1>
                <div class="brand-subtitle">كشف حساب مالي تفصيلي معتمد</div>
              </div>
            </div>
          </td>
          <td style="text-align: left; vertical-align: middle;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b;">تاريخ ووقت الإصدار:</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 1px;">${nowStr}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 3px; font-family: monospace;">الرقم المرجعي: ${refId}</div>
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
            <span class="meta-value" style="font-family: monospace; color: #1b52a4;">${userProfile.phoneNumber || 'غير مسجل'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">الرصيد المتاح الحالي:</span>
            <span class="meta-value" style="color: #1b52a4;">${currentBalance.toLocaleString('en-US')} ريال</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">الفترة المحددة:</span>
            <span class="meta-value">${periodLabel} (${txs.length} عملية)</span>
          </div>
        </div>
      </div>

      <table class="tx-table">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th style="width: 140px; text-align: right;">التاريخ والوقت</th>
            <th style="text-align: right;">الخدمة والعملية / المشترك</th>
            <th style="width: 125px; text-align: center;">الرقم / الكرت</th>
            <th style="width: 110px; text-align: left;">المبلغ</th>
            <th style="width: 90px; text-align: center;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="padding: 30px; text-align: center; color: #64748b; font-weight: bold;">لا توجد عمليات مسجلة في هذه الفترة المحددة</td></tr>'}
        </tbody>
      </table>

      <!-- ملخص الحساب والعمولة 2% -->
      <div class="summary-card">
        <div>
          <div class="summary-title">إجمالي المبالغ المسددة</div>
          <div class="summary-number">${totalPaidAmount.toLocaleString('en-US')} <span style="font-size: 11px; font-weight: normal;">ر.ي</span></div>
        </div>
        <div style="border-right: 1px solid rgba(255,255,255,0.2); border-left: 1px solid rgba(255,255,255,0.2);">
          <div class="summary-title">المبالغ المؤهلة للعمولة</div>
          <div class="summary-number">${totalEligibleAmount.toLocaleString('en-US')} <span style="font-size: 11px; font-weight: normal;">ر.ي</span></div>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.2);">
          <div class="summary-title">عمولة العميل المعتمدة (2%) ⭐</div>
          <div class="summary-number" style="color: #fef08a;">${customerCommission.toLocaleString('en-US')} <span style="font-size: 11px; font-weight: normal; color: #fff;">ر.ي</span></div>
        </div>
        <div>
          <div class="summary-title">الرصيد المتاح الحالي</div>
          <div class="summary-number">${currentBalance.toLocaleString('en-US')} <span style="font-size: 11px; font-weight: normal;">ر.ي</span></div>
        </div>
      </div>

      <div class="footer-note">
        تم إصدار هذا الكشف آلياً عبر نظام إدارة تطبيق ستار موبايل لخدمات الاتصالات والمدفوعات الإلكترونية 💙
      </div>
    </div>
  </div>

  <script>
    // تشغيل حوار الطباعة وتصدير PDF تلقائياً بعد اكتمال تحميل الشعار والخطوط
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;
}

function UserReportPage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // إدارة تغيير حالة العملية المعلقة (نجاح / فشل) وخيار الملاحظة
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetTx, setStatusTargetTx] = useState<Transaction | null>(null);
  const [targetStatus, setTargetStatus] = useState<'success' | 'failed'>('success');
  const [statusNote, setStatusNote] = useState<string>('تم التسديد بنجاح');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const openStatusModal = (tx: Transaction, status: 'success' | 'failed') => {
    setStatusTargetTx(tx);
    setTargetStatus(status);
    setStatusNote(status === 'success' ? 'تم التسديد بنجاح' : 'فشلت العملية وتمت إعادة المبلغ للرصيد');
    setStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTargetTx || !firestore || !userId) return;
    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const txId = statusTargetTx.id;
      const transid = statusTargetTx.transid || txId;
      const amount = Number(statusTargetTx.amount || 0);

      const userDocRef = doc(firestore, 'users', userId);
      const userTxRef = doc(firestore, `users/${userId}/transactions`, txId);
      const globalTxRef = doc(firestore, 'paymentTransactions', transid);

      const batch = writeBatch(firestore);

      if (targetStatus === 'success') {
        const updateData = {
          status: 'success',
          readiness: 'جاهزة',
          notes: statusNote.trim() || 'تم التسديد بنجاح',
          providerMessage: statusNote.trim() || 'تم التسديد بنجاح',
          completedAt: now,
          updatedAt: now,
          manualUpdateBy: 'admin'
        };
        batch.update(userTxRef, updateData);
        batch.update(globalTxRef, updateData);

        const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
        batch.set(notifRef, {
          title: 'اكتملت العملية بنجاح',
          body: `تم تأكيد سداد عملية ${statusTargetTx.transactionType} بمبلغ ${amount.toLocaleString('en-US')} ريال. الملاحظة: ${statusNote.trim() || 'تم التسديد بنجاح'}.`,
          timestamp: now
        });
      } else {
        // فشل وإرجاع الرصيد للمستخدم
        batch.update(userDocRef, { balance: increment(amount) });

        const updateData = {
          status: 'failed',
          readiness: 'فاشلة',
          refunded: true,
          notes: statusNote.trim() || 'فشلت العملية وتمت إعادة المبلغ للرصيد',
          providerMessage: statusNote.trim() || 'فشلت العملية وتمت إعادة المبلغ للرصيد',
          failedAt: now,
          updatedAt: now,
          manualUpdateBy: 'admin'
        };
        batch.update(userTxRef, updateData);
        batch.update(globalTxRef, updateData);

        const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
        batch.set(notifRef, {
          title: 'تم استرجاع الرصيد',
          body: `تعذر تنفيذ عملية ${statusTargetTx.transactionType} وتمت إعادة مبلغ ${amount.toLocaleString('en-US')} ريال إلى محفظتك. الملاحظة: ${statusNote.trim() || 'فشلت العملية وتمت إعادة المبلغ للرصيد'}.`,
          timestamp: now
        });
      }

      await batch.commit();

      toast({
        title: targetStatus === 'success' ? 'تم تأكيد النجاح' : 'تم تأكيد الفشل وإعادة الرصيد',
        description: targetStatus === 'success'
          ? 'تم تغيير حالة العملية إلى جاهزة وحفظ الملاحظة.'
          : `تم تغيير حالة العملية إلى فاشلة وإرجاع ${amount.toLocaleString('en-US')} ريال للعميل.`
      });

      if (selectedTx && (selectedTx.id === txId || selectedTx.transid === transid)) {
        setSelectedTx(prev => prev ? {
          ...prev,
          status: targetStatus === 'success' ? 'success' : 'failed',
          readiness: targetStatus === 'success' ? 'جاهزة' : 'فاشلة',
          notes: statusNote.trim() || (targetStatus === 'success' ? 'تم التسديد بنجاح' : 'فشلت العملية وتمت إعادة المبلغ للرصيد')
        } : null);
      }

      setStatusModalOpen(false);
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'فشل تغيير حالة العملية: ' + err.message
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // إدارة حذف العملية نهائياً دون تعديل رصيد العميل
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetTx, setDeleteTargetTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteDialog = (tx: Transaction) => {
    setDeleteTargetTx(tx);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetTx || !firestore || !userId) return;
    setIsDeleting(true);
    try {
      const txId = deleteTargetTx.id;
      const transid = deleteTargetTx.transid || txId;

      const userTxRef = doc(firestore, `users/${userId}/transactions`, txId);
      const globalTxRef = doc(firestore, 'paymentTransactions', transid);

      const batch = writeBatch(firestore);
      // حذف المعاملة من سجل العميل ومن السجل العام فقط بدون المساس بالرصيد
      batch.delete(userTxRef);
      batch.delete(globalTxRef);

      await batch.commit();

      toast({
        title: 'تم حذف العملية بنجاح',
        description: 'تم حذف العملية من كشف الحساب نهائياً، ورصيد العميل كما هو دون أي تغيير.'
      });

      if (selectedTx && (selectedTx.id === txId || selectedTx.transid === transid)) {
        setIsModalOpen(false);
        setSelectedTx(null);
      }

      setDeleteDialogOpen(false);
      setDeleteTargetTx(null);
    } catch (err: any) {
      console.error("Failed to delete transaction:", err);
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'تعذر حذف العملية: ' + err.message
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
   * فتح كشف الحساب المتعدد الصفحات بتصميم الطباعة الفاخر وحفظه كـ PDF مع خيار إرسال واتساب
   */
  const handleOpenStatement = (sendWhatsApp: boolean = false) => {
    if (!filteredTransactions || !userProfile) {
      toast({ variant: 'destructive', title: 'تنبيه', description: 'لا توجد بيانات متاحة في الفترة المحددة' });
      return;
    }

    const htmlContent = generateStatementHtml(userProfile, filteredTransactions, periodLabel, userId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'تنبيه النوافذ المنبثقة',
        description: 'يرجى السماح بالنوافذ المنبثقة لفتح كشف الحساب وتصديره كـ PDF.'
      });
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // إذا طلب أيضاً إرسال ملخص واتساب مباشرة للعميل
    if (sendWhatsApp) {
      const eligibleTxs = filteredTransactions.filter(isEligibleForCommission);
      const totalEligibleAmount = eligibleTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const customerCommission = Math.round(totalEligibleAmount * 0.02);
      const paidTxs = filteredTransactions.filter(tx => {
        const t = (tx.transactionType || '').toLowerCase();
        return !t.includes('تغذية') && !t.includes('إيداع') && !t.includes('استلام') && !t.includes('أرباح') && !t.includes('استرجاع');
      });
      const totalPaidAmount = paidTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const currentBalance = userProfile.balance ?? 0;

      const rawPhone = (userProfile.phoneNumber || '').replace(/\D/g, '').slice(-9);
      const waMsg = encodeURIComponent(
        `⭐ *تطبيق ستار موبايل - كشف حساب مالي تفصيلي*\n\n` +
        `👤 *العميل:* ${userProfile.displayName}\n` +
        `📅 *الفترة:* ${periodLabel}\n` +
        `🔢 *عدد العمليات:* ${filteredTransactions.length} عملية\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💳 *إجمالي المسدد:* ${totalPaidAmount.toLocaleString('en-US')} ريال\n` +
        `⭐ *عمولة العميل المعتمدة (2%):* ${customerCommission.toLocaleString('en-US')} ريال\n` +
        `💰 *الرصيد المتاح الحالي:* ${currentBalance.toLocaleString('en-US')} ريال\n` +
        `━━━━━━━━━━━━━━━\n` +
        `تم توثيق كشف الحساب آلياً عبر نظام إدارة ستار موبايل.`
      );
      const waUrl = rawPhone ? `https://wa.me/967${rawPhone}?text=${waMsg}` : `https://web.whatsapp.com/send?text=${waMsg}`;
      window.open(waUrl, '_blank');
    }

    toast({
      title: sendWhatsApp ? "تم فتح الكشف ومحادثة واتساب" : "تم فتح كشف الحساب",
      description: "تم تجهيز كشف الحساب المتعدد الصفحات بتصميم الطباعة المعتمد."
    });
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

          const isPending = tx.status === 'pending' || tx.readiness === 'قيد الانتظار' || readiness.text.includes('الانتظار');

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

                {/* المبلغ والحالة وأزرار الإجراءات للعمليات المعلقة */}
                <div className="flex flex-col items-end justify-center gap-1.5 shrink-0">
                  <div className="text-left space-y-0.5">
                    <p className={cn("font-black text-base sm:text-lg", isCredit ? 'text-green-600' : 'text-foreground')}>
                      {Number(tx.amount).toLocaleString('en-US')} ر.ي
                    </p>
                    <span className={cn("text-xs font-bold block", readiness.colorClass)}>
                      {readiness.text}
                    </span>
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {/* أزرار نجاح / فشل للعملية المعلقة مباشرة في الكشف */}
                    {isPending && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStatusModal(tx, 'success');
                          }}
                          className="h-7 px-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-black text-xs flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>نجاح</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStatusModal(tx, 'failed');
                          }}
                          className="h-7 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1 shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>فشل</span>
                        </Button>
                      </>
                    )}

                    {/* زر حذف العملية نهائياً دون تعديل الرصيد */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="حذف العملية نهائياً (دون تعديل الرصيد)"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(tx);
                      }}
                      className="h-7 px-2 text-xs font-bold text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">حذف</span>
                    </Button>
                  </div>
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
        {/* كارت ملخص بيانات العميل مع أزرار كشف الحساب المتعدد الصفحات */}
        <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-[#1b52a4]" />
                بيانات حساب العميل
              </CardTitle>

              {/* أزرار كشف الحساب: زر إرسال واتساب وزر الطباعة و PDF متعدد الصفحات */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  type="button"
                  onClick={() => handleOpenStatement(true)}
                  disabled={isLoading || !filteredTransactions || filteredTransactions.length === 0}
                  className="h-11 px-4 rounded-xl font-black text-xs sm:text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-sm flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>إرسال كشف عبر واتساب</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => handleOpenStatement(false)}
                  disabled={isLoading || !filteredTransactions || filteredTransactions.length === 0}
                  className="h-11 px-4 rounded-xl font-black text-xs sm:text-sm bg-[#1b52a4] hover:bg-[#16468e] text-white shadow-sm flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>كشف حساب للطباعة و PDF</span>
                </Button>
              </div>
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
        isAdmin={true}
        onActionStatus={(status) => {
          if (selectedTx) {
            openStatusModal(selectedTx, status);
          }
        }}
        onDeleteTransaction={(tx) => {
          openDeleteDialog(tx as any);
        }}
      />

      {/* نافذة تأكيد حذف العملية نهائياً دون تعديل الرصيد */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>تأكيد حذف العملية</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              هل أنت متأكد من رغبتك في حذف هذه العملية نهائياً من كشف الحساب؟
            </DialogDescription>
          </DialogHeader>

          {deleteTargetTx && (
            <div className="bg-red-500/5 p-3 rounded-2xl border border-red-500/20 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">العملية:</span>
                <span className="font-bold text-foreground">{deleteTargetTx.transactionType}</span>
              </div>
              {extractRecipientPhone(deleteTargetTx) && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">رقم الهاتف/المشترك:</span>
                  <span className="font-mono font-bold text-[#1b52a4]">{extractRecipientPhone(deleteTargetTx)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">المبلغ:</span>
                <span className="font-black text-sm text-foreground">{Number(deleteTargetTx.amount).toLocaleString('en-US')} ريال</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">الحالة الحالية:</span>
                <span className="font-bold text-muted-foreground">{deleteTargetTx.readiness || deleteTargetTx.status || 'غير محدد'}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
              تنبيه: سيتم حذف العملية فقط من سجل الكشف وسجل العمليات، ولن يتم تغيير أو خصم أو إضافة أي شيء إلى رصيد العميل نهائياً.
            </p>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="h-11 rounded-xl font-black text-xs sm:text-sm bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                  <span>جاري الحذف...</span>
                </>
              ) : (
                <span>حذف العملية نهائياً</span>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="h-11 rounded-xl font-black text-xs sm:text-sm"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تأكيد تغيير حالة العملية المعلقة وإدخال الملاحظة */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md w-full rounded-3xl p-5" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              {targetStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span>تأكيد نجاح العملية</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span>تأكيد فشل العملية وإرجاع الرصيد</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {targetStatus === 'success' 
                ? 'سيتم تحويل حالة هذه العملية إلى "جاهزة" وتأكيد إتمام السداد للعميل.' 
                : `سيتم تحويل حالة هذه العملية إلى "فاشلة" وإعادة مبلغ (${Number(statusTargetTx?.amount || 0).toLocaleString('en-US')} ريال) إلى محفظة العميل فوراً.`}
            </DialogDescription>
          </DialogHeader>

          {statusTargetTx && (
            <div className="bg-muted/40 p-3 rounded-2xl border border-border/60 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">الخدمة:</span>
                <span className="font-bold text-foreground">{statusTargetTx.transactionType}</span>
              </div>
              {extractRecipientPhone(statusTargetTx) && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">رقم الهاتف/المشترك:</span>
                  <span className="font-mono font-bold text-[#1b52a4]">{extractRecipientPhone(statusTargetTx)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">المبلغ:</span>
                <span className="font-black text-sm text-foreground">{Number(statusTargetTx.amount).toLocaleString('en-US')} ريال</span>
              </div>
            </div>
          )}

          {/* خيار الملاحظة (تلقائي "تم التسديد بنجاح" عند النجاح) */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>الملاحظة المسجلة في السجل:</span>
            </Label>
            <Input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="اكتب الملاحظة هنا..."
              className="h-10 text-xs font-bold rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              {targetStatus === 'success' 
                ? 'الملاحظة الافتراضية التلقائية هي: "تم التسديد بنجاح" ويمكنك تعديلها.' 
                : 'ستظهر هذه الملاحظة للعميل في كشف حسابه لتوضيح سبب الرفض.'}
            </p>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              onClick={handleConfirmStatusChange}
              disabled={isUpdatingStatus}
              className={cn(
                "h-11 rounded-xl font-black text-xs sm:text-sm text-white",
                targetStatus === 'success' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
              )}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                  <span>جاري التحديث...</span>
                </>
              ) : (
                <span>{targetStatus === 'success' ? 'تأكيد النجاح' : 'تأكيد الفشل والإرجاع'}</span>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusModalOpen(false)}
              disabled={isUpdatingStatus}
              className="h-11 rounded-xl font-black text-xs sm:text-sm"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserReportPage;
