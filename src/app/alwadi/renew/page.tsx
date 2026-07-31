'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * تم دمج هذه الصفحة في الصفحة الرئيسية للمنظومة (alwadi/page.tsx)
 * لتقليل عدد النقرات وتحسين تجربة المستخدم.
 */
export default function AlwadiRenewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/alwadi');
  }, [router]);
  return null;
}
