'use client';
import React from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wifi, Banknote, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function MyNetworkPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <SimpleHeader title="إدارة شبكتي" />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">لوحة تحكم الشبكة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/my-network/manage">
              <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Wifi className="w-8 h-8 text-primary" />
                  <div>
                    <h3 className="font-bold">إدارة الفئات والكروت</h3>
                    <p className="text-sm text-muted-foreground">أضف كروت جديدة وحدد أسعارها.</p>
                  </div>
                </div>
                <ChevronLeft className="w-6 h-6 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/my-network/withdraw">
               <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Banknote className="w-8 h-8 text-primary" />
                  <div>
                    <h3 className="font-bold">الأرباح والسحب</h3>
                    <p className="text-sm text-muted-foreground">اطلع على أرباحك وقدم طلبات سحب.</p>
                  </div>
                </div>
                <ChevronLeft className="w-6 h-6 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
