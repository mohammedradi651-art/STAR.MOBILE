
import { NextResponse } from 'next/server';

/**
 * @fileOverview نظام الاستعلام المطور لفواتير المياه (وادي حضرموت).
 * يقوم بجلب الجدول من صفحة المؤسسة واستخراج البيانات من الصف الثاني.
 */

export async function POST(req: Request) {
  try {
    const { city, number } = await req.json();

    if (!city || !number) {
      return NextResponse.json({ success: false, message: 'رقم المشترك والمدينة مطلوبان' }, { status: 400 });
    }

    const targetUrl = `https://lwscwhd.com/f?c=${city}&query=${number}`;
    
    const response = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error('فشل الاتصال بسيرفر مؤسسة المياه.');
    }

    const html = await response.text();

    // 1. استخراج الصفوف من الجدول
    const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    
    if (!rows || rows.length < 2) {
        return NextResponse.json({
            success: false,
            message: 'لم يتم العثور على بيانات لهذا الرقم في المنطقة المختارة.'
        });
    }

    // 2. قراءة بيانات الصف الثاني (البيانات الفعلية بعد العناوين)
    const dataRow = rows[1];
    const cells = dataRow.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);

    if (!cells || cells.length < 4) {
        return NextResponse.json({
            success: false,
            message: 'تنسيق البيانات في الموقع غير متوقع حالياً.'
        });
    }

    // وظيفة لتنظيف النص من وسوم الـ HTML
    const clean = (str: string) => str.replace(/<[^>]*>?/gm, '').trim();

    const extractedNumber = clean(cells[0]);
    const name = clean(cells[1]);
    const period = clean(cells[2]);
    const amount = clean(cells[3]);

    if (name && amount) {
        return NextResponse.json({
            success: true,
            data: {
                name: name,
                amount: amount,
                period: period,
                subscriberNumber: extractedNumber || number,
                cityCode: city
            }
        });
    }

    return NextResponse.json({
      success: false,
      message: 'تعذر استخراج بيانات الفاتورة. تأكد من صحة الرقم.'
    });

  } catch (error: any) {
    console.error('Water Inquiry Error:', error);
    return NextResponse.json({ success: false, message: 'فشل الاتصال بسيرفر المنظومة' }, { status: 500 });
  }
}
