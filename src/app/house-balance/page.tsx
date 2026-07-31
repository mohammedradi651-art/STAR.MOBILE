'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * تم حذف هذه الصفحة بناءً على طلب العميل.
 * يتم توجيه المستخدم تلقائياً لصفحة خدمات الاتصالات.
 */
export default function HouseBalanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/telecom-services');
  }, [router]);
  return null;
}
