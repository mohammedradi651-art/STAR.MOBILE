/**
 * Star Mobile Service Worker (Final v1.9.5)
 * يوفر دعم كامل للعمل بدون إنترنت وحفظ هيكل التطبيق.
 */

const CACHE_NAME = 'star-mobile-v1.9.5';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/services',
  '/favorites',
  '/manifest.json',
  '/logo.jpeg',
  '/TH.json',
  '/ashar.mp3',
  '/sdad.mp3'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // استراتيجية Stale-while-revalidate للصور والملفات الثابتة
  if (event.request.destination === 'image' || event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // التعامل مع طلبات الصفحات الأساسية لدعم الـ Offline
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request) || caches.match('/');
    })
  );
});
