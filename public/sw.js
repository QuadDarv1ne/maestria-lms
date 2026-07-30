const CACHE_NAME = 'maestria-v3.7.0';
const STATIC_CACHE = 'maestria-static-v3.7.0';
const API_CACHE = 'maestria-api-v3.7.0';
const DYNAMIC_CACHE = 'maestria-dynamic-v3.7.0';
const OFFLINE_URL = '/offline';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-180x180.png',
  '/icons/icon-96x96.png',
];

// API routes that should be cached with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/courses$/,
  /\/api\/articles$/,
  /\/api\/achievements$/,
  /\/api\/health$/,
];

// Static asset extensions to cache aggressively
const STATIC_EXTENSIONS = /\.(js|css|woff2?|svg|png|jpg|jpeg|gif|webp|ico)$/;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.addAll(urlsToCache);
        // Pre-cache offline fallback
        const offlineCache = await caches.open(DYNAMIC_CACHE);
        const offlineResponse = new Response(
          `<!DOCTYPE html>
          <html lang="ru">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Нет соединения — Maestria</title>
          <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8f9fa;color:#333;text-align:center;padding:20px}
          .offline-container{max-width:400px}h1{font-size:2rem;margin-bottom:0.5rem}p{color:#666;line-height:1.5}.icon{font-size:4rem;margin-bottom:1rem}
          @media(prefers-color-scheme:dark){body{background:#1a1a2e;color:#e0e0e0}p{color:#999}}</style>
          </head><body><div class="offline-container"><div class="icon">📡</div>
          <h1>Нет подключения к интернету</h1>
          <p>Пожалуйста, проверьте ваше соединение и попробуйте снова.</p></div></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
        await offlineCache.put(OFFLINE_URL, offlineResponse);
        console.log('Static cache installed successfully');
      } catch (error) {
        console.log('Cache install failed:', error);
      }
    })()
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE, API_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => !currentCaches.includes(cacheName))
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
        // Take control of all clients immediately
        await self.clients.claim();
        // Notify all clients about the update
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', payload: { version: CACHE_NAME } });
        });
      } catch (error) {
        console.log('Activation failed:', error);
      }
    })()
  );
});

// Strategy: Cache-First for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If offline and not in cache, return offline fallback for navigations
    if (request.mode === 'navigate') {
      const offlineCache = await caches.match(OFFLINE_URL);
      if (offlineCache) return offlineCache;
    }
    throw error;
  }
}

// Strategy: Network-First for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return a JSON error response for API calls when offline
    return new Response(
      JSON.stringify({ error: 'You are offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Strategy: Stale-While-Revalidate for pages
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// Determine which strategy to use
function getStrategy(request) {
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return null;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return null;
  }

  // Skip browser extensions and chrome-requests
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:') {
    return null;
  }

  // API calls - network first
  if (API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return networkFirstStrategy;
  }

  // Static assets - cache first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    return cacheFirstStrategy;
  }

  // Navigation requests (pages) - stale while revalidate
  if (request.mode === 'navigate') {
    return staleWhileRevalidateStrategy;
  }

  // Default: network first for everything else
  return networkFirstStrategy;
}

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const strategy = getStrategy(event.request);
  if (strategy) {
    event.respondWith(strategy(event.request));
  }
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  switch (event.tag) {
    case 'sync-data':
      event.waitUntil(syncData());
      break;
    case 'sync-enrollments':
      event.waitUntil(syncEnrollments());
      break;
    case 'sync-progress':
      event.waitUntil(syncProgress());
      break;
    default:
      console.log('Unknown sync tag:', event.tag);
  }
});

async function syncData() {
  console.log('Syncing data in background...');
  try {
    const db = await openIndexedDB();
    const pendingActions = await db.getAll('pendingActions');
    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data),
        });
        if (response.ok) {
          await db.delete('pendingActions', action.id);
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_COMPLETED',
              payload: { id: action.id, success: true },
            });
          });
        }
      } catch (error) {
        console.log('Failed to sync action:', action.id, error);
      }
    }
  } catch (error) {
    console.log('Sync data error:', error);
  }
}

async function syncEnrollments() {
  console.log('Syncing pending enrollments...');
  // Implement enrollment sync logic
}

async function syncProgress() {
  console.log('Syncing lesson progress...');
  // Implement progress sync logic
}

// IndexedDB helper for offline data storage
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MaestriaOfflineDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cachedCourses')) {
        db.createObjectStore('cachedCourses', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve({
        getAll: (storeName) => {
          return new Promise((resolveGet, rejectGet) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => resolveGet(getAllRequest.result);
            getAllRequest.onerror = () => rejectGet(getAllRequest.error);
          });
        },
        put: (storeName, data) => {
          return new Promise((resolvePut, rejectPut) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const putRequest = store.put(data);
            putRequest.onsuccess = () => resolvePut(putRequest.result);
            putRequest.onerror = () => rejectPut(putRequest.error);
          });
        },
        delete: (storeName, id) => {
          return new Promise((resolveDelete, rejectDelete) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const deleteRequest = store.delete(id);
            deleteRequest.onsuccess = () => resolveDelete();
            deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
          });
        },
      });
    };
    request.onerror = () => reject(request.error);
  });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? JSON.parse(event.data.text()) : {};
  } catch {
    data = { body: event.data ? event.data.text() : 'Новое уведомление' };
  }

  const title = data.title || 'Maestria';
  const options = {
    body: data.body || 'Новое уведомление',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: data.vibrate || [100, 50, 100],
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 1,
      url: data.url || '/',
      type: data.type || 'general',
    },
    actions: data.actions || [
      { action: 'explore', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  if (event.action === 'explore' || event.action === '') {
    event.waitUntil(
      (async () => {
        const clientList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });

        // Try to focus existing window with matching URL
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(urlToOpen, self.location.origin);
          if (clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
            await client.focus();
            return;
          }
        }

        // Open new window if no matching client found
        if (clientList.length > 0 && 'focus' in clientList[0]) {
          await clientList[0].focus();
          await clientList[0].navigate(urlToOpen);
        } else {
          await clients.openWindow(urlToOpen);
        }
      })()
    );
  }
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CACHE_COURSE':
      cacheCourseData(event.data.courseId);
      break;
    case 'ADD_PENDING_ACTION':
      addPendingAction(event.data.action);
      break;
    case 'CLEAR_CACHES':
      clearAllCaches();
      break;
    default:
      console.log('Unknown message type:', event.data.type);
  }
});

async function cacheCourseData(courseId) {
  try {
    const response = await fetch(`/api/courses/${courseId}`);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(`/api/courses/${courseId}`, response.clone());
    }
  } catch (error) {
    console.log('Failed to cache course:', courseId, error);
  }
}

async function addPendingAction(action) {
  try {
    const db = await openIndexedDB();
    await db.put('pendingActions', {
      url: action.url,
      method: action.method,
      data: action.data,
      timestamp: Date.now(),
    });
    // Register a sync if available
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-data');
    }
  } catch (error) {
    console.log('Failed to add pending action:', error);
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((cacheName) => caches.delete(cacheName))
  );
}
