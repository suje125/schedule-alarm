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
                // Show notification
                self.registration.showNotification('Alarm', {
                    body: description,
                    icon: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/icons/alarm.svg',
                    vibrate: [200, 100, 200, 100, 200],
                    requireInteraction: true
                });

                // Send message to all clients
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'ALARM_TRIGGERED',
                            description: description
                        });
                    });
                });
            }, delay);
        }
    }
}); 