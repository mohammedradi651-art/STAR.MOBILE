'use client';

import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

/**
 * خطاف مخصص لقراءة مستند موحد من مجموعة Order بدون استهلاك قراءات متعددة
 * @param docName اسم المستند داخل Order مثل: 'depositRequests', 'electricityRequests', 'waterRequests', 'paymentMethods', 'products', 'clientDebts'
 * @param arrayField الحقل الذي يحتوي على المصفوفة داخل المستند (افتراضياً: 'requests')
 */
export function useOrderDocArray<T = any>(
  docName: string,
  arrayField: string = 'requests'
): { data: T[]; isLoading: boolean; error: any; docData: any } {
  const firestore = useFirestore();

  const docRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'Order', docName) : null),
    [firestore, docName]
  );

  const { data: rawDoc, isLoading, error } = useDoc<any>(docRef);

  const list: T[] = (rawDoc && rawDoc[arrayField] && Array.isArray(rawDoc[arrayField]))
    ? rawDoc[arrayField]
    : [];

  return {
    data: list,
    isLoading,
    error,
    docData: rawDoc
  };
}

/**
 * دالة مساعدة لإضافة عنصر جديد إلى مصفوفة مستند داخل Order
 */
export async function addOrderRequest(firestore: any, docName: string, newItem: any, arrayField: string = 'requests') {
  if (!firestore) return;
  const targetDoc = doc(firestore, 'Order', docName);
  const itemWithId = {
    id: newItem.id || (Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7)),
    createdAt: new Date().toISOString(),
    ...newItem
  };

  await updateDoc(targetDoc, {
    [arrayField]: arrayUnion(itemWithId),
    updatedAt: new Date().toISOString()
  });

  return itemWithId;
}

