
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * توجيه لصفحة خدمات واي الجديدة.
 */
export default function WhyServicesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/why');
  }, [router]);
  return null;
}
