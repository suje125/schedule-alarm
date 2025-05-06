self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'SET_ALARM') {
        const { time, date, description } = event.data;
        const alarmTime = new Date(`${date}T${time}`);
        const now = new Date();
        const delay = alarmTime - now;

        if (delay > 0) {
            setTimeout(() => {
                self.registration.showNotification('Alarm', {
                    body: description,
                    icon: '/static/images/icon.png',
                    vibrate: [200, 100, 200, 100, 200],
                    requireInteraction: true
                });
            }, delay);
        }
    }
}); 