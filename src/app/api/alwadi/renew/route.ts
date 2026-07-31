import { NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';

const url = "api.alwaadi.net";
const db = "alwaadi_DB";
const USERNAME = "770326M";
const PASSWORD = "770326828moh";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cardNumber, packageId, subscriberId } = body;

    if (!cardNumber || !packageId) {
      return NextResponse.json({ success: false, message: "بيانات الطلب غير مكتملة." }, { status: 400 });
    }

    const common = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/common' });
    
    const uid: any = await new Promise((resolve, reject) => {
      common.methodCall("authenticate", [db, USERNAME, PASSWORD, {}], (err: any, value: any) => {
          if (err) reject(err); else resolve(value);
      });
    });

    if (!uid || typeof uid !== 'number') {
        return NextResponse.json({ success: false, message: "فشل التوثيق مع السيرفر." }, { status: 401 });
    }

    const models = xmlrpc.createSecureClient({ host: url, port: 443, path: '/xmlrpc/2/object' });

    const createData: any = {
        "num_card": cardNumber,
        "renewal_categories": parseInt(packageId)
    };

    if (subscriberId) {
        createData["subscriber"] = parseInt(subscriberId);
    }

    const createResult: any = await new Promise((resolve, reject) => {
        models.methodCall("execute_kw", [
            db, uid, PASSWORD, "renewal.proces", "create",
            [createData]
        ], (err: any, value: any) => {
            if (err) reject(err); else resolve(value);
        });
    });

    if (createResult) {
        return NextResponse.json({ success: true, message: "تم تسجيل التجديد في المنظومة بنجاح." });
    }

    return NextResponse.json({ success: false, message: "فشل إنشاء سجل التجديد في المنظومة." });

  } catch (error: any) {
    console.error("Renewal Error:", error);
    return NextResponse.json({ success: false, message: error.message || "حدث خطأ غير متوقع أثناء الاتصال بالمنظومة." }, { status: 500 });
  }
}
