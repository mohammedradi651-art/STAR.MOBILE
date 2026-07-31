'use client';

import React, { useState, useEffect } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Link as LinkIcon, Phone } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';

type AppSettings = {
  appLink: string;
  supportPhoneNumber: string;
};

export default function AppSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [appLink, setAppLink] = useState('');
  const [supportPhoneNumber, setSupportPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'appSettings', 'global') : null),
    [firestore]
  );
  const { data: currentSettings, isLoading: isLoadingSettings } = useDoc<AppSettings>(settingsDocRef);

  useEffect(() => {
    if (currentSettings) {
      setAppLink(currentSettings.appLink || '');
      setSupportPhoneNumber(currentSettings.supportPhoneNumber || '');
    }
  }, [currentSettings]);

  const handleSave = () => {
    if (!appLink || !supportPhoneNumber) {
        toast({
            variant: "destructive",
            title: "خطأ",
            description: "الرجاء تعبئة جميع الحقول.",
        });
        return;
    }

    if (!firestore || !settingsDocRef) return;

    setIsLoading(true);
    const newSettings = {
      appLink,
      supportPhoneNumber,
    };

    setDocumentNonBlocking(settingsDocRef, newSettings, { merge: true });

    // Since setDocumentNonBlocking doesn't return a promise we can await,
    // we'll just show the toast and reset state optimistically.
    toast({
        title: "تم الحفظ",
        description: "تم تحديث إعدادات التطبيق بنجاح.",
    });
    setIsLoading(false);
  };
  
  if (isLoadingSettings) {
    return (
        <div className="flex flex-col h-full bg-background">
            <SimpleHeader title="إعدادات التطبيق" />
            <div className="flex-1 p-4">
                <Card>
                    <CardHeader className="text-center">
                       <Skeleton className="h-8 w-48 mx-auto" />
                       <Skeleton className="h-4 w-64 mx-auto" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <Skeleton className="h-5 w-24" />
                             <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                             <Skeleton className="h-5 w-32" />
                             <Skeleton className="h-10 w-full" />
                        </div>
                         <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="إعدادات التطبيق" />
        <div className="flex-1 overflow-y-auto p-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>الإعدادات العامة</CardTitle>
              <CardDescription>
                إدارة الإعدادات العامة للتطبيق مثل رابط المشاركة ورقم الدعم.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="appLink" className='flex items-center gap-2'>
                  <LinkIcon className="h-4 w-4" />
                  رابط التطبيق للمشاركة
                </Label>
                <Input
                  id="appLink"
                  value={appLink}
                  onChange={(e) => setAppLink(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportPhone" className='flex items-center gap-2'>
                   <Phone className="h-4 w-4" />
                   رقم هاتف الدعم (واتساب)
                </Label>
                <Input
                  id="supportPhone"
                  type="tel"
                  value={supportPhoneNumber}
                  onChange={(e) => setSupportPhoneNumber(e.target.value)}
                  placeholder="967..."
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleSave} disabled={isLoading} className="w-full">
                {isLoading ? 'جاري الحفظ...' : <><Save className="ml-2 h-4 w-4" /> حفظ التغييرات</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </>
  );
}
