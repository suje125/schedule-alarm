self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        Promise.all([
            clients.claim(),
            self.registration.showNotification('Alarm Service', {
                body: 'Alarm service is now active',
                icon: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/icons/alarm.svg',
                vibrate: [200, 100, 200]
            })
        ])
    );
});

// Store active alarms
const activeAlarms = new Map();

self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data.type === 'SET_ALARM') {
        const { time, date, description, soundType, soundUrl, repeat } = event.data;
        console.log('Setting alarm for:', date, time, description);
        
        const alarmTime = new Date(`${date}T${time}`);
        const now = new Date();
        const delay = alarmTime - now;

        if (delay > 0) {
            console.log('Alarm will trigger in:', delay, 'ms');
            
            const alarmId = `${date}-${time}-${description}`;
            
            // Clear any existing alarm with same ID
            if (activeAlarms.has(alarmId)) {
                clearTimeout(activeAlarms.get(alarmId));
            }
            
            const triggerAlarm = () => {
                console.log('Alarm triggered!');
                
                // Show notification
                self.registration.showNotification('Alarm', {
                    body: description,
                    icon: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/icons/alarm.svg',
                    vibrate: [200, 100, 200, 100, 200],
                    requireInteraction: true,
                    tag: 'alarm-' + Date.now() // Unique tag for each notification
                }).catch(error => {
                    console.error('Failed to show notification:', error);
                });

                // Send message to all clients
                self.clients.matchAll().then(clients => {
                    console.log('Sending alarm to', clients.length, 'clients');
                    clients.forEach(client => {
                        try {
                            client.postMessage({
                                type: 'ALARM_TRIGGERED',
                                description: description,
                                time: time,
                                date: date,
                                soundType: soundType,
                                soundUrl: soundUrl
                            });
                        } catch (error) {
                            console.error('Failed to send message to client:', error);
                        }
                    });
                }).catch(error => {
                    console.error('Failed to get clients:', error);
                });
                
                // If repeating, set next alarm
                if (repeat) {
                    const nextAlarmTime = new Date(alarmTime.getTime() + 2 * 60 * 60 * 1000); // Add 2 hours
                    const nextDelay = nextAlarmTime - new Date();
                    
                    if (nextDelay > 0) {
                        console.log('Setting next alarm in 2 hours');
                        const timeoutId = setTimeout(triggerAlarm, nextDelay);
                        activeAlarms.set(alarmId, timeoutId);
                    }
                }
            };
            
            const timeoutId = setTimeout(triggerAlarm, delay);
            activeAlarms.set(alarmId, timeoutId);
        } else {
            console.log('Alarm time is in the past');
        }
    }
}); 