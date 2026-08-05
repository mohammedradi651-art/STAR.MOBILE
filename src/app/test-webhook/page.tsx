'use client';

import React, { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Terminal, Send, CheckCircle2, AlertCircle, User, Info, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

export default function TestWebhookPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    
    const [formData, setFormData] = useState({
        phone: '770326828',
        amount: '1000',
        receiptNumber: 'INV-' + Math.floor(Math.random() * 100000)
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
                toast({ title: "نجاح الشحن", description: `تم شحن ${data.data.deposited} ريال لحساب ${data.data.userName}.` });
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
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 font-bold leading-relaxed">
                        استخدم هذه الصفحة لمحاكاة "موافقة الواتساب". أدخل رقم العميل المسجل والمبلغ، وسيقوم النظام بتجربة شحن الرصيد فعلياً.
                    </p>
                </div>

                <Card className="rounded-[32px] border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Terminal className="w-5 h-5" />
                            محاكاة إشارة الواتساب
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 p-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">رقم جوال العميل (المسجل)</Label>
                            <div className="relative">
                                <Input 
                                    value={formData.phone} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    placeholder="77xxxxxxx"
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
                                    className="h-12 rounded-2xl bg-muted/20 border-none font-black text-center text-lg text-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">رقم المرجع</Label>
                                <Input 
                                    value={formData.receiptNumber} 
                                    onChange={e => setFormData({...formData, receiptNumber: e.target.value})}
                                    className="h-12 rounded-2xl bg-muted/20 border-none font-mono text-xs text-center"
                                />
                            </div>
                        </div>
                        
                        <Button 
                            className="w-full h-14 rounded-2xl font-black text-lg bg-mesh-gradient shadow-lg shadow-primary/20 transition-all active:scale-95" 
                            onClick={handleTest}
                            disabled={loading}
                        >
                            {loading ? <RefreshCw className="animate-spin h-5 w-5" /> : "إرسال طلب تجربة الشحن"}
                        </Button>
                    </CardContent>
                </Card>

                {result && (
                    <Card className={cn(
                        "rounded-[28px] border-none shadow-lg animate-in zoom-in-95 duration-500",
                        result.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                    )}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                {result.success ? (
                                    <div className="bg-green-500 rounded-full p-1"><CheckCircle2 className="text-white w-5 h-5" /></div>
                                ) : (
                                    <div className="bg-red-500 rounded-full p-1"><AlertCircle className="text-white w-5 h-5" /></div>
                                )}
                                <h3 className={cn("font-black", result.success ? "text-green-700" : "text-red-700")}>
                                    {result.success ? "نجحت التجربة!" : "فشلت العملية"}
                                </h3>
                            </div>
                            
                            <div className="bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-white/50">
                                <p className="text-sm font-bold text-foreground/80 mb-2">{result.message}</p>
                                {result.data && (
                                    <div className="space-y-1 text-[11px] font-bold text-muted-foreground">
                                        <p>العميل: {result.data.userName}</p>
                                        <p>المبلغ: {result.data.deposited} ر.ي</p>
                                        <p>الرصيد الجديد: {result.data.newBalance} ر.ي</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
            <Toaster />
        </div>
    );
}
