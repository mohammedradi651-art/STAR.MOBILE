'use server';
/**
 * @fileOverview Processes a receipt image to extract transaction details.
 *
 * - processReceipt - A function that handles the receipt processing.
 * - ReceiptInput - The input type for the processReceipt function.
 * - ReceiptOutput - The return type for the processReceipt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ReceiptInputSchema = z.object({
  receiptImage: z
    .string()
    .describe(
      "A photo of a bank transfer receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ReceiptInput = z.infer<typeof ReceiptInputSchema>;

const ReceiptOutputSchema = z.object({
  amount: z.number().describe('The numeric amount of the transaction found in the receipt.'),
  recipientName: z.string().describe('The name of the recipient of the transfer found on the receipt.'),
  accountNumber: z.string().describe('The account number of the recipient found on the receipt.'),
  transactionDate: z.string().describe('The date of the transaction in YYYY-MM-DD format.'),
  transactionReference: z.string().describe('The unique transaction reference number or operation ID from the receipt.'),
});
export type ReceiptOutput = z.infer<typeof ReceiptOutputSchema>;

export async function processReceipt(input: ReceiptInput): Promise<ReceiptOutput> {
  return processReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processReceiptPrompt',
  input: {schema: ReceiptInputSchema},
  output: {schema: ReceiptOutputSchema},
  prompt: `Analyze the bank transfer receipt image. Extract the transaction amount, recipient name, recipient account number, transaction date (YYYY-MM-DD), and a unique transaction reference number.

- Extract the recipient's name as accurately as possible.
- Extract the recipient's bank account number as accurately as possible.
- Extract the transaction reference number, which could be labeled as 'رقم العملية' or 'رقم المرجع' or similar.

Receipt Image: {{media url=receiptImage}}`,
});

const processReceiptFlow = ai.defineFlow(
  {
    name: 'processReceiptFlow',
    inputSchema: ReceiptInputSchema,
    outputSchema: ReceiptOutputSchema,
  },
  async (input) => {
    let output;
    try {
        const response = await prompt(input);
        output = response.output;
    } catch (e: any) {
        if (e.message && (e.message.includes('503') || e.message.toLowerCase().includes('overloaded'))) {
            throw new Error('الخدمة مشغولة حاليًا بسبب كثرة الطلبات. الرجاء المحاولة مرة أخرى بعد لحظات.');
        }
        throw new Error('فشل تحليل صورة الإيصال. الرجاء التأكد من وضوح الصورة والمحاولة مرة أخرى.');
    }

    if (!output) {
      throw new Error("Failed to get a response from the AI model.");
    }
    
    // The output should conform to ReceiptOutputSchema due to the prompt configuration.
    // No further validation is needed here as it's handled by Genkit.
    return output;
  }
);
