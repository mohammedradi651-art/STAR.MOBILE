'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Terminal, Send, CheckCircle2, AlertCircle, User, Key, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

export default function TestWebhookPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    
    const [formData, setFormData] = useState({
        apiKey: 'star_default_secret_123',
        phone: '770326828',
        amount: '1000',
        receiptNumber: 'TEST-' + Math.floor(Math.random() * 100000)
    });

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        try {
            const response = await fetch('/api/webhooks/whatsapp-receipt', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': formData.apiKey
                },
                body: JSON.stringify({
                    phone: formData.phone,
                    amount: formData.amount,
                    receiptNumber: formData.receiptNumber
                })
            });
            const data = await response.json();
            setResult(data);
            
            if (data.success) {
                toast({ title: "نجاح الشحن", description: `تم شحن ${data.data.deposited} ريال بنجاح.` });
            } else {
                toast({ variant: "destructive", title: "فشل العملية", description: data.message });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "خطأ تقني", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950 p-4 overflow-y-auto no-scrollbar">
            <SimpleHeader title="مختبر الشحن الآلي" />
            
            <div className="max-w-md mx-auto w-full space-y-6 pt-6 pb-20">
                <Card className="rounded-[32px] border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Terminal className="w-5 h-5" />
                            محاكاة طلب البوت
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 p-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">مفتاح الـ API السري</Label>
                            <div className="relative">
                                <Input 
                                    value={formData.apiKey} 
                                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                                    className="h-12 rounded-2xl bg-muted/20 border-none font-mono text-xs"
                                />
                                <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-30" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">رقم جوال العميل</Label>
                            <div className="relative">
                                <Input 
                                    value={formData.phone} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="h-12 rounded-2xl bg-muted/20 border-none font-bold text-center"
                                />
                                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-30" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">المبلغ</Label>
                                <Input 
                                    type="number"
                                    value={formData.amount} 
                                    onChange={e => setFormData({...formData, amount: e.target.value})}
                                    className="h-12 rounded-2xl bg-muted/20 border-none font-black text-center"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">رقم الإيصال</Label>
                                <Input 
                                    value={formData.receiptNumber} 
                                    onChange={e => setFormData({...formData, receiptNumber: e.target.value})}
                                    className="h-12 rounded-2xl bg-muted/20 border-none font-mono text-xs text-center"
                                />
                            </div>
                        </div>
                        
                        <Button 
                            className="w-full h-14 rounded-2xl font-black text-lg bg-mesh-gradient shadow-lg" 
                            onClick={handleTest}
                            disabled={loading}
                        >
                            {loading ? <RefreshCw className="animate-spin h-5 w-5" /> : "إرسال تجريبي"}
                        </Button>
                    </CardContent>
                </Card>

                {result && (
                    <Card className={cn(
                        "rounded-[28px] border-none shadow-lg animate-in zoom-in-95 duration-500",
                        result.success ? "bg-green-50" : "bg-red-50"
                    )}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                {result.success ? <CheckCircle2 className="text-green-600 w-5 h-5" /> : <AlertCircle className="text-red-600 w-5 h-5" />}
                                <h3 className={cn("font-black", result.success ? "text-green-700" : "text-red-700")}>النتيجة</h3>
                            </div>
                            <pre className="text-[10px] bg-white/50 p-3 rounded-xl overflow-x-auto">
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
