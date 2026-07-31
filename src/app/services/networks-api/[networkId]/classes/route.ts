
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_BASE_URL = 'https://apis.baitynet.net/api/partner/networks';

export async function GET(
  request: Request,
  { params }: { params: { networkId: string } }
) {
  const networkId = params.networkId;
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY;

  if (!networkId) {
    return new NextResponse('Network ID is required', { status: 400 });
  }

  if (!API_KEY) {
    return new NextResponse(
        JSON.stringify({ message: 'BAITYNET_NETWORKS_API_KEY is missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${networkId}/classes`, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StarMobileApp/1.0',
      },
      next: { revalidate: 0 },
      cache: 'no-store'
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Baitynet Classes API failed (${response.status}):`, errorText.substring(0, 200));
      return new NextResponse(
        JSON.stringify({ message: `API Error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data && Array.isArray(data.data)) {
            return NextResponse.json(data.data);
        } else {
            return new NextResponse(
                JSON.stringify({ message: 'Invalid classes format from provider' }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } else {
        const text = await response.text();
        console.error("Classes API returned HTML:", text.substring(0, 300));
        return new NextResponse(
            JSON.stringify({ message: 'المصدر أعاد صفحة خطأ بدلاً من البيانات. تأكد من تفعيل الـ API Key للشبكة.' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Error fetching classes on Vercel:', error);
    return new NextResponse(
        JSON.stringify({ message: 'فشل تحميل فئات الكروت.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
