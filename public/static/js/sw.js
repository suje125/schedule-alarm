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
                    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzBkNmVmZCIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDIgMC04LTMuNTgtOC04czMuNTgtOCA4LTggOCAzLjU4IDggOC0zLjU4IDgtOCA4em0uNS0xM0gxMXY2bDUgMgw1IDExaC0yVjloLTN2Nmgydi0yLjA3TDEyLjUgMTN6Ii8+PC9zdmc+',
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