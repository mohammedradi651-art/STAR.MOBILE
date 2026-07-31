'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * تمت إزالة خدمات شركة واي بناءً على طلب العميل.
 * يتم توجيه المستخدم تلقائياً لصفحة خدمات الاتصالات.
 */
export default function WhyServicesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/telecom-services');
  }, [router]);
  return null;
}
