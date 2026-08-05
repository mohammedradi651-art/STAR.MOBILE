'use server';
/**
 * @fileOverview نظام متخصص لتحليل إيصالات التحويل البنكي (العمقي والكريمي).
 * يقوم باستخراج المبلغ، رقم العملية، وتاريخها بدقة.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const BankReceiptInputSchema = z.object({
  receiptImage: z
    .string()
    .describe(
      "Base64 data URI of the bank receipt."
    ),
});

const BankReceiptOutputSchema = z.object({
  bankName: z.enum(['Al-Omqy', 'Al-Kuraimi', 'Other']).describe('اسم البنك المستخرج'),
  receiptNumber: z.string().describe('رقم الإشعار أو رقم العملية المرجعي'),
  amount: z.number().describe('المبلغ المحول بالأرقام'),
  date: z.string().describe('تاريخ العملية (YYYY-MM-DD)'),
  isValid: z.boolean().describe('هل الإيصال يبدو حقيقياً وواضحاً؟'),
  confidence: z.number().describe('مستوى الثقة في القراءة (0-1)'),
});

export async function processBankReceipt(input: { receiptImage: string }) {
  return processBankReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processBankReceiptPrompt',
  input: {schema: BankReceiptInputSchema},
  output: {schema: BankReceiptOutputSchema},
  prompt: `أنت خبير مالي في تحليل الحوالات البنكية اليمنية. 
  قم بتحليل صورة الإيصال المرفقة واستخرج البيانات التالية:
  1. اسم الجهة: هل هي "العمقي وإخوانه للصرافة" أم "بنك الكريمي"؟
  2. رقم الإشعار/العملية: ابحث عن الرقم الفريد للعملية بدقة.
  3. المبلغ: استخرج القيمة العددية للمبلغ بالريال اليمني حصراً.
  4. التاريخ: حوله لتنسيق سنة-شهر-يوم.

  شروط حاسمة:
  - إذا لم تجد كلمة "العمقي" أو "الكريمي" في الإيصال، اجعل isValid = false.
  - تأكد من قراءة المبلغ الصافي وليس العمولات.
  - إذا كانت الصورة غير واضحة، اطلب إعادة التصوير برفض الصلاحية.

  صورة الإيصال: {{media url=receiptImage}}`,
});

const processBankReceiptFlow = ai.defineFlow(
  {
    name: 'processBankReceiptFlow',
    inputSchema: BankReceiptInputSchema,
    outputSchema: BankReceiptOutputSchema,
  },
  async (input) => {
    try {
        const {output} = await prompt(input);
        if (!output) throw new Error("فشل الذكاء الاصطناعي في الرد.");
        return output;
    } catch (error: any) {
        console.error("AI Bank Analysis Error:", error);
        throw new Error("عذراً، لم نتمكن من قراءة بيانات الإيصال. يرجى التأكد من وضوح الصورة وتصوير الإيصال بالكامل.");
    }
  }
);
