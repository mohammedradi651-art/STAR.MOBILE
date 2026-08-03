
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BASE_API_URL = 'https://apis.baitynet.net/api/partner/networks';

export async function GET(
  request: Request,
  { params }: { params: { networkId: string } }
) {
  const networkId = params.networkId;
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY || process.env.BAITYNET_BALANCE_API_KEY;

  if (!networkId) {
    return NextResponse.json({ message: 'Network ID required' }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ message: 'API Key missing' }, { status: 500 });
  }

  try {
    const response = await fetch(`${BASE_API_URL}/${networkId}/classes`, {
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
        return NextResponse.json({ message: 'فشل تحميل الفئات' }, { status: response.status });
    }
    
    // إرجاع المصفوفة مباشرة للمتصفح
    if (responseData && Array.isArray(responseData.data)) {
        return NextResponse.json(responseData.data);
    }

    return NextResponse.json({ message: 'تنسيق غير مدعوم' }, { status: 502 });

  } catch (error: any) {
    console.error('Classes Fetch Exception:', error);
    return NextResponse.json({ message: 'خطأ في جلب الفئات' }, { status: 500 });
  }
}
