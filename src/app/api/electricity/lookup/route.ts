
import { NextResponse } from 'next/server';

/**
 * @fileOverview نظام الاستعلام عن فواتير الكهرباء (وادي حضرموت).
 * يقوم بجلب صفحة HTML وتحليلها لاستخراج البيانات المطلوبة.
 */

export async function POST(req: Request) {
  try {
    const { number } = await req.json();

    if (!number) {
      return NextResponse.json({ success: false, message: 'رقم المشترك مطلوب' }, { status: 400 });
    }

    const targetUrl = `https://pec-wadi.com/fatoora?query=${number}`;
    
    const response = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error('فشل الاتصال بسيرفر مؤسسة الكهرباء.');
    }

    const html = await response.text();

    // استخدام Regex لاستخراج البيانات من الـ HTML كما في توثيق العميل
    const nameMatch = html.match(/الإسم\s*:\s*(.*?)<br>/);
    const amountMatch = html.match(/إجمالي المبلغ المستحق\s*([0-9]+)/);
    const dateMatch = html.match(/التاريخ:\s*([^<]+)/);

    const name = nameMatch ? nameMatch[1].trim() : null;
    const amount = amountMatch ? amountMatch[1] : null;
    const date = dateMatch ? dateMatch[1].trim() : null;

    if (name || amount) {
        return NextResponse.json({
            success: true,
            data: {
                name: name || 'غير متوفر',
                amount: amount || '0',
                date: date || 'غير متوفر',
                subscriberNumber: number
            }
        });
    }

    return NextResponse.json({
      success: false,
      message: 'لم يتم العثور على بيانات لهذا الرقم. تأكد من صحة رقم المشترك.'
    });

  } catch (error: any) {
    console.error('Electricity Inquiry Error:', error);
    return NextResponse.json({ success: false, message: 'فشل الاتصال بسيرفر المنظومة' }, { status: 500 });
  }
}
