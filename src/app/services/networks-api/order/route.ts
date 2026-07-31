
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE_URL = 'https://apis.baitynet.net/api/partner/orders';

export async function POST(
  request: Request
) {
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY;
  const USER_IDENTIFIER = process.env.BAITYNET_NETWORKS_USER_PHONE;
  const USER_PASSWORD = process.env.BAITYNET_NETWORKS_USER_PASS;

  try {
    const body = await request.json();
    const { classId } = body;

    if (!classId) {
      return new NextResponse(JSON.stringify({ message: 'Class ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!API_KEY || !USER_IDENTIFIER || !USER_PASSWORD) {
        return new NextResponse(JSON.stringify({ message: 'إعدادات شراء الكروت ناقصة في فيرسل.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const externalApiBody = {
      data: {
        class: classId,
        user: { 
          identifier: USER_IDENTIFIER.trim(), 
          password: USER_PASSWORD.trim()
        },
      }
    };
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StarMobileApp/1.0',
      },
      body: JSON.stringify(externalApiBody),
      cache: 'no-store'
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Order creation failed (${response.status}):`, errorText.substring(0, 200));
      return new NextResponse(
        JSON.stringify({ message: 'فشل الشراء\nيرجى التواصل مع الادارة 770326828' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (contentType.includes("application/json")) {
        const data = await response.json();
        
        // التحقق من حالة الطلب الداخلية بناءً على توثيق بيتي
        if (data.status !== 200) {
            return new NextResponse(
                JSON.stringify({ message: 'فشل الشراء\nيرجى التواصل مع الادارة 770326828' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        return NextResponse.json(data);
    } else {
        const text = await response.text();
        console.error("Order API returned HTML:", text.substring(0, 300));
        return new NextResponse(
            JSON.stringify({ message: 'فشل الشراء\nيرجى التواصل مع الادارة 770326828' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Order route exception on Vercel:', error);
    return new NextResponse(
        JSON.stringify({ message: 'فشل الشراء\nيرجى التواصل مع الادارة 770326828' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
