import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit, doc, writeBatch, increment } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCFwJc9qTFMthFEvaOlV_WSTTkuG-L2ARg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-239662212-1b7b6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-239662212-1b7b6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-239662212-1b7b6.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "330089855562",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:330089855562:web:6565f4922129a0083163eb"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export async function GET(request: Request) {
  try {
    const q = query(
      collection(firestore, 'paymentTransactions'),
      where('status', '==', 'pending'),
      limit(20)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      return NextResponse.json({ success: true, message: 'لا توجد عمليات معلقة', count: 0 });
    }

    const host = request.headers.get('host') || 'star26.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const results: any[] = [];
    const now = Date.now();

    for (const docSnap of snap.docs) {
      const tx = docSnap.data();
      const transid = tx.transid || docSnap.id;

      // تجنب فحص العمليات التي تم إنشاؤها منذ أقل من 15 ثانية (لإعطاء فرصة للطلب المباشر)
      const txCreatedAt = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
      if (now - txCreatedAt < 15000) {
        continue;
      }

      try {
        const telecomRes = await fetch(`${protocol}://${host}/api/telecom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'status',
            transid: transid,
            mobile: tx.recipientPhoneNumber
          })
        });

        const data = await telecomRes.json();
        const isBan = data.isBan === 1 || data.isBan === '1';
        const isDone = data.isDone === 1 || data.isDone === '1';

        if (isBan) {
          if (!tx.refunded) {
            const cancellationReason = data.reason || data.resultDesc || 'تم إلغاء العملية من المزود';
            const currentNotes = tx.notes || '';
            const updatedNotes = currentNotes
              ? `${currentNotes}\nالسبب من المزود: ${cancellationReason}`
              : `السبب من المزود: ${cancellationReason}`;

            const updatePayload = {
              status: 'failed',
              readiness: 'فاشلة',
              refunded: true,
              providerMessage: cancellationReason,
              notes: updatedNotes,
              failedAt: new Date().toISOString()
            };

            const batch = writeBatch(firestore);
            if (tx.userId && tx.amount > 0) {
              const userRef = doc(firestore, 'users', tx.userId);
              batch.update(userRef, { balance: increment(tx.amount) });
            }
            batch.update(docSnap.ref, updatePayload);
            if (tx.userId) {
              const userTxRef = doc(firestore, `users/${tx.userId}/transactions`, transid);
              batch.update(userTxRef, updatePayload);
            }
            await batch.commit();

            results.push({ transid, action: 'refunded_and_failed', reason: cancellationReason });
          }
        } else if (isDone) {
          const updatePayload = {
            status: 'success',
            readiness: 'جاهزة',
            providerMessage: data.resultDesc || 'تم تنفيذ العملية بنجاح من المزود',
            completedAt: new Date().toISOString()
          };

          const batch = writeBatch(firestore);
          batch.update(docSnap.ref, updatePayload);
          if (tx.userId) {
            const userTxRef = doc(firestore, `users/${tx.userId}/transactions`, transid);
            batch.update(userTxRef, updatePayload);
          }
          await batch.commit();

          results.push({ transid, action: 'marked_success' });
        } else {
          results.push({ transid, action: 'still_pending' });
        }
      } catch (err: any) {
        results.push({ transid, error: err.message });
      }
    }

    return NextResponse.json({ success: true, processedCount: results.length, details: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
