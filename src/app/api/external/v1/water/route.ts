import { NextResponse } from 'next/server';
import { POST as handleWaterPost, OPTIONS as handleWaterOptions } from '../../water/lookup/route';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleWaterOptions();
}

/**
 * نقطة النهاية الموحدة لخدمة المياه v1
 * تدعم:
 * - الاستعلام: { city: "...", number: "...", action: "lookup" }
 * - التسديد: { city: "...", number: "...", action: "pay" }
 */
export async function POST(req: Request) {
  return handleWaterPost(req);
}

