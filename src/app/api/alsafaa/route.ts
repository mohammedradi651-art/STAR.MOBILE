import { NextResponse } from 'next/server';

/**
 * @fileOverview نظام الاستعلام لشبكة الصفاء الرقمية عبر تحليل HTML.
 * يتصل بالسيرفر عبر POST ويستخرج البيانات من الجدول المطلوب.
 */

export async function POST(request: Request) {
    try {
        const { cardNumber } = await request.json();

        if (!cardNumber) {
            return NextResponse.json({ success: false, message: 'رقم البطاقة مطلوب.' }, { status: 400 });
        }

        const TARGET_URL = 'http://alsafa.ddns.net:8080/result.html?result=json';
        
        // إرسال الطلب بتنسيق x-www-form-urlencoded
        const response = await fetch(TARGET_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `cardid=${encodeURIComponent(cardNumber)}`,
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('فشل الاتصال بسيرفر شبكة الصفاء.');
        }

        const html = await response.text();

        // التحقق من وجود الجدول المطلوب
        if (!html.includes('styled-table')) {
            return NextResponse.json({ 
                success: false, 
                message: 'عذراً، رقم الكرت غير موجود.' 
            });
        }

        // استخراج البيانات باستخدام Regex بناءً على منطق الأعمدة المطلوب
        // 1. استخراج الاسم
        const nameMatch = html.match(/<th[^>]*>(.*?)<\/th>\s*<th[^>]*>الاسم<\/th>/i) || 
                         html.match(/<td[^>]*>(.*?)<\/td>\s*<td[^>]*>الاسم<\/td>/i);
        
        // 2. استخراج رقم البطاقة
        const cardMatch = html.match(/<td[^>]*>(.*?)<\/td>\s*<td[^>]*>رقم البطاقة<\/td>/i);
        
        // 3. استخراج حالة الاشتراك
        const statusMatch = html.match(/<td[^>]*>(.*?)<\/td>\s*<td[^>]*>حالة الاشتراك<\/td>/i);

        // إذا لم يتم العثور على البيانات الأساسية نرجع فشل
        if (!nameMatch || !statusMatch) {
            return NextResponse.json({ 
                success: false, 
                message: 'عذراً، رقم الكرت غير موجود.' 
            });
        }

        const subscriberName = nameMatch[1].replace(/<[^>]*>/g, '').trim();
        const subscriptionStatus = statusMatch[1].replace(/<[^>]*>/g, '').trim();

        // منطق حاسم: إذا كان الرد يحتوي على "غير متوفر" في الاسم أو الحالة، نعتبر الكرت غير موجود
        if (subscriberName === 'غير متوفر' || subscriptionStatus.includes('غير متوفر')) {
            return NextResponse.json({ 
                success: false, 
                message: 'عذراً، رقم الكرت غير موجود.' 
            });
        }

        const result = {
            subscriberName: subscriberName,
            cardNumber: cardMatch ? cardMatch[1].replace(/<[^>]*>/g, '').trim() : cardNumber,
            subscriptionStatus: subscriptionStatus
        };

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('Alsafaa Scraping Error:', error);
        return NextResponse.json({ 
            success: false, 
            message: 'حدث خطأ أثناء جلب البيانات من الشبكة.' 
        }, { status: 500 });
    }
}
