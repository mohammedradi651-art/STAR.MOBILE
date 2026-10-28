import { NextResponse } from 'next/server';
import { POST as handleElectricityPost, OPTIONS as handleElectricityOptions } from '../../electricity/lookup/route';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleElectricityOptions();
}

/**
 * نقطة النهاية الموحدة لخدمة الكهرباء v1
 * تدعم:
 * - الاستعلام: { number: "...", action: "lookup" }
 * - التسديد: { number: "...", action: "pay" }
 */
export async function POST(req: Request) {
  return handleElectricityPost(req);
}

