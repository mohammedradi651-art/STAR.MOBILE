'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * مكون صامت يستمع للأخطاء. 
 * تم تعطيل خاصية "throw" لمنع انهيار التطبيق بالكامل عند حدوث خطأ في الخلفية.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: any) => {
      console.error("Firebase Operational Error:", error);
      // تم إيقاف setError(error) و throw error لمنع الـ Client-side exception
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
