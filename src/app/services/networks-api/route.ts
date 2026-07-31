
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EXTERNAL_API_URL = 'https://apis.baitynet.net/api/partner/networks';

export async function GET() {
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY;

  if (!API_KEY) {
    console.error('BAITYNET_NETWORKS_API_KEY is missing');
    return new NextResponse(
        JSON.stringify({ message: 'إعدادات النظام ناقصة: مفتاح API غير موجود' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const response = await fetch(EXTERNAL_API_URL, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StarMobileApp/1.0', // إضافة User-Agent لضمان قبول الطلب في Vercel
      },
      next: { revalidate: 0 },
      cache: 'no-store'
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Baitynet API failed with status ${response.status}:`, errorText.substring(0, 200));
      return new NextResponse(
        JSON.stringify({ message: `خطأ من المصدر الخارجي: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data && Array.isArray(data.data)) {
            return NextResponse.json(data.data);
        } else {
            return new NextResponse(
                JSON.stringify({ message: 'تنسيق البيانات من المصدر غير صحيح' }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } else {
        const text = await response.text();
        console.error("Vercel received HTML instead of JSON from Baitynet:", text.substring(0, 300));
        return new NextResponse(
            JSON.stringify({ message: 'تعذر جلب الشبكات: المصدر أعاد استجابة غير صالحة. يرجى التحقق من المفاتيح في فيرسل.' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Baitynet Fetch Exception on Vercel:', error);
    return new NextResponse(
        JSON.stringify({ message: 'حدث خطأ في الاتصال بالمزود الخارجي.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
