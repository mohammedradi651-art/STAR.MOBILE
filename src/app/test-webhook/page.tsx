
'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Terminal, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

export default function TestWebhookPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    
    const [formData, setFormData] = useState({
        phone: '770326828',
        amount: '1000',
        receiptNumber: 'TEST-' + Math.floor(Math.random() * 10000)
    });

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        try {
            const response = await fetch('/api/webhooks/whatsapp-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            setResult(data);
            
            if (data.success) {
                toast({ title: "نجاح التجربة", description: "تمت محاكاة الشحن بنجاح." });
            } else {
                toast({ variant: "destructive", title: "فشل الاختبار", description: data.message || "حدث خطأ ما." });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ تقني", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4">
            <SimpleHeader title="مختبر الويب هوك" />
            
            <div className="max-w-md mx-auto w-full space-y-6 pt-10">
                <Card className="rounded-[32px] border-none shadow-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-primary" />
                            محاكاة رسالة واتساب
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>رقم الجوال (يجب أن يكون مسجلاً)</Label>
                            <Input 
                                value={formData.phone} 
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                placeholder="77xxxxxxx"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>المبلغ المراد شحنه</Label>
                            <Input 
                                type="number"
                                value={formData.amount} 
                                onChange={e => setFormData({...formData, amount: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الإيصال (المرجع)</Label>
                            <Input 
                                value={formData.receiptNumber} 
                                onChange={e => setFormData({...formData, receiptNumber: e.target.value})}
                            />
                        </div>
                        
                        <Button 
                            className="w-full h-12 rounded-2xl font-black" 
                            onClick={handleTest}
                            disabled={loading}
                        >
                            {loading ? "جاري الإرسال..." : "إرسال طلب تجريبي"}
                            <Send className="mr-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>

                {result && (
                    <Card className={cn(
                        "rounded-[28px] border-2 animate-in zoom-in-95",
                        result.success ? "border-green-500/20 bg-green-50" : "border-red-500/20 bg-red-50"
                    )}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                {result.success ? <CheckCircle2 className="text-green-600" /> : <AlertCircle className="text-red-600" />}
                                <h3 className="font-black text-foreground">رد السيرفر:</h3>
                            </div>
                            <pre className="bg-black/5 p-4 rounded-xl text-[10px] font-mono overflow-x-auto">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}
            </div>
            <Toaster />
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
