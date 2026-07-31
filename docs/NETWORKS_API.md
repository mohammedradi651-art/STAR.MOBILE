# 🌐 دليل ربط الشبكات (Star Mobile Networks API v1.5)

يتيح لك هذا الـ API جلب قائمة الشبكات (المحلية والخارجية) وشراء الكروت مباشرة من تطبيقك مع خصم المبلغ من رصيدك في ستار موبايل.

---

## 1. الإعدادات العامة (General Settings)

*   **الرابط (Endpoint):** `https://star26.vercel.app/api/external/v1/networks`
*   **الطريقة (Method):** `POST`
*   **التوثيق (Authentication):** `Authorization: Bearer YOUR_API_KEY`

---

## 2. العمليات المتاحة (Actions)

### أ. جلب قائمة الشبكات (List Networks)
تقوم هذه العملية بجلب جميع الشبكات المتاحة في النظام (الشبكات المحلية التي أضفتها يدوياً + شبكات نظام بيتي).

**● مثال الطلب (Request):**
```json
{
  "action": "list_networks"
}
```

**● مثال الرد الناجح (Response):**
```json
{
  "success": true,
  "data": [
    { "id": "net_abc123", "name": "شبكة الماهر", "location": "سيئون", "type": "local" },
    { "id": "550", "name": "شبكة الخير فورجي", "location": "حضرموت", "type": "external" }
  ]
}
```

---

### ب. جلب فئات الكروت لشبكة معينة (List Classes)
يجب إرسال الـ `networkId` المسترجع من الخطوة السابقة لمعرفة الفئات المتاحة لهذه الشبكة.

**● مثال الطلب (Request):**
```json
{
  "action": "list_classes",
  "networkId": "ID_الشبكة_المختار"
}
```

**● مثال الرد الناجح (Response):**
```json
{
  "success": true,
  "data": [
    { "id": "class_500", "name": "فئة 500 ريال", "price": 500, "dataLimit": "1GB", "validity": "يوم" }
  ]
}
```

---

### ج. تنفيذ عملية شراء كرت (Order Card)
هذه العملية تقوم بخصم القيمة من رصيدك وإعطائك بيانات الكرت فوراً. **يجب إرسال معرف الشبكة ومعرف الفئة معاً.**

**● مثال الطلب (Request):**
```json
{
  "action": "order",
  "networkId": "ID_الشبكة",
  "classId": "ID_الفئة"
}
```

**● مثال الرد الناجح (Response):**
```json
{
  "success": true,
  "transactionId": "TX_998877",
  "data": {
    "cardNumber": "8844552211",
    "cardPassword": "...", 
    "price": 500
  },
  "timestamp": "2025-05-20T12:00:00Z"
}
```

---

## 3. أكواد الحالة والأخطاء

| الكود | الوصف |
| :--- | :--- |
| `SM_SUCCESS` | تمت العملية بنجاح وظهر الكرت. |
| `SM_INSUFFICIENT_BALANCE` | رصيدك في ستار موبايل غير كافٍ. |
| `SM_NOT_FOUND` | معرف الشبكة أو الفئة غير موجود. |
| `SM_PROVIDER_ERROR` | المخزون نفذ من هذه الفئة حالياً. |

---
*ملاحظة: في الشبكات المحلية، يكون `cardNumber` هو نفسه الرمز المستخدم للدخول.*