
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'https://apis.baitynet.net/api/partner/balance';

export async function GET() {
  const API_KEY = process.env.BAITYNET_NETWORKS_API_KEY;

  if (!API_KEY) {
    return new NextResponse(
        JSON.stringify({ message: 'BAITYNET_NETWORKS_API_KEY is missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StarMobileApp/1.0',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Baity Balance API Error:", errorText);
      return new NextResponse(
        JSON.stringify({ message: `API Error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await response.json();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Baity Balance Route Exception:", error);
    return new NextResponse(
        JSON.stringify({ message: 'فشل جلب رصيد بيتي.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
