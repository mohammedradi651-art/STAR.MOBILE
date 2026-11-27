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
import { Send, Trash2, PlusCircle, BellOff, Bell, Clock } from 'lucide-react';
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
            <Card key={notification.id} className="rounded-[24px] border-none shadow-sm bg-card overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0 mt-0.5">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="font-black text-sm text-foreground">{notification.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">{notification.body}</p>
                  {formattedDate && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/80 mt-2">
                      <Clock className="h-3 w-3 text-primary/70" />
                      <span>{formattedDate}</span>
                    </div>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 shrink-0"
                      title="حذف الإشعار"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-center font-black">تأكيد حذف الإشعار</AlertDialogTitle>
                      <AlertDialogDescription className="text-center">
                        هل أنت متأكد من حذف إشعار &quot;{notification.title}&quot;؟
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0">
                      <AlertDialogCancel className="rounded-2xl h-11 mt-0">إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(notification.id)}
                        className="rounded-2xl h-11 bg-destructive hover:bg-destructive/90 font-bold"
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F7F9] dark:bg-slate-950">
      <SimpleHeader title="إرسال إشعارات عامة" />
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-5">
        <Card className="border-none shadow-xl rounded-[32px] bg-mesh-gradient text-white overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black">مركز الإشعارات العامة</h2>
                <p className="text-[11px] font-bold text-white/80">إرسال إشعارات فورية لجميع المشتركين وإدارتها</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-center shrink-0">
              <p className="text-[9px] font-bold text-white/80">المرسلة</p>
              <p className="text-lg font-black">{announcements.length}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={() => setIsAdding(!isAdding)}
            className="h-11 px-5 rounded-2xl font-black text-xs gap-2 shadow-sm"
            variant={isAdding ? 'outline' : 'default'}
          >
            <PlusCircle className="h-4 w-4" />
            {isAdding ? 'إلغاء' : 'إرسال إشعار جديد'}
          </Button>
        </div>

        {isAdding && (
          <Card className="rounded-[28px] border-none shadow-md bg-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black">إنشاء إشعار عام للعملاء</CardTitle>
              <CardDescription className="text-xs">
                سيتم إرسال هذا الإشعار لجميع الأجهزة سحابياً وحفظه في مستند البث العام للتطبيق مباشرة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-black">عنوان الإشعار</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: خصم خاص اليوم!"
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-black">نص الإشعار</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب تفاصيل الإشعار هنا..."
                  rows={4}
                  className="rounded-2xl"
                />
              </div>
              <Button onClick={handleSend} disabled={isLoading} className="w-full h-12 rounded-2xl font-black gap-2">
                <Send className="h-4 w-4" />
                {isLoading ? 'جاري الإرسال السحابي...' : 'إرسال الإشعار الآن'}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-[28px] border-none shadow-sm bg-transparent">
          <CardHeader className="px-1 pb-3">
            <CardTitle className="text-sm font-black">سجل الإشعارات المرسلة للتطبيق</CardTitle>
            <CardDescription className="text-xs">قائمة الإشعارات العامة الحالية المحفوظة في التطبيق</CardDescription>
          </CardHeader>
          <CardContent className="p-0">{renderSentNotifications()}</CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}
