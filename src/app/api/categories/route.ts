
import { NextResponse } from "next/server";

/**
 * API للفئات الرسمية المعتمدة لمنظومة الوادي بناءً على التوثيق الجديد
 */
export async function GET() {
  const categories = [
    { id: 1, name: "3000 عملية تجديد شهرين", price: 3000, duration_months: 2 },
    { id: 3, name: "عملية تجديد 4 أشهر ب 6000 ريال يمني", price: 6000, duration_months: 4 },
    { id: 7, name: "عملية تجديد 6 أشهر ب 9000 ريال يمني", price: 9000, duration_months: 6 },
    { id: 9, name: "عملية تجديد سنة كاملة ب 15000 ريال يمني", price: 15000, duration_months: 12 }
  ];

  return NextResponse.json({
    success: true,
    count: categories.length,
    data: categories
  });
}
