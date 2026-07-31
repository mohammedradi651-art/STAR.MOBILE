# 📘 دليل الربط البرمجي لستار موبايل (Star Mobile API v1.5)

مرحباً بك في بوابة المطورين الرسمية لستار موبايل. يتيح لك هذا الـ API الربط برمجياً مع خدماتنا لتنفيذ عمليات السداد والاستعلام من تطبيقاتك الخاصة بهيكلية احترافية وموحدة.

---

## 1. الإعدادات العامة (General Settings)

*   **الرابط الأساسي (Base URL):** `https://star26.vercel.app/api/external/v1`
*   **الإصدار الحالي:** `v1.5`
*   **نظام الحماية (Authentication):** يجب إرسال مفتاح الربط في كل طلب داخل الـ Header.

### ● مثال لترويسة الطلب (Request Headers):
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Accept: application/json
```

---

## 2. تسلسل العمل (Workflow)

يوضح المخطط التالي مسار الطلب من تطبيقك وحتى استلام الرد:

```text
العميل (تطبيقك)  ───►  نظام الحماية (Auth)  ───►  بوابة ستار موبايل (API)
                                                      │
    الرد الموحد (JSON)  ◄───  المزود (Provider)  ◄───┘
```

---

## 3. أكواد الحالة والأخطاء (Error Codes & HTTP Status)

| HTTP | Code | الوصف |
| :--- | :--- | :--- |
| 200 | `SM_SUCCESS` | تمت العملية بنجاح |
| 401 | `SM_UNAUTHORIZED` | مفتاح الربط غير صحيح أو مفقود |
| 403 | `SM_FORBIDDEN` | الحساب محظور أو لا يملك صلاحية API |
| 400 | `SM_VALIDATION_ERROR` | بيانات الطلب ناقصة أو غير صحيحة |
| 400 | `SM_INSUFFICIENT_BALANCE` | الرصيد غير كافٍ لتنفيذ العملية |
| 502 | `SM_PROVIDER_ERROR` | خطأ من مزود الخدمة الأساسي |
| 500 | `SM_INTERNAL_ERROR` | خطأ داخلي في النظام |

---

## 4. هيكلة الاستجابة الموحدة (Standard Response Format)

جميع الردود تعود بتنسيق JSON موحد لتسهيل المعالجة البرمجية:
```json
{
  "success": true,        // حالة العملية (نجاح أو فشل)
  "code": "SM_SUCCESS",   // كود الحالة الفريد
  "message": "...",       // رسالة توضيحية للمستخدم
  "transactionId": "...", // معرف العملية (يعود في عمليات السداد فقط، وغير ذلك يكون null)
  "data": { ... },        // البيانات المسترجعة (في حال النجاح)
  "timestamp": "ISO-DATE" // طابع زمني دقيق للعملية
}
```

### ● مثال لاستجابة ناجحة (Success Response):
```json
{
  "success": true,
  "code": "SM_SUCCESS",
  "message": "تم تنفيذ العملية بنجاح",
  "transactionId": "TX-20260729-584221",
  "data": {
    "mobile": "777123456",
    "amount": 1000,
    "balance": 58450
  },
  "timestamp": "2026-07-29T18:55:21Z"
}
```

### ● مثال لاستجابة خاطئة (Error Response):
```json
{
  "success": false,
  "code": "SM_INSUFFICIENT_BALANCE",
  "message": "عذراً، رصيدك الحالي غير كافٍ لإتمام العملية",
  "transactionId": null,
  "data": null,
  "timestamp": "2026-07-29T19:10:05Z"
}
```

---

## 5. فحص الرصيد الشخصي (Get Balance)

*   **المسار:** `/balance` | **الطريقة:** `GET`
*   **الوصف:** يعيد رصيدك الحالي في محفظة ستار موبايل بالريال اليمني.

### ● مثال الطلب:
```http
GET /balance
Authorization: Bearer YOUR_API_KEY
```

---

## 6. نظام الاستعلام الموحد (Unified Inquiry - GET /query)

| الخدمة | `service` | العمليات المتاحة (`action`) |
| :--- | :--- | :--- |
| **يمن موبايل** | `yem` | `query`, `solfa`, `queryoffer` |
| **YOU** | `you` | `query`, `queryoffer` |
| **يمن فورجي** | `yem4g` | `query` |
| **ثابت / ADSL** | `post` | `query` (يجب إرسال `type` كـ `adsl` أو `line`) |
| **عدن نت** | `adenet` | `query` |

### ● مثال الطلب (استعلام رصيد):
```http
GET /query?service=yem&mobile=777123456&action=query
Authorization: Bearer YOUR_API_KEY
```

---

## 7. نظام العمليات والسداد (Unified Payment - POST /pay)

| الحقل | النوع | مطلوب | الوصف |
| :--- | :--- | :--- | :--- |
| `mobile` | string | ✔ | رقم الجوال المستهدف |
| `service` | string | ✔ | نوع الخدمة (yem, you, yem4g, post) |
| `action` | string | ✔ | bill أو billoffer |
| `amount` | number | ✔ | المبلغ المراد سداده |

### ● مثال الطلب (سداد رصيد):
```json
// POST /pay
{
  "mobile": "777123456",
  "service": "yem",
  "action": "bill",
  "amount": 1000
}
```

---

## 8. منظومة الوادي (Alwadi System - POST /alwadi)

*   **الاستعلام (Lookup):** `{"action": "lookup", "number": "رقم_الكرت"}`
*   **التجديد (Renew):** `{"action": "renew", "number": "رقم_الكرت", "packageId": "الكود"}`

**أكواد الباقات (packageId):** (1: شهرين), (3: 4 أشهر), (7: 6 أشهر), (9: سنة).

---

## 9. ملاحظات تقنية للمطورين

*   **Rate Limit:** لا يوجد حد برمجي صارم حالياً، لكن يُنصح بعدم تجاوز 60 طلباً في الدقيقة لضمان استقرار الخدمة وتجنب حظر المفتاح مؤقتاً.
*   **Timeouts:** اضبط وقت الانتظار في تطبيقك على 60 ثانية لضمان استلام رد المزود الأساسي.
*   **Content-Type:** يجب أن يكون `application/json` في كافة طلبات الـ POST.

---

## 10. سجل التغييرات (Changelog)

**v1.5 (الحالي)**
- إزالة متطلب `API-Version` من الهيدر لتبسيط الدمج.
- توحيد ظهور `transactionId` في جميع الردود مع جعله `null` في الاستعلامات.
- إضافة أمثلة تفصيلية لردود الأخطاء (Error Responses).
- تحديث سياسة الـ Rate Limit.
- تحسين استجابة منظومة الوادي لتعيد (الاسم، تاريخ الانتهاء، الأيام المتبقية).
