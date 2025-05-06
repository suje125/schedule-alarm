// Service Worker for Alarm App
const CACHE_NAME = 'alarm-app-v1';
const urlsToCache = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/images/alarm-icon.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Handle alarm notifications
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'ALARM_TRIGGERED') {
        // Show notification
        self.registration.showNotification('Alarm', {
            body: event.data.description,
            icon: '/static/images/alarm-icon.png',
            badge: '/static/images/alarm-icon.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            actions: [
                {
                    action: 'snooze',
                    title: 'Snooze 10 minutes'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        });
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'snooze') {
        // Send message to client to snooze alarm
        event.waitUntil(
            clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SNOOZE_ALARM',
                        duration: 10 * 60 * 1000 // 10 minutes
                    });
                });
            })
        );
    } else if (event.action === 'dismiss') {
        // Send message to client to dismiss alarm
        event.waitUntil(
            clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'DISMISS_ALARM'
                    });
                });
            })
        );
    } else {
        // Default click behavior - focus the window
        event.waitUntil(
            clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    clients[0].focus();
                }
            })
        );
    }
}); 