'use client';

import { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Send, Trash2, PlusCircle, BellOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type BroadcastItem = {
  id: string;
  title: string;
  body: string;
  date?: string;
  createdAt?: string;
  type?: string;
};

export default function SendNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const broadcastDocRef = useMemoFirebase(
    () => firestore ? doc(firestore, 'app_notifications', 'broadcast') : null,
    [firestore]
  );
  const { data: broadcastDoc, isLoading: isLoadingNotifications } = useDoc<any>(broadcastDocRef);

  const announcements: BroadcastItem[] = useMemo(() => {
    if (!broadcastDoc) return [];
    const list: BroadcastItem[] = Array.isArray(broadcastDoc.announcements) ? broadcastDoc.announcements : [];
    return [...list].sort((a, b) => {
      const da = new Date(a.createdAt || a.date || 0).getTime();
      const db = new Date(b.createdAt || b.date || 0).getTime();
      return db - da;
    });
  }, [broadcastDoc]);

  const handleSend = async () => {
    if (!title || !message || !firestore) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "الرجاء إدخال عنوان ورسالة للإشعار.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const newId = `b_${Date.now()}`;
      const newItem: BroadcastItem = {
        id: newId,
        title: title.trim(),
        body: message.trim(),
        createdAt: nowIso,
        date: format(new Date(), 'yyyy-MM-dd HH:mm'),
        type: 'broadcast',
      };

      const existingAnnouncements = Array.isArray(broadcastDoc?.announcements)
        ? broadcastDoc.announcements
        : [];
      const updatedAnnouncements = [newItem, ...existingAnnouncements];

      // 1. الحفظ المباشر داخل app_notifications/broadcast
      await setDoc(
        doc(firestore, 'app_notifications', 'broadcast'),
        {
          id: newId,
          title: title.trim(),
          body: message.trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
          type: 'broadcast',
          announcements: updatedAnnouncements,
        },
        { merge: true }
      );

      // 2. إرسال إشعار سحابي FCM فوري لجميع الأجهزة المشتركة
      try {
        await fetch('/api/notifications/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newId,
            title: title.trim(),
            body: message.trim(),
          }),
        });
      } catch (fcmErr) {
        console.warn('Failed to trigger broadcast push via API:', fcmErr);
      }

      toast({
        title: "نجاح",
        description: "تم إرسال الإشعار السحابي وحفظه في التطبيق بنجاح.",
      });
      setTitle('');
      setMessage('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error sending notification: ", error);
      toast({
        variant: "destructive",
        title: "خطأ في الإرسال",
        description: "لم يتم إرسال الإشعار. الرجاء المحاولة مرة أخرى.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !broadcastDoc) return;
    try {
      const existing = Array.isArray(broadcastDoc.announcements) ? broadcastDoc.announcements : [];
      const updated = existing.filter((item: any) => item.id !== id);

      const latest = updated[0];
      await updateDoc(doc(firestore, 'app_notifications', 'broadcast'), {
        announcements: updated,
        ...(latest ? {
          id: latest.id,
          title: latest.title,
          body: latest.body,
          updatedAt: latest.createdAt || new Date().toISOString()
        } : {
          title: '',
          body: ''
        })
      });

      toast({
        title: 'تم الحذف',
        description: 'تم حذف الإشعار بنجاح.',
        variant: 'destructive',
      });
    } catch (err) {
      console.error('Error deleting broadcast item:', err);
    }
  };

  const renderSentNotifications = () => {
    if (isLoadingNotifications) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-8" />
            </Card>
          ))}
        </div>
      );
    }

    if (!announcements || announcements.length === 0) {
      return (
        <div className="text-center py-10">
          <BellOff className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">لم يتم إرسال أي إشعارات عامة بعد.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {announcements.map((notification) => {
          let formattedDate = '';
          try {
            const rawDate = notification.createdAt || notification.date;
            if (rawDate) {
              formattedDate = format(parseISO(rawDate), 'd MMM yyyy, h:mm a', { locale: ar });
            }
          } catch {
            formattedDate = notification.date || '';
          }

          return (
            <Card key={notification.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-sm">{notification.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                {formattedDate && (
                  <p className="text-xs text-muted-foreground mt-2">{formattedDate}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SimpleHeader title="إرسال إشعارات عامة" />
      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(!isAdding)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {isAdding ? 'إلغاء' : 'إرسال إشعار جديد'}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>إنشاء إشعار عام للعملاء</CardTitle>
            <CardDescription>
              سيتم إرسال هذا الإشعار لجميع الأجهزة سحابياً وحفظه في مستند البث العام للتطبيق مباشرة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">عنوان الإشعار</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: خصم خاص اليوم!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">نص الإشعار</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب تفاصيل الإشعار هنا..."
                rows={4}
              />
            </div>
            <Button onClick={handleSend} disabled={isLoading} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {isLoading ? 'جاري الإرسال السحابي...' : 'إرسال الإشعار الآن'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>سجل الإشعارات المرسلة للتطبيق</CardTitle>
          <CardDescription>قائمة الإشعارات العامة الحالية المحفوظة في التطبيق</CardDescription>
        </CardHeader>
        <CardContent>{renderSentNotifications()}</CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
