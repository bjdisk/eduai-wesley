// EduAI Wesley — Service Worker
// 快取核心資源，讓 App 離線也能啟動

const CACHE = 'wes-v2.6';
const CORE = [
  '/eduai-wesley/',
  '/eduai-wesley/index.html',
  '/eduai-wesley/manifest.json'
];

// 安裝：快取核心資源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// 啟動：清除舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 請求攔截：核心頁面用快取，API 請求永遠走網路
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Claude API 與 Google Fonts 永遠走網路
  if (url.hostname.includes('anthropic.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    return; // 不攔截，讓瀏覽器直接發請求
  }

  // 其他請求：網路優先，失敗時用快取
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
