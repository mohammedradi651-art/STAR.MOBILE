'use client';

import React, { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useDoc } from '@/firebase';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  runTransaction,
  increment,
  onSnapshot,
  arrayUnion,
} from 'firebase/firestore';
import {
  CheckCircle,
  Copy,
  AlertCircle,
  Database,
  MessageSquare,
  Smartphone,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
  ShieldCheck,
  Wallet,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { ProcessingOverlay } from '@/components/layout/processing-overlay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useServicesConfig } from '@/hooks/use-services-config';
import { roundCurrency, isUserApiCustomer } from '@/lib/services-config';
import { useOnlineStatus } from '@/hooks/use-online-status';

export const dynamic = 'force-dynamic';

type CardCategory = {
  id: string | number;
  name: string;
  price: number;
  capacity?: string;
  dataLimit?: string;
  storage?: string;
  size?: string;
  data_limit?: string;
  notes?: string;
  validity?: string;
  expirationDate?: string;
  duration?: string;
  count?: number;
};

type NetworkCard = {
  cardID: string;
  cardPass?: string;
};

const CARD_GRADIENTS = [
  'from-sky-500 to-blue-600 shadow-blue-500/20',
  'from-emerald-500 to-teal-600 shadow-teal-500/20',
  'from-indigo-500 to-purple-600 shadow-purple-500/20',
  'from-amber-500 to-orange-600 shadow-orange-500/20',
  'from-rose-500 to-pink-600 shadow-pink-500/20',
];

function getCategoryCapacity(cat?: CardCategory | null): string {
  if (!cat) return '-';
  const val =
    cat.capacity ||
    cat.dataLimit ||
    cat.storage ||
    cat.size ||
    cat.data_limit ||
    cat.notes;
  return val && String(val).trim() ? String(val).trim() : '-';
}

function getCategoryValidity(cat?: CardCategory | null): string {
  if (!cat) return '-';
  const val = cat.validity || cat.expirationDate || cat.duration;
  return val && String(val).trim() ? String(val).trim() : '-';
}

function NetworkPurchasePageComponent() {
  const params = useParams();
  const networkId = params.networkId as string;
  const searchParams = useSearchParams();
  const networkName = searchParams.get('name') || 'فئات الكروت';
  const networkLocation = searchParams.get('location') || '';
  const isLocal = searchParams.get('local') === '1';
  const ownerId = searchParams.get('ownerId') || networkId;

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const isOffline = !isOnline;

  const userDocRef = useMemo(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<any>(userDocRef);
  const { config } = useServicesConfig();
  const isApiUser = isUserApiCustomer(userProfile);

  const getEffectiveCardPrice = (basePrice: number) => {
    if (!isApiUser) return basePrice;
    const rate = config.networks?.rate ?? 0.95;
    return roundCurrency(basePrice * rate);
  };

  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<CardCategory | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [delayedOrderPopupOpen, setDelayedOrderPopupOpen] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<NetworkCard | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!networkId) return;
      setError(null);

      const catCacheKey = `star_cache_cats_${networkId}`;
      const cachedCats = localStorage.getItem(catCacheKey);
      let hasValidCache = false;

      if (cachedCats) {
        try {
          const parsed = JSON.parse(cachedCats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
            setIsLoadingCategories(false);
            hasValidCache = true;
          }
        } catch {
          setCategories([]);
        }
      } else {
        setCategories([]);
        setIsLoadingCategories(true);
      }

      if (isOffline) {
        if (!hasValidCache) {
          setCategories([]);
          setIsLoadingCategories(false);
          setError('uncached_offline');
        }
        return;
      }

      const treatAsLocal = isLocal || !/^\d+$/.test(String(networkId));

      if (treatAsLocal && !firestore) {
        return;
      }

      try {
        if (treatAsLocal && firestore) {
          const localNetRef = doc(firestore, `users/${ownerId}/local_networks`, ownerId);
          const snap = await getDoc(localNetRef);
          let catsData: CardCategory[] =
            snap.exists() && Array.isArray(snap.data()?.categories)
              ? snap.data()?.categories
              : [];

          if (catsData.length === 0) {
            const colSnap = await getDocs(collection(firestore, `users/${ownerId}/local_networks`));
            if (!colSnap.empty) {
              const firstData = colSnap.docs[0].data();
              if (Array.isArray(firstData?.categories)) {
                catsData = firstData.categories;
              }
            }
          }

          setCategories(catsData);
          localStorage.setItem(catCacheKey, JSON.stringify(catsData));
        } else {
          const response = await fetch(`/services/networks-api/${networkId}/classes`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'فشل تحميل الفئات');
          }
          const data = await response.json();
          const mapped: CardCategory[] = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            price: c.price,
            capacity: c.dataLimit || c.capacity || c.storage,
            validity: c.expirationDate || c.validity,
            dataLimit: c.dataLimit,
            expirationDate: c.expirationDate,
          }));
          setCategories(mapped);
          localStorage.setItem(catCacheKey, JSON.stringify(mapped));
        }
      } catch (err: any) {
        if (!hasValidCache) {
          setError(err?.message || 'حدث خطأ أثناء جلب الفئات');
        }
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [networkId, isLocal, ownerId, firestore, isOffline]);

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    if (isLocal) {
      return [...categories].sort((a, b) => Number(a.price) - Number(b.price));
    }
    return categories;
  }, [categories, isLocal]);

  const handleSelectCategory = (category: CardCategory) => {
    setSelectedCategory(category);
    setIsConfirming(true);
  };

  const handlePurchase = async () => {
    if (!selectedCategory || !user || !userDocRef) return;

    const effectivePrice = getEffectiveCardPrice(selectedCategory.price);

    if ((userProfile?.balance ?? 0) < effectivePrice) {
      toast({
        variant: 'destructive',
        title: 'رصيد غير كافٍ',
        description: 'رصيدك الحالي لا يكفي لشراء هذا الكرت.',
      });
      setIsConfirming(false);
      return;
    }

    if (isOffline) {
      const smsMsg = `${networkName} - ${selectedCategory.name} - ${effectivePrice}`;
      window.location.href = `sms:770326828?body=${encodeURIComponent(smsMsg)}`;
      setIsConfirming(false);
      return;
    }

    if (!firestore) return;

    setIsConfirming(false);
    setIsProcessing(true);

    let isExternalOrderDeducted = false;
    let purchaseSuccessfullyCommitted = false;
    const now = new Date().toISOString();

    try {
      const treatAsLocal = isLocal || !/^\d+$/.test(String(networkId));
      if (treatAsLocal) {
        const cardsDocRef = doc(
          firestore,
          `users/${ownerId}/local_networks/${ownerId}/cards_data`,
          'cards'
        );
        const cardsSnap = await getDoc(cardsDocRef);

        if (!cardsSnap.exists()) {
          throw new Error('لا توجد كروت متاحة حالياً في هذه الشبكة.');
        }

        const allCards: any[] = cardsSnap.data()?.cards || [];
        const cardIndex = allCards.findIndex(
          (c: any) =>
            (c.cat === selectedCategory.id || c.categoryId === selectedCategory.id) &&
            c.isUsed !== true &&
            c.u !== true
        );

        if (cardIndex === -1) {
          throw new Error('نفدت الكروت المتاحة حالياً لهذه الفئة.');
        }

        const cardData = allCards[cardIndex];
        const finalCardID = cardData.c || cardData.cardNumber;
        const finalCardPass = cardData.p || cardData.cardPass || '';

        allCards[cardIndex] = {
          ...cardData,
          isUsed: true,
          u: true,
          soldAt: now,
        };

        const commission = Math.ceil(selectedCategory.price * 0.1);
        const payoutAmount = selectedCategory.price - commission;

        const batch = writeBatch(firestore);
        batch.update(userDocRef, { balance: increment(-effectivePrice) });
        batch.update(cardsDocRef, { cards: allCards, updatedAt: now });

        const userHistoryRef = doc(firestore, `users/${user.uid}/transactions`, 'history');
        const buyerTx = {
          id: `card_${Date.now()}`,
          userId: user.uid,
          transactionDate: now,
          amount: effectivePrice,
          transactionType: `شراء كرت ${selectedCategory.name}`,
          notes: `شبكة: ${networkName}`,
          cardNumber: finalCardID,
          status: 'completed',
          readiness: 'جاهزة',
        };
        const compactBuyerTx = {
          id: buyerTx.id,
          t: buyerTx.transactionType,
          a: buyerTx.amount,
          d: buyerTx.transactionDate,
          s: buyerTx.status,
          r: buyerTx.readiness,
          net: networkName,
          cat: selectedCategory.name,
          card: finalCardID,
          note: buyerTx.notes,
        };
        batch.set(
          userHistoryRef,
          {
            transactions: arrayUnion(buyerTx),
            list: arrayUnion(compactBuyerTx),
            lastUpdated: now,
          },
          { merge: true }
        );

        if (ownerId && ownerId !== 'admin') {
          const ownerRef = doc(firestore, 'users', ownerId);
          batch.update(ownerRef, { balance: increment(payoutAmount) });

          const ownerHistoryRef = doc(firestore, `users/${ownerId}/transactions`, 'history');
          const ownerTx = {
            id: `payout_${Date.now()}`,
            userId: ownerId,
            transactionDate: now,
            amount: payoutAmount,
            transactionType: 'أرباح مبيعات الكروت',
            notes: `أرباح كرت ${selectedCategory.name} - شبكة: ${networkName} (صافي بعد خصم 10% عمولة)`,
            status: 'completed',
            readiness: 'جاهزة',
          };
          const compactOwnerTx = {
            id: ownerTx.id,
            t: ownerTx.transactionType,
            a: ownerTx.amount,
            d: ownerTx.transactionDate,
            s: ownerTx.status,
            r: ownerTx.readiness,
            net: networkName,
            cat: selectedCategory.name,
            note: ownerTx.notes,
          };
          batch.set(
            ownerHistoryRef,
            {
              transactions: arrayUnion(ownerTx),
              list: arrayUnion(compactOwnerTx),
              lastUpdated: now,
            },
            { merge: true }
          );
        }

        await batch.commit();
        purchaseSuccessfullyCommitted = true;

        // إظهار الكرت فوراً بمجرد اعتماد الحفظ
        setPurchasedCard({ cardID: finalCardID, cardPass: finalCardPass });
        setIsProcessing(false);
        audioRef.current?.play().catch(() => {});
        return;
      }

      // شبكات بيتي الخارجية: خصم المبلغ ثم استدعاء المزود، وإظهار الكرت فور وصوله
      const externalRef = `SM-BN-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .substring(2, 7)}`;
      const txId = `baity_${Date.now()}`;
      const baityOrderRef = doc(firestore, 'baityOrders', externalRef);
      const userHistoryRef = doc(firestore, `users/${user.uid}/transactions`, 'history');
      const globalTxRef = doc(firestore, 'paymentTransactions', txId);

      const pendingBuyerTx = {
        id: txId,
        userId: user.uid,
        transactionDate: now,
        amount: effectivePrice,
        transactionType: `شراء كرت ${selectedCategory.name}`,
        notes: `شبكة: ${networkName} (قيد المعالجة)`,
        cardNumber: '',
        status: 'pending',
        readiness: 'قيد الانتظار',
        externalRef,
      };
      const pendingCompactTx = {
        id: txId,
        t: pendingBuyerTx.transactionType,
        a: effectivePrice,
        d: now,
        s: 'pending',
        r: 'قيد الانتظار',
        net: networkName,
        cat: selectedCategory.name,
        card: '',
        note: pendingBuyerTx.notes,
        externalRef,
      };

      const initBatch = writeBatch(firestore);
      initBatch.update(userDocRef, { balance: increment(-effectivePrice) });
      initBatch.set(baityOrderRef, {
        externalRef,
        txId,
        userId: user.uid,
        amount: effectivePrice,
        networkName,
        categoryName: selectedCategory.name,
        classId: selectedCategory.id,
        status: 'pending',
        createdAt: now,
        refunded: false,
      });
      initBatch.set(
        userHistoryRef,
        {
          transactions: arrayUnion(pendingBuyerTx),
          list: arrayUnion(pendingCompactTx),
          lastUpdated: now,
        },
        { merge: true }
      );
      initBatch.set(globalTxRef, { ...pendingBuyerTx, serviceCategory: 'الشبكات' });

      await initBatch.commit();
      isExternalOrderDeducted = true;

      let isHandled = false;

      await new Promise<void>((resolve) => {
        let unsubscribe = () => {};
        let timeoutId: ReturnType<typeof setTimeout>;

        const cleanup = () => {
          clearTimeout(timeoutId);
          unsubscribe();
        };

        const handleOrderFailure = async (reason: string, isStockOutArg?: boolean) => {
          if (isHandled) return;
          isHandled = true;
          cleanup();

          try {
            await runTransaction(firestore, async (transaction) => {
              const orderSnap = await transaction.get(baityOrderRef);
              const hSnap = await transaction.get(userHistoryRef);
              const orderData = orderSnap.exists() ? orderSnap.data() : null;

              if (orderData?.refunded || orderData?.status === 'failed' || orderData?.status === 'completed') {
                return;
              }

              const nowIso = new Date().toISOString();
              if (effectivePrice > 0) {
                transaction.update(userDocRef, { balance: increment(effectivePrice) });
              }
              transaction.update(baityOrderRef, {
                status: 'failed',
                refunded: true,
                errorReason: reason,
                failedAt: nowIso,
              });

              if (hSnap.exists()) {
                const rawTxs = hSnap.data()?.transactions || [];
                const rawList = hSnap.data()?.list || [];
                const failNote = isStockOutArg
                  ? `فشل الشراء (نفاد المخزون) وتم إرجاع ${effectivePrice} ر.ي`
                  : `فشل الشراء وتم إرجاع ${effectivePrice} ر.ي`;

                transaction.update(userHistoryRef, {
                  transactions: rawTxs.map((item: any) =>
                    item.id === txId
                      ? { ...item, status: 'failed', readiness: 'فاشلة', refunded: true, notes: failNote }
                      : item
                  ),
                  list: rawList.map((item: any) =>
                    item.id === txId
                      ? { ...item, s: 'failed', r: 'فاشلة', refunded: true, note: failNote }
                      : item
                  ),
                  lastUpdated: nowIso,
                });
              }
              transaction.set(globalTxRef, {
                status: 'failed',
                readiness: 'فاشلة',
                refunded: true,
                notes: reason || 'فشل الشراء من المزود',
              }, { merge: true });
            });
            isExternalOrderDeducted = false;
          } catch (e) {
            console.error('Error refunding baityOrder:', e);
          }

          setIsProcessing(false);
          const errorTitle = isStockOutArg ? 'انتهى المخزون' : 'فشل الشراء';
          const errorDesc = isStockOutArg
            ? 'فشل الشراء: انتهى المخزون — تم إرجاع المبلغ لحسابك'
            : reason || 'فشل الشراء — تم إرجاع المبلغ لحسابك';

          toast({ variant: 'destructive', title: errorTitle, description: errorDesc });
          resolve();
        };

        const handleOrderSuccess = (cardData: NetworkCard, uuidOrder?: string) => {
          if (isHandled) return;
          isHandled = true;
          cleanup();
          purchaseSuccessfullyCommitted = true;
          isExternalOrderDeducted = false;

          // إظهار منبثق الكرت فوراً للمستخدم بدون انتظار كتابة السجلات
          setPurchasedCard(cardData);
          setIsProcessing(false);
          audioRef.current?.play().catch(() => {});
          resolve();

          // تحديث السجلات في الخلفية فوراً دون تعطيل الشاشة
          const doneNow = new Date().toISOString();
          (async () => {
            try {
              const finishBatch = writeBatch(firestore);
              finishBatch.update(baityOrderRef, {
                status: 'completed',
                cardNumber: cardData.cardID,
                cardPass: cardData.cardPass || '',
                uuidOrder: uuidOrder || '',
                completedAt: doneNow,
              });

              const hSnap = await getDoc(userHistoryRef);
              if (hSnap.exists()) {
                const rawTxs = hSnap.data()?.transactions || [];
                const rawList = hSnap.data()?.list || [];
                finishBatch.update(userHistoryRef, {
                  transactions: rawTxs.map((item: any) =>
                    item.id === txId
                      ? {
                          ...item,
                          status: 'completed',
                          readiness: 'جاهزة',
                          cardNumber: cardData.cardID,
                          notes: `شبكة: ${networkName} - رقم الكرت: ${cardData.cardID}`,
                        }
                      : item
                  ),
                  list: rawList.map((item: any) =>
                    item.id === txId
                      ? {
                          ...item,
                          s: 'completed',
                          r: 'جاهزة',
                          card: cardData.cardID,
                          note: `شبكة: ${networkName} - رقم الكرت: ${cardData.cardID}`,
                        }
                      : item
                  ),
                  lastUpdated: doneNow,
                });
              }

              finishBatch.update(globalTxRef, {
                status: 'completed',
                readiness: 'جاهزة',
                cardNumber: cardData.cardID,
                notes: `شبكة: ${networkName} - رقم الكرت: ${cardData.cardID}`,
              });
              await finishBatch.commit();
            } catch (e) {
              console.warn('Background finishBatch error:', e);
            }
          })();
        };

        timeoutId = setTimeout(() => {
          if (!isHandled) {
            isHandled = true;
            cleanup();
            setIsProcessing(false);
            setDelayedOrderPopupOpen(true);
            resolve();
          }
        }, 50000);

        unsubscribe = onSnapshot(baityOrderRef, (snap) => {
          if (!snap.exists() || isHandled) return;
          const data = snap.data();
          if (data?.status === 'completed' && data?.cardNumber) {
            handleOrderSuccess(
              { cardID: data.cardNumber, cardPass: data.cardPass || '' },
              data.uuidOrder
            );
          } else if (data?.status === 'failed') {
            handleOrderFailure(data.errorReason || '');
          }
        });

        fetch(`/services/networks-api/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: selectedCategory.id,
            externalRef,
          }),
        })
          .then(async (response) => {
            const result = await response.json().catch(() => ({}));
            if (isHandled) return;

            if (response.ok && result?.status === 200 && result?.data?.order?.card?.cardID) {
              handleOrderSuccess(result.data.order.card, result.data.order.uuidOrder);
            } else if (
              response.ok &&
              result?.status === 200 &&
              result?.data?.order?.uuidOrder &&
              !result?.data?.order?.card
            ) {
              // الطلب قيد الانتظار لدى المزود وسيصل عبر الويب هوك
            } else {
              const errMsg = result?.message || 'فشل الشراء من المزود';
              handleOrderFailure(errMsg, result?.isStockOut);
            }
          })
          .catch((err) => {
            if (!isHandled) {
              handleOrderFailure(err?.message || 'خطأ في الاتصال بالمزود');
            }
          });
      });
    } catch (err: any) {
      console.error('Purchase execution error:', err);
      if (!purchaseSuccessfullyCommitted && isExternalOrderDeducted && userDocRef) {
        try {
          const fallbackBatch = writeBatch(firestore);
          fallbackBatch.update(userDocRef, { balance: increment(effectivePrice) });
          await fallbackBatch.commit();
        } catch (refundErr) {
          console.error('Fallback refund failed:', refundErr);
        }
      }
      toast({
        variant: 'destructive',
        title: 'فشل عملية الشراء',
        description: err?.message || 'حدث خطأ غير متوقع.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCardDetails = () => {
    if (!purchasedCard) return;
    const text = purchasedCard.cardPass
      ? `رقم الكرت: ${purchasedCard.cardID}\nكلمة المرور: ${purchasedCard.cardPass}`
      : purchasedCard.cardID;
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: 'تم نسخ بيانات الكرت بنجاح.' });
  };

  const handleSendSms = () => {
    if (!purchasedCard || !smsRecipient) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى إدخال رقم الزبون.' });
      return;
    }
    const name = userProfile?.displayName || 'عميلنا';
    const balance = (userProfile?.balance ?? 0).toLocaleString('en-US');
    const cardInfo = purchasedCard.cardPass
      ? `${purchasedCard.cardID} (كلمة المرور: ${purchasedCard.cardPass})`
      : purchasedCard.cardID;

    const msg = `${name} 🖐️\nنشكرك على طلبك من ستار موبايل 💙\n\n*معلومات الكرت:*\nالشبكة : ${networkName}\nالفئة: ${selectedCategory?.name || ''}\nرقم الكرت: ${cardInfo}\n\n*رصيدك:* ${balance} ريال\n\nتطبيق ستار موبايل :\nhttps://star26.vercel.app\n\nجهّزنا لك هالكرت، تقدر تشحن فيه وتستانس 🔥`;

    window.location.href = `sms:${smsRecipient}?body=${encodeURIComponent(msg)}`;
    setIsSmsDialogOpen(false);
  };

  const finalConfirmPrice = selectedCategory
    ? getEffectiveCardPrice(selectedCategory.price)
    : 0;
  const currentBalance = userProfile?.balance ?? 0;

  return (
    <>
      <audio ref={audioRef} src="/ashar.mp3" preload="auto" />
      <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
        <SimpleHeader title={networkName} />

        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {/* Hero Header */}
          <div className="bg-mesh-gradient pt-5 pb-8 px-6 rounded-b-[40px] shadow-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl" />

            <div className="relative flex flex-col items-center text-center space-y-3 animate-in fade-in-0 zoom-in-95 duration-500">
              <div className="bg-white/20 p-3.5 rounded-[22px] backdrop-blur-md border border-white/25 shadow-xl">
                <Wifi className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white drop-shadow-sm">{networkName}</h2>
                {networkLocation && (
                  <p className="text-[11px] text-white/85 font-bold bg-white/15 py-1 px-3.5 rounded-full border border-white/10 inline-block">
                    {networkLocation}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Categories List */}
          <div className="px-4 mt-5 space-y-3">
            {isLoadingCategories && categories.length === 0 ? (
              <div className="flex justify-center py-16">
                <ProcessingOverlay />
              </div>
            ) : error === 'uncached_offline' ? (
              <div className="text-center p-6 bg-amber-500/10 border border-amber-500/20 rounded-[28px] space-y-3 my-4">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
                  <WifiOff className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="text-base font-black text-foreground">الفئات غير محملة مسبقاً</h3>
                <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                  يرجى الاتصال بالإنترنت وفتح هذه الشبكة مرة واحدة فقط ليتم حفظ فئاتها تلقائياً في هاتفك.
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-destructive/5 rounded-[28px] border border-destructive/15 my-4">
                <AlertCircle className="w-10 h-10 text-destructive mb-3" />
                <p className="font-black text-destructive text-sm">{error}</p>
              </div>
            ) : sortedCategories.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-bold">
                لا توجد فئات متاحة حالياً لهذه الشبكة.
              </div>
            ) : (
              sortedCategories.map((cat, idx) => {
                const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                const finalPrice = getEffectiveCardPrice(cat.price);
                const capacityText = getCategoryCapacity(cat);
                const validityText = getCategoryValidity(cat);

                return (
                  <Card
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat)}
                    style={{ animationDelay: `${Math.min(idx * 65, 500)}ms` }}
                    className="group relative overflow-hidden cursor-pointer border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 rounded-[26px] shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-4 fill-mode-both"
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div
                          className={cn(
                            'h-12 w-12 rounded-[18px] flex items-center justify-center shrink-0 shadow-lg bg-gradient-to-br text-white group-hover:scale-110 transition-transform duration-300',
                            gradient
                          )}
                        >
                          <Wifi className="h-6 w-6" />
                        </div>

                        <div className="text-right space-y-1.5 min-w-0 flex-1">
                          <h4 className="text-sm font-black text-foreground group-hover:text-primary transition-colors truncate">
                            {cat.name}
                          </h4>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                              <Database className="h-3 w-3" />
                              <span>التخزين: {capacityText}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" />
                              <span>الصلاحية: {validityText}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-baseline gap-1 leading-none">
                          <span className="text-xl font-black tracking-tight text-primary">
                            {finalPrice.toLocaleString('en-US')}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">ر.ي</span>
                        </div>
                        <Button
                          size="sm"
                          className="h-8 rounded-xl text-[11px] font-black px-4 bg-mesh-gradient text-white shadow-md shadow-primary/20 border-none"
                        >
                          شراء
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Toaster />

      {/* منبثق تأكيد الشراء الفخم */}
      <Dialog
        open={isConfirming}
        onOpenChange={(open) => !open && !isProcessing && setIsConfirming(false)}
      >
        <DialogContent className="rounded-[34px] max-w-[92%] sm:max-w-sm p-0 overflow-hidden bg-white dark:bg-slate-900 z-[10000] border-none shadow-2xl outline-none [&>button]:hidden">
          {selectedCategory && (
            <div>
              <div className="bg-mesh-gradient px-6 pt-7 pb-6 text-center text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  {isOffline ? (
                    <MessageSquare className="h-7 w-7 text-white animate-pulse" />
                  ) : (
                    <ShieldCheck className="h-8 w-8 text-white" />
                  )}
                </div>
                <DialogTitle className="text-lg font-black text-white">
                  {isOffline ? 'طلب كرت بدون إنترنت (SMS)' : 'تأكيد شراء الكرت'}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-white/85 mt-1">
                  {networkName}
                </DialogDescription>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">الفئة المختارة</span>
                    <span className="text-sm font-black text-foreground">
                      {selectedCategory.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-muted-foreground mb-0.5">التخزين</p>
                      <p className="text-xs font-black text-primary">
                        {getCategoryCapacity(selectedCategory)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-muted-foreground mb-0.5">الصلاحية</p>
                      <p className="text-xs font-black text-foreground">
                        {getCategoryValidity(selectedCategory)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/15 flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground">المبلغ المطلوب</p>
                    <p className="text-2xl font-black text-primary leading-tight">
                      {finalConfirmPrice.toLocaleString('en-US')}{' '}
                      <span className="text-xs font-bold">ريال</span>
                    </p>
                  </div>
                  <div className="text-left bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-black/5 dark:border-white/10">
                    <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 justify-end">
                      <Wallet className="h-3 w-3 text-primary" />
                      رصيدك الحالي
                    </p>
                    <p className="text-xs font-black text-foreground">
                      {currentBalance.toLocaleString('en-US')} ر.ي
                    </p>
                  </div>
                </div>

                <DialogFooter className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    className={cn(
                      'w-full h-12 rounded-2xl font-black text-sm shadow-lg border-none',
                      isOffline
                        ? 'bg-[#0048ad] hover:bg-[#003887] text-white gap-2'
                        : 'bg-mesh-gradient text-white shadow-primary/25'
                    )}
                    onClick={handlePurchase}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : isOffline ? (
                      <>
                        <MessageSquare className="h-4 w-4" />
                        <span>إرسال (SMS)</span>
                      </>
                    ) : (
                      'تأكيد الشراء'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-2xl font-black text-sm mt-0"
                    onClick={() => setIsConfirming(false)}
                    disabled={isProcessing}
                  >
                    إلغاء
                  </Button>
                </DialogFooter>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* منبثق الكرت الفوري بعد الشراء */}
      {purchasedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 animate-in fade-in-0 duration-150">
          <Card className="w-full max-w-sm text-center shadow-2xl rounded-[38px] overflow-hidden border-none bg-background">
            <CardContent className="p-7 space-y-5">
              <div className="bg-green-500 p-7 flex justify-center mb-2 rounded-t-[38px] -m-7">
                <div className="bg-white/20 p-3.5 rounded-full animate-bounce">
                  <CheckCircle className="h-14 w-14 text-white" />
                </div>
              </div>
              <div className="pt-2 space-y-1">
                <h2 className="text-2xl font-black text-green-600">تم الشراء بنجاح</h2>
                <p className="text-xs font-bold text-muted-foreground">
                  {networkName} — {selectedCategory?.name}
                </p>
              </div>

              <div className="p-5 bg-muted rounded-[24px] border-2 border-dashed border-primary/20 font-mono text-center space-y-2">
                <p className="text-[10px] font-sans font-bold text-muted-foreground uppercase">
                  رقم الكرت
                </p>
                <p className="text-2xl font-black tracking-widest text-foreground select-all">
                  {purchasedCard.cardID}
                </p>
              </div>

              <Button className="w-full rounded-2xl h-12 font-black" onClick={handleCopyCardDetails}>
                <Copy className="ml-2 h-4 w-4" /> نسخ
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground font-bold"
                onClick={() => {
                  setPurchasedCard(null);
                  setSelectedCategory(null);
                }}
              >
                إغلاق
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* منبثق إرسال SMS للزبون */}
      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="rounded-[32px] max-w-sm p-6 z-[10002] bg-white dark:bg-slate-900 border-none shadow-2xl">
          <DialogHeader>
            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Smartphone className="text-primary h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl font-black">إرسال كرت لزبون</DialogTitle>
            <DialogDescription className="text-center font-bold">
              أدخل رقم جوال الزبون لإرسال بيانات الكرت عبر الرسائل.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="7xxxxxxxx"
              type="tel"
              value={smsRecipient}
              onChange={(e) => setSmsRecipient(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className="text-center text-2xl font-black h-14 rounded-2xl border-2 focus-visible:ring-primary tracking-widest bg-muted/20"
            />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleSendSms}
              className="w-full h-12 rounded-2xl font-black text-base"
              disabled={!smsRecipient || smsRecipient.length < 9}
            >
              إرسال
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl font-black text-base mt-0"
              onClick={() => setIsSmsDialogOpen(false)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* منبثق التأخير (50 ثانية) */}
      <Dialog open={delayedOrderPopupOpen} onOpenChange={setDelayedOrderPopupOpen}>
        <DialogContent
          className="rounded-[32px] max-w-sm p-6 z-[10002] bg-white dark:bg-slate-900 border-none shadow-2xl text-center"
          dir="rtl"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500 mb-1">
              <Clock className="w-8 h-8 animate-pulse text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white">
              سنقوم بإرسال الكرت إليك بعد لحظات
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              طلبك قيد المعالجة لدى المزود وسيصلك الكرت وتجده في سجل العمليات فور صدوره.
            </DialogDescription>
            <Button
              className="w-full mt-3 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-base shadow-lg"
              onClick={() => setDelayedOrderPopupOpen(false)}
            >
              حسناً
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isProcessing && <ProcessingOverlay message="جاري استخراج الكرت..." />}
    </>
  );
}

export default function NetworkPurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <ProcessingOverlay />
        </div>
      }
    >
      <NetworkPurchasePageComponent />
    </Suspense>
  );
}
