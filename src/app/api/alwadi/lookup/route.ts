import { NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';

const url = "api.alwaadi.net";
const db = "alwaadi_DB";

// بيانات الدخول المباشرة
const STATIC_USERNAME = "770326M";
const STATIC_PASSWORD = "770326828moh";

function xmlrpcCall(client: any, method: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        client.methodCall(method, params, (err: any, value: any) => {
            if (err) return reject(err);
            if (value && value.faultCode) return reject(new Error(value.faultString));
            resolve(value);
        });
    });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardNumber = body.number;
    

    if (!cardNumber) {
      return NextResponse.json({ success: false, message: "الرجاء إدخال رقم الكرت." }, { status: 400 });
    }

    const common = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/common' });
    
    // 1. التوثيق المبدئي باستخدام البيانات المباشرة
    const agentUid = await xmlrpcCall(common, "authenticate", [db, STATIC_USERNAME, STATIC_PASSWORD, {}]);
    
    if (!agentUid || typeof agentUid !== 'number') {
        return NextResponse.json({ success: false, message: "فشل الاتصال بالمنظومة (خطأ في بيانات الاعتماد)." }, { status: 401 });
    }

    const models = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/object' });

    const pageContext = {
        action: 371,
        menu_id: 269,
        allowed_company_ids: [1],
        uid: agentUid
    };

    // 2. المرحلة الأولى: الاستعلام في جدول العمليات
    try {
        const processResult = await xmlrpcCall(models, "execute_kw", [
            db, agentUid, STATIC_PASSWORD, "renewal.proces", "search_read",
            [['|', ["num_card", "=", cardNumber], ["number", "=", cardNumber]]],
            { 
                fields: ["subscriber", "expiry_date", "num_card"], 
                limit: 1, 
                order: "id desc",
                context: pageContext 
            }
        ]);

        if (processResult && processResult.length > 0) {
            const item = processResult[0];
            let subId = Array.isArray(item.subscriber) ? item.subscriber[0] : null;
            let rawName = Array.isArray(item.subscriber) ? item.subscriber[1] : item.subscriber;
            
            if (typeof rawName === 'string' && rawName.includes('|')) {
                rawName = rawName.split('|')[1].trim();
            }

            const expiryDate = item.expiry_date || null;
            const daysLeft = calculateDaysLeft(expiryDate);

            return NextResponse.json({
                success: true,
                isNewCard: false, 
                data: {
                    id: subId,
                    name: rawName || "مشترك معروف",
                    expiry: expiryDate || "غير محدد",
                    days_left: daysLeft,
                    cardNumber: cardNumber,
                    saleCenter: "مركز الوادي"
                }
            });
        }
    } catch (e) {
        console.warn("لم يظهر في العمليات السابقة.");
    }

    // 3. المرحلة الثانية: الاستعلام عن الكرت الجديد
    try {
        const nameSearchResult = await xmlrpcCall(models, "execute_kw", [
            db, agentUid, STATIC_PASSWORD, "subscribers", "name_search",
            [], 
            {
                name: cardNumber, 
                operator: "ilike",
                args: [["is_replaced", "=", false]], 
                limit: 1,
                context: pageContext
            }
        ]);

        if (nameSearchResult && nameSearchResult.length > 0) {
            const matchedSubscriber = nameSearchResult[0];
            let subId = matchedSubscriber[0];
            let rawName = matchedSubscriber[1];

            if (typeof rawName === 'string' && rawName.includes('|')) {
                rawName = rawName.split('|')[1].trim();
            }

            let actualExpiry = null;
            try {
                const onchangeResult = await xmlrpcCall(models, "execute_kw", [
                    db, agentUid, STATIC_PASSWORD, "renewal.proces", "onchange",
                    [
                        [], 
                        { 
                            number: "جديد",
                            subscriber: subId,
                            num_card: false, 
                            expiry_date: false, 
                            payment_type: false 
                        },
                        ["subscriber", "num_card", "number"],
                        {
                            number: {},
                            subscriber: {},
                            num_card: {},
                            expiry_date: {}
                        }
                    ],
                    { context: pageContext }
                ]);

                if (onchangeResult && onchangeResult.value) {
                    actualExpiry = onchangeResult.value.expiry_date || null;
                }
            } catch (onchangeError) {
                console.error("فشلت محاكاة onchange:", onchangeError);
            }

            return NextResponse.json({
                success: true,
                isNewCard: true, 
                data: {
                    id: subId,
                    name: rawName,
                    expiry: actualExpiry || "غير محدد",
                    days_left: calculateDaysLeft(actualExpiry), 
                    cardNumber: cardNumber,
                    saleCenter: "مركز الوادي"
                }
            });
        }
    } catch (subError) {
        console.error("فشل الاستعلام:", subError);
    }

    return NextResponse.json({ success: false, message: "عذراً، رقم الكرت غير موجود." });
  } catch (error: any) {
    console.error("Global Lookup Error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع." }, { status: 500 });
  }
}

function calculateDaysLeft(expiryDateString: string | null): number | string {
    if (!expiryDateString) return "غير محدد";
    try {
        const expiryDate = new Date(expiryDateString);
        const today = new Date();
        expiryDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        const differenceInTime = expiryDate.getTime() - today.getTime();
        return Math.ceil(differenceInTime / (1000 * 3600 * 24)); 
    } catch (e) {
        return "غير محدد";
    }
}