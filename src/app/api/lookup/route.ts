import { NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';

export const runtime = 'nodejs';

/**
 * @fileOverview نظام الاستعلام الرسمي لمنظومة الوادي باستخدام XML-RPC.
 * يتصل مباشرة بقاعدة بيانات Odoo لجلب بيانات المشترك وتاريخ الصلاحية.
 */

const url = "https://api.alwaadi.net";
const db = "alwaadi_DB";
const username = "770326M";
const password = "https://api.alwaadi.net/web?db=alwaadi_DB#action=118&cids=1&menu_id=76";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardNumber = body.number;

    if (!cardNumber) {
      return NextResponse.json({ success: false, message: "رقم الكرت مطلوب" });
    }

    // 1. إنشاء عميل XML-RPC للتوثيق
    const common = xmlrpc.createSecureClient({
      host: 'api.alwaadi.net',
      port: 443,
      path: '/xmlrpc/2/common'
    });

    // 2. الحصول على UID عبر عملية التوثيق
    const uid = await new Promise<number | boolean>((resolve, reject) => {
      common.methodCall(
        "authenticate",
        [db, username, password, {}],
        (err, value) => {
          if (err) reject(err);
          else resolve(value);
        }
      );
    });

    if (!uid || typeof uid === 'boolean') {
      return NextResponse.json({
        success: false,
        message: "فشل تسجيل الدخول للمنظومة",
      });
    }

    // 3. إنشاء عميل للبحث في الكائنات (Objects)
    const models = xmlrpc.createSecureClient({
        host: 'api.alwaadi.net',
        port: 443,
        path: '/xmlrpc/2/object'
    });

    // 4. البحث في موديل subscriber.card وجلب أحدث سجل
    const result = await new Promise<any[]>((resolve, reject) => {
      models.methodCall(
        "execute_kw",
        [
          db,
          uid,
          password,
          "subscriber.card",
          "search_read",
          [[["subscriber", "=", cardNumber]]],
          {
            fields: ["subscriber", "name_sub", "date_expr_old"],
            limit: 1,
            order: "id desc",
          },
        ],
        (err, value) => {
          if (err) reject(err);
          else resolve(value);
        }
      );
    });

    if (!result || result.length === 0) {
      return NextResponse.json({
        success: false,
        message: "لم يتم العثور على بيانات لهذا الرقم في سجلات المنظومة",
      });
    }

    const record = result[0];
    
    // تنظيف الاسم المسترجع من أي أرقام أو رموز زائدة
    const rawName = record.name_sub || (Array.isArray(record.subscriber) ? record.subscriber[1] : 'مشترك غير معروف');
    let cleanName = rawName;
    if (typeof rawName === 'string' && rawName.includes('|')) {
        cleanName = rawName.split('|')[1].trim();
    }

    return NextResponse.json({
      success: true,
      subscriber: record.subscriber,
      name: cleanName,
      expiry: record.date_expr_old,
    });

  } catch (error: any) {
    console.error("Alwadi XML-RPC lookup error:", error);
    return NextResponse.json({
      success: false,
      message: "خطأ في الاتصال بسيرفر المنظومة",
      error: error.message,
    });
  }
}
