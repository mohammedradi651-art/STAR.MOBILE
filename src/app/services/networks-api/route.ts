
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * @fileOverview محرك جلب الشبكات من بيتي (v2)
 * يعتمد على التوثيق الجديد لضمان استقرار ظهور الشبكات الخارجية.
 */

const BASE_API_URL = 'https://apis.baitynet.net/api/partner/networks';

export async function GET() {
  // استخدام مفاتيح الربط المتاحة
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY || process.env.BAITYNET_BALANCE_API_KEY;

  if (!API_KEY) {
    console.error('Baity API Key is missing in environment variables');
    return NextResponse.json({ message: 'إعدادات الربط غير مكتملة' }, { status: 500 });
  }

  try {
    const response = await fetch(BASE_API_URL, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StarMobileApp/1.6',
      },
      cache: 'no-store'
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Baity API Error (${response.status}):`, responseData);
      return NextResponse.json({ message: 'فشل الجلب من المصدر' }, { status: response.status });
    }
    
    // التحقق من وجود البيانات حسب التوثيق الجديد
    // التوثيق يقول: "data": [ { "id": 12, ... } ]
    if (responseData && Array.isArray(responseData.data)) {
        return NextResponse.json(responseData.data);
    } 
    
    // إذا كانت البيانات مصفوفة مباشرة (حالة احتياطية)
    if (Array.isArray(responseData)) {
        return NextResponse.json(responseData);
    }

    return NextResponse.json({ message: 'تنسيق بيانات غير متوقع' }, { status: 502 });

  } catch (error: any) {
    console.error('Baity Fetch Exception:', error.message);
    return NextResponse.json({ message: 'حدث خطأ في الاتصال بالمزود' }, { status: 500 });
  }
}
