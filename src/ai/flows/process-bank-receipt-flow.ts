'use server';
/**
 * @fileOverview نظام متطور لتحليل إيصالات التحويل البنكي اليمني (العمقي والكريمي) باستخدام Gemini 2.0 Flash.
 * يقوم باستخراج المبلغ، رقم العملية، وتاريخها بدقة عالية جداً.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const BankReceiptInputSchema = z.object({
  receiptImage: z
    .string()
    .describe(
      "Base64 data URI of the bank receipt image."
    ),
});

const BankReceiptOutputSchema = z.object({
  bankName: z.enum(['Al-Omqy', 'Al-Kuraimi', 'Other']).describe('اسم البنك المستخرج (العمقي أو الكريمي)'),
  receiptNumber: z.string().describe('رقم الإشعار أو رقم العملية المرجعي الفريد'),
  amount: z.number().describe('المبلغ المحول بالأرقام (الصافي)'),
  date: z.string().describe('تاريخ العملية بتنسيق (YYYY-MM-DD)'),
  isValid: z.boolean().describe('هل الإيصال يخص العمقي أو الكريمي ويبدو حقيقياً؟'),
  confidence: z.number().describe('مستوى الثقة في القراءة (0-1)'),
});

export async function processBankReceipt(input: { receiptImage: string }) {
  return processBankReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processBankReceiptPrompt',
  input: {schema: BankReceiptInputSchema},
  output: {schema: BankReceiptOutputSchema},
  prompt: `أنت خبير مالي متخصص في تحليل الحوالات البنكية اليمنية. 
  قم بتحليل صورة الإيصال المرفقة بعناية شديدة واستخرج البيانات التالية:
  
  1. اسم الجهة: تأكد هل هي "شركة العمقي وإخوانه للصرافة" أم "بنك الكريمي"؟
  2. رقم الإشعار/العملية: ابحث عن الرقم الفريد (Reference Number) للعملية بدقة. في العمقي يبدأ عادة بـ 8- أو أرقام طويلة.
  3. المبلغ: استخرج القيمة العددية للمبلغ بالريال اليمني. تأكد من استخراج "المبلغ الصافي" وليس العمولات.
  4. التاريخ: حول تاريخ العملية إلى تنسيق (سنة-شهر-يوم).

  شروط هامة:
  - إذا لم تجد شعار أو اسم "العمقي" أو "الكريمي" بشكل واضح، اجعل isValid = false.
  - إذا كانت الصورة غير واضحة أو مقصوصة وتمنع قراءة المبلغ أو رقم العملية، اجعل isValid = false.
  - تأكد من عدم الخلط بين رقم الهاتف ورقم العملية.

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
        if (!output) throw new Error("فشل الذكاء الاصطناعي في تحليل البيانات.");
        
        // التحقق من الجودة
        if (output.amount <= 0 || !output.receiptNumber) {
            output.isValid = false;
        }

        return output;
    } catch (error: any) {
        console.error("AI Bank Analysis Error:", error);
        throw new Error("عذراً، لم نتمكن من قراءة بيانات الإيصال. يرجى التأكد من وضوح الصورة وتصوير الإيصال كاملاً.");
    }
  }
);
