
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect this page to the main internet-landline page
export default function LandlineServicesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/internet-landline');
  }, [router]);
  return null;
}
