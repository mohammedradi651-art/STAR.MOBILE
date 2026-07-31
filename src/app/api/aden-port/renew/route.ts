
import { NextResponse } from 'next/server';
import { initializeServerFirebase } from '@/firebase/server-init';
import { doc, getDoc, increment, collection, writeBatch } from 'firebase/firestore';

const ODOO_BASE = 'https://api.alwaadi.net';
const ODOO_DB = 'admin';
const ODOO_USER = '770326M';
const ODOO_PASS = '84a167f4e26e831ba4bea62ce3c65b1f54cf3656';

export async function POST(req: Request) {
  try {
    const { userId, subscriber_id, service_id, price, packageName, subscriberName } = await req.json();

    if (!userId || !subscriber_id || !service_id) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const { firestore } = initializeServerFirebase();
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const currentBalance = userSnap.data().balance || 0;
    if (currentBalance < price) {
      return NextResponse.json({ error: 'رصيدك غير كافٍ لإتمام العملية' }, { status: 400 });
    }

    // 1. تسجيل الدخول للحصول على الجلسة
    const loginResponse = await fetch(`${ODOO_BASE}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        params: {
          db: ODOO_DB,
          login: ODOO_USER,
          password: ODOO_PASS
        }
      })
    });

    const sessionData = await loginResponse.json();
    if (!sessionData.result) {
        return NextResponse.json({ error: 'فشل التوثيق مع المنظومة' }, { status: 401 });
    }

    // 2. تنفيذ التجديد في Odoo عبر dataset/call_kw
    const odooResponse = await fetch(`${ODOO_BASE}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "renewal.proces",
          method: "create",
          args: [{
            subscriber: subscriber_id,
            renewal_categories: service_id
          }]
        },
        id: 2
      })
    });

    const odooData = await odooResponse.json();

    if (odooData.error) {
      return NextResponse.json({ error: odooData.error.message || 'فشل التجديد في المنظومة' }, { status: 400 });
    }

    // 3. تحديث الرصيد وتسجيل العملية في Firebase
    const batch = writeBatch(firestore);
    const now = new Date().toISOString();

    batch.update(userRef, { balance: increment(-price) });

    const txRef = doc(collection(firestore, 'users', userId, 'transactions'));
    batch.set(txRef, {
      userId,
      transactionDate: now,
      amount: price,
      transactionType: 'تجديد بندر عدن',
      notes: `تجديد باقة ${packageName} للمشترك: ${subscriberName}`,
      subscriberName: subscriberName
    });

    const notifRef = doc(collection(firestore, 'users', userId, 'notifications'));
    batch.set(notifRef, {
      title: 'تم التجديد بنجاح',
      body: `تم تجديد باقة بندر عدن (${packageName}) بنجاح للمشترك ${subscriberName}.`,
      timestamp: now
    });

    await batch.commit();

    return NextResponse.json({ success: true, result: odooData.result });

  } catch (error: any) {
    console.error('Aden Port Renewal Error:', error);
    return NextResponse.json({ error: 'حدث خطأ داخلي أثناء معالجة الطلب' }, { status: 500 });
  }
}
