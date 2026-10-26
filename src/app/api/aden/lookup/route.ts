import { NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';

const url = "aden.alwaadi.net";
const db = "aden_DB";

// بيانات الدخول المباشرة لشبكة بندر عدن
const STATIC_USERNAME = "aden3";
const STATIC_PASSWORD = "Aa771176611";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function xmlrpcCall(client: any, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: any, value: any) => {
      if (err) return reject(err);
      if (value && value.faultCode) return reject(new Error(value.faultString));
      resolve(value);
    });
  });
}

function calculateDaysLeft(expiryDateString: string | null): number | string {
  if (!expiryDateString) return "غير محدد";
  try {
    const expiryDate = new Date(expiryDateString);
    if (isNaN(expiryDate.getTime())) return "غير محدد";
    const today = new Date();
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const differenceInTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(differenceInTime / (1000 * 3600 * 24));
  } catch {
    return "غير محدد";
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawCard = body.number || body.cardNumber;
    const cardNumber = typeof rawCard === 'string' ? rawCard.trim() : rawCard ? String(rawCard).trim() : '';

    if (!cardNumber) {
      return NextResponse.json(
        { success: false, message: "الرجاء إدخال رقم الكرت." },
        { status: 400, headers: corsHeaders }
      );
    }

    const common = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/common' });

    // 1. التوثيق المباشر
    const agentUid = await xmlrpcCall(common, "authenticate", [db, STATIC_USERNAME, STATIC_PASSWORD, {}]);

    if (!agentUid || typeof agentUid !== 'number') {
      return NextResponse.json(
        { success: false, message: "فشل الاتصال بالمنظومة (خطأ في بيانات الاعتماد)." },
        { status: 401, headers: corsHeaders }
      );
    }

    const models = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/object' });

    const pageContext = {
      action: 371,
      menu_id: 269,
      allowed_company_ids: [1],
      uid: agentUid
    };

    // 2. الاستعلام المباشر من جدول المشتركين (كروت جديدة ومباشرة)
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

    if (!nameSearchResult || nameSearchResult.length === 0) {
      return NextResponse.json(
        { success: false, message: "عذراً، رقم الكرت غير موجود في شبكة بندر عدن." },
        { headers: corsHeaders }
      );
    }

    const matchedSubscriber = nameSearchResult[0];
    const subId = matchedSubscriber[0];
    let rawName = matchedSubscriber[1];

    if (typeof rawName === 'string' && rawName.includes('|')) {
      rawName = rawName.split('|')[1].trim();
    }

    // محاكاة onchange لحساب تاريخ الانتهاء المباشر
    let actualExpiry: string | null = null;
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
      console.warn("تعذر احتساب تاريخ الانتهاء من onchange:", onchangeError);
    }

    return NextResponse.json({
      success: true,
      isNewCard: true,
      data: {
        id: subId,
        name: rawName || "مشترك معروف",
        expiry: actualExpiry || "غير محدد",
        days_left: calculateDaysLeft(actualExpiry),
        cardNumber: cardNumber,
        saleCenter: "شبكة بندر عدن"
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("Bandar Aden Lookup Error:", error?.message || error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ غير متوقع أثناء الاستعلام." },
      { status: 500, headers: corsHeaders }
    );
  }
}
