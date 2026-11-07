'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyNetworkPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/my-network/manage');
  }, [router]);

  return null;
}
