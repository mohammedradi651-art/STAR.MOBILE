'use client';

import { useState } from 'react';
import { SimpleHeader } from '@/components/layout/simple-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
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


type Notification = {
    id: string;
    title: string;
    body: string;
    timestamp: string;
};

export default function SendNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const notificationsQuery = useMemoFirebase(
    () => firestore
        ? query(
            collection(firestore, 'notifications'),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore]
  );
  const { data: sentNotifications, isLoading: isLoadingNotifications } = useCollection<Notification>(notificationsQuery);


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
      const notificationsCollection = collection(firestore, 'notifications');
      await addDocumentNonBlocking(notificationsCollection, {
        title,
        body: message,
        timestamp: new Date().toISOString(),
      });

      toast({
        title: "نجاح",
        description: "تم إرسال الإشعار بنجاح.",
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
  
  const handleDelete = (id: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'notifications', id);
    deleteDocumentNonBlocking(docRef);
    toast({
        title: 'تم الحذف',
        description: 'تم حذف الإشعار بنجاح.',
        variant: 'destructive',
    });
  }

  const renderSentNotifications = () => {
    if(isLoadingNotifications) {
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
        )
    }

    if (!sentNotifications || sentNotifications.length === 0) {
        return (
            <div className="text-center py-10">
                <BellOff className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">لم يتم إرسال أي إشعارات بعد.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {sentNotifications.map(notification => (
                <Card key={notification.id} className="p-4 flex items-start justify-between gap-4">
                   <div className="flex-1">
                     <p className="font-bold text-sm">{notification.title}</p>
                     <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                     <p className="text-xs text-muted-foreground mt-2">{format(parseISO(notification.timestamp), 'd MMM yyyy, h:mm a', { locale: ar })}</p>
                   </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من أنك تريد حذف هذا الإشعار؟ لا يمكن التراجع عن هذا الإجراء.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(notification.id)}>
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </Card>
            ))}
        </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <SimpleHeader title="إرسال الإشعارات" />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="w-full">
                <PlusCircle className="ml-2 h-4 w-4" />
                إرسال إشعار جديد
            </Button>
          )}

          {isAdding && (
            <Card>
              <CardHeader>
                <CardTitle className="text-center">إنشاء إشعار جديد</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">عنوان الإشعار</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: عرض جديد!"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">نص الإشعار</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب محتوى رسالة الإشعار هنا..."
                    rows={5}
                    disabled={isLoading}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setIsAdding(false)} variant="outline" disabled={isLoading}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSend} disabled={isLoading}>
                        {isLoading ? 'جاري الإرسال...' : <><Send className="ml-2 h-4 w-4" /> إرسال</>}
                    </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
                <CardTitle className="text-center">الإشعارات المرسلة</CardTitle>
                <CardDescription className="text-center">قائمة بجميع الإشعارات التي تم إرسالها.</CardDescription>
            </CardHeader>
            <CardContent>
                {renderSentNotifications()}
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </>
  );
}
