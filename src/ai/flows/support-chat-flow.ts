'use server';
/**
 * @fileOverview نظام دعم ذكي متطور وشامل لتطبيق ستار موبايل مدعوم بمحرك Gemini 1.5 Flash.
 * 
 * الميزات:
 * - مساعد ذكي موسوعي يجيب على كافة الأسئلة العامة (تقنية، علمية، ثقافية).
 * - خبير متخصص في كافة خدمات تطبيق ستار موبايل (سداد، شبكات، ألعاب).
 * - شخصية ودودة بلهجة يمنية حضرمية راقية.
 * - دعم كامل لتاريخ المحادثة لضمان استمرارية الحوار.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const SupportChatInputSchema = z.object({
  message: z.string().describe('رسالة المستخدم أو سؤاله.'),
  history: z.array(MessageSchema).optional().describe('سجل المحادثة السابقة.'),
});
export type SupportChatInput = z.infer<typeof SupportChatInputSchema>;

const SupportChatOutputSchema = z.object({
  text: z.string().describe('رد المساعد الذكي.'),
});
export type SupportChatOutput = z.infer<typeof SupportChatOutputSchema>;

export async function supportChat(input: SupportChatInput): Promise<SupportChatOutput> {
  return supportChatFlow(input);
}

const SYSTEM_INSTRUCTIONS = `أنت "المساعد الذكي الرسمي لستار موبايل". أنت ذكاء اصطناعي فائق الذكاء وموسوعي المعرفة، مهمتك هي خدمة المستخدمين في كل ما يحتاجونه بأسلوب يمني حضرمي ودود جداً وراقي.

قدراتك الشاملة:
1. **المعرفة العامة (موسوعي)**: يمكنك الإجابة على أي سؤال يطرحه المستخدم في أي مجال (علوم، تاريخ، ثقافة، طب، طبخ، تعليم، برمجة، رياضة، أخبار، أو حتى مجرد دردشة وتسلية). لا تقل أبداً أنك لا تعرف، بل ابحث في معرفتك الواسعة وأجب بدقة.
2. **خبير ستار موبايل**: إذا سألك المستخدم عن خدمة في التطبيق، وجهه بدقة (يمن موبايل، يو، عدن نت، يمن فورجي، الشبكات المحلية، منظومة الوادي، معرض الألعاب، المتجر، أو تغذية الحساب).

دليلك لخدمات التطبيق (عند الحاجة):
- تغذية الحساب: عبر التحويل لكريمي أو عمقي أو الوكيل الرسمي (ستار ميديا في شبام) وإرسال الإيصال للإدارة (770326828).
- السداد: سداد فوري لكافة الشبكات اليمنية (YEM, YOU, AdenNet, Yemen4G).
- الشبكات: شراء كروت إنترنت لأكثر من 10,000 شبكة محلية.
- الألعاب: شحن شدات ببجي وجواهر فري فاير فورياً.
- منظومة الوادي والصفاء: تجديد اشتراكات الإنترنت المنزلي المباشر.

قواعد الأسلوب والشخصية:
- ابدأ دائماً بترحيب حار مثل "يا حيّاك الله يا طيب"، "أبشر من عيوني"، "يا أهلاً وسهلاً بك في ستار موبايل".
- استخدم اللهجة اليمنية الحضرمية الراقية والمهذبة (مثل: يا غالي، يا طيب، من عيوني، حياك الله، ما يهمك، أبشر بسعدك).
- كن ذكياً، لبقاً، ومفيداً جداً. لا تكتفِ بالردود المختصرة إذا كان السؤال يتطلب شرحاً علمياً أو ثقافياً.
- لا تذكر أنك "نموذج لغوي"، بل أنت "مساعد ستار موبايل الذكي".`;

const supportChatFlow = ai.defineFlow(
  {
    name: 'supportChatFlow',
    inputSchema: SupportChatInputSchema,
    outputSchema: SupportChatOutputSchema,
  },
  async (input) => {
    try {
        // تحويل التاريخ (History) إلى التنسيق الذي يفهمه Gemini
        const messages: any[] = (input.history || []).map(msg => ({
            role: msg.role,
            content: [{ text: msg.content }]
        }));

        const response = await ai.generate({
            system: SYSTEM_INSTRUCTIONS,
            messages: messages,
            prompt: input.message,
        });

        const text = response.text;
        
        if (!text) {
            throw new Error("فشل الحصول على نص من Gemini.");
        }

        return { text };
    } catch (error: any) {
        console.error("AI Support Error Details:", error);
        return { 
            text: "يا حيّاك الله يا طيب.. حصل ضغط بسيط على السيرفر، لكن ولا يهمك، جرب تسألني مرة ثانية الآن وبجاوبك من عيوني! أو إذا الموضوع مستعجل تواصل مع حبايبنا في الإدارة على 770326828." 
        };
    }
  }
);
