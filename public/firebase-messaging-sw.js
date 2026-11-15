importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA7TYAHxiX0qhhJpdg-_WiCbTl1nTsbznQ",
  authDomain: "studio-239662212-1b7b6.firebaseapp.com",
  projectId: "studio-239662212-1b7b6",
  storageBucket: "studio-239662212-1b7b6.firebasestorage.app",
  messagingSenderId: "643429607022",
  appId: "1:643429607022:web:43614046eb7b665f5aa87f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'إشعار جديد';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
