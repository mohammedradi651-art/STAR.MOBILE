
const CACHE_NAME = 'star-mobile-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/services',
  '/favorites',
  '/logo.jpeg',
  '/manifest.json'
];

// تثبيت عامل الخدمة وتخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// تفعيل عامل الخدمة وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// استراتيجية جلب البيانات: الشبكة أولاً ثم الكاش
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // إذا فشل كل شيء (أوفلاين)، نرجع نجاح فارغ لطلبات الـ API لمنع الانهيار
        if (event.request.url.includes('/api/')) {
            return new Response(JSON.stringify({ success: false, offline: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
      });
    })
  );
});
