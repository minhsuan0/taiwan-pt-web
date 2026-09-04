/**
 * Service Worker for 台灣物理治療實證助手 (PWA)
 */

const CACHE_NAME = 'taiwan-pt-v7.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json?v=20260904',
  '/icon-192.png?v=20260904',
  '/icon-512.png?v=20260904',
  '/apple-touch-icon.png?v=20260904',
  '/favicon.png?v=20260904',
  '/favicon.ico?v=20260904',
  '/icon.svg?v=20260904'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // 排除 API 請求，API 請求直接走網路
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // HTML 頁面與 Web App Manifest 強制網路優先（Network First），確保使用者與瀏覽器即時獲取最新代碼與圖示配置
  if (event.request.mode === 'navigate' ||
      event.request.headers.get('accept')?.includes('text/html') ||
      event.request.url.endsWith('/') ||
      event.request.url.endsWith('index.html') ||
      event.request.url.includes('manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request) || caches.match('/index.html'))
    );
    return;
  }

  // 其他靜態資源使用快取
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});
