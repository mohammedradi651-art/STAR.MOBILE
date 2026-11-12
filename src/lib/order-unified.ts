'use client';

import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

/**
 * خطاف مخصص لقراءة مستند موحد من مجموعة Order بدون استهلاك قراءات متعددة
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

/**
 * دالة لتحديث عنصر محدد داخل مصفوفة مستند في Order (مثل تحديث حالة طلب كهرباء، ماء، سحب، إيداع)
 */
export async function updateOrderItemInDoc(
  firestore: any,
  docName: string,
  itemId: string,
  updates: Record<string, any>,
  arrayField: string = 'requests'
) {
  if (!firestore) return;
  const orderDocRef = doc(firestore, 'Order', docName);
  const snap = await getDoc(orderDocRef);
  if (!snap.exists()) return;

  const currentList = snap.data()[arrayField] || [];
  const updatedList = currentList.map((item: any) => {
    if (item.id === itemId) {
      return { ...item, ...updates, updatedAt: new Date().toISOString() };
    }
    return item;
  });

  await updateDoc(orderDocRef, {
    [arrayField]: updatedList,
    updatedAt: new Date().toISOString()
  });
}
