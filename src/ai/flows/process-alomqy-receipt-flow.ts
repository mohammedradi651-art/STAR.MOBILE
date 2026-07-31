'use server';
/**
 * @fileOverview نظام متخصص لمعالجة إيصالات شركة العمقي للصرافة.
 *
 * - processAlomqyReceipt - وظيفة لتحليل صورة إيصال العمقي واستخراج البيانات.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AlomqyReceiptInputSchema = z.object({
  receiptImage: z
    .string()
    .describe(
      "A photo of Al-Omqy exchange receipt, as a data URI that must include a MIME type and use Base64 encoding."
    ),
});
export type AlomqyReceiptInput = z.infer<typeof AlomqyReceiptInputSchema>;

const AlomqyReceiptOutputSchema = z.object({
  receiptNumber: z.string().describe('رقم الإشعار أو رقم السند الموجود في أعلى الإيصال.'),
  amount: z.number().describe('المبلغ بالأرقام الموجود داخل القوسين أو في خانة المبلغ.'),
  date: z.string().describe('تاريخ العملية بتنسيق YYYY-MM-DD.'),
  isAlomqy: z.boolean().describe('هل الإيصال تابع لشركة العمقي وإخوانه للصرافة فعلاً؟'),
});
export type AlomqyReceiptOutput = z.infer<typeof AlomqyReceiptOutputSchema>;

export async function processAlomqyReceipt(input: AlomqyReceiptInput): Promise<AlomqyReceiptOutput> {
  return processAlomqyReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processAlomqyReceiptPrompt',
  input: {schema: AlomqyReceiptInputSchema},
  output: {schema: AlomqyReceiptOutputSchema},
  prompt: `أنت خبير في تحليل المستندات المالية والبنكية، وتحديداً إيصالات شركة العمقي وإخوانه للصرافة في اليمن.

قم بتحليل صورة الإيصال المرفقة واستخرج البيانات التالية بدقة متناهية:
1. رقم الإشعار (رقم السند): ابحث عن "رقم الإشعار" وعادة ما يبدأ بـ 8- أو أرقام طويلة.
2. المبلغ: استخرج القيمة العددية للمبلغ بالريال اليمني.
3. التاريخ: استخرج التاريخ المكتوب في أعلى اليسار أو أسفل الإيصال وحوله إلى تنسيق (السنة-الشهر-اليوم).
4. التحقق: تأكد من وجود شعار العمقي أو عبارة "شركة العمقي وإخوانه للصرافة".

الإيصال المرفق: {{media url=receiptImage}}`,
});

const processAlomqyReceiptFlow = ai.defineFlow(
  {
    name: 'processAlomqyReceiptFlow',
    inputSchema: AlomqyReceiptInputSchema,
    outputSchema: AlomqyReceiptOutputSchema,
  },
  async (input) => {
    try {
        const {output} = await prompt(input);
        if (!output) {
            throw new Error("لم يتمكن الذكاء الاصطناعي من قراءة البيانات.");
        }
        return output;
    } catch (error: any) {
        console.error("AI Error:", error);
        throw new Error("فشل تحليل الإيصال، يرجى التأكد من وضوح الصورة وتصوير الإيصال بالكامل.");
    }
  }
);
