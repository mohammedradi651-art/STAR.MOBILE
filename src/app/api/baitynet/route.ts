
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE_URL = 'https://apis.okamel.org/api/partner-yem/bill-balance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const API_KEY = process.env.BAITYNET_BALANCE_API_KEY;
    const AUTH_TOKEN = process.env.BAITYNET_BALANCE_AUTH_TOKEN;
    
    if (!API_KEY || !AUTH_TOKEN) {
        return new NextResponse(
            JSON.stringify({ message: 'إعدادات استعلام الرصيد ناقصة في فيرسل.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY.trim(),
        'Authorization': `Bearer ${AUTH_TOKEN.trim()}`,
        'User-Agent': 'StarMobileApp/1.0',
      },
      body: JSON.stringify({ data: body }),
      cache: 'no-store'
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Balance API Error:", errorText.substring(0, 200));
        return new NextResponse(
            JSON.stringify({ message: 'فشلت عملية الاستعلام من المصدر.' }),
            { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
    }
    
    if (contentType.includes("application/json")) {
        const result = await response.json();
        return NextResponse.json(result);
    } else {
        const text = await response.text();
        console.error("Balance API returned HTML:", text.substring(0, 300));
        return new NextResponse(
            JSON.stringify({ message: 'استجابة غير صالحة من سيرفر الاستعلام.' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error(`Balance Route Exception:`, error);
    return new NextResponse(
      JSON.stringify({ message: 'حدث خطأ داخلي أثناء الاستعلام.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
