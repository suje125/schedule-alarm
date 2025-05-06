document.addEventListener('DOMContentLoaded', function() {
    const alarmForm = document.getElementById('alarmForm');
    const alarmsList = document.getElementById('alarmsList');
    let audioContext = null;
    let currentAlarmSound = null;
    let serviceWorkerRegistration;
    let repeatInterval = null;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    document.body.appendChild(notification);

    // Initialize audio context
    function initAudio() {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            showNotification('Audio not supported in this browser');
            return false;
        }
    }

    // Create a sound based on type
    function createSound(type, soundUrl) {
        if (!audioContext) {
            if (!initAudio()) return null;
        }
        
        try {
            if (type === 'custom' && soundUrl) {
                // For custom sounds
                const audio = new Audio(soundUrl);
                return audio;
            } else {
                // For built-in sounds
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = 'sine';
                // Set frequency based on type
                oscillator.frequency.value = type === 'deep' ? 200 : 800;
                gainNode.gain.value = 0.5;
                
                return oscillator;
            }
        } catch (error) {
            console.error('Failed to create sound:', error);
            return null;
        }
    }

    // Play alarm sound
    function playAlarmSound(soundType, soundUrl) {
        if (!audioContext) {
            if (!initAudio()) return;
        }
        
        try {
            currentAlarmSound = createSound(soundType, soundUrl);
            if (currentAlarmSound) {
                if (soundType === 'custom') {
                    // For Audio objects
                    currentAlarmSound.loop = true;
                    currentAlarmSound.play();
                    
                    // Stop sound after 10 seconds
                    setTimeout(() => {
                        if (currentAlarmSound) {
                            currentAlarmSound.pause();
                            currentAlarmSound.currentTime = 0;
                            currentAlarmSound = null;
                        }
                    }, 10000);
                } else {
                    // For oscillator
                    currentAlarmSound.start(0);
                    
                    // Stop sound after 10 seconds
                    setTimeout(() => {
                        if (currentAlarmSound) {
                            currentAlarmSound.stop();
                            currentAlarmSound = null;
                        }
                    }, 10000);
                }
            }
        } catch (error) {
            console.error('Failed to play alarm sound:', error);
            showNotification('Failed to play alarm sound');
        }
    }

    // Show notification
    function showNotification(message) {
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }

    // Request notification permission
    async function requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showNotification('Notifications enabled!');
            } else {
                console.warn('Notification permission denied');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    // Register service worker
    async function registerServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                console.log('ServiceWorker registration successful with scope:', serviceWorkerRegistration.scope);
                
                // Listen for service worker messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    console.log('Received message from service worker:', event.data);
                    if (event.data.type === 'ALARM_TRIGGERED') {
                        playAlarmSound(event.data.soundType, event.data.soundUrl);
                        showNotification(`Alarm: ${event.data.description}`);
                    }
                });
            } else {
                console.warn('Service workers are not supported');
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Load existing alarms
    loadAlarms();

    // Handle form submission
    alarmForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const description = document.getElementById('description').value;
        const time = document.getElementById('time').value;
        const date = document.getElementById('date').value;
        const soundType = document.getElementById('soundType').value;
        const repeatCheckbox = document.getElementById('repeat');
        const repeat = repeatCheckbox ? repeatCheckbox.checked : false;
        
        // Get sound value based on sound type
        let sound = '';
        if (soundType === 'custom') {
            const soundSelect = document.getElementById('sound');
            sound = soundSelect ? soundSelect.value : '';
        }
        
        const alarm = {
            description,
            time,
            date,
            sound,
            soundType,
            repeat,
            active: true
        };

        // Save alarm
        saveAlarm(alarm);
        
        // Set alarm in service worker
        if (serviceWorkerRegistration && serviceWorkerRegistration.active) {
            try {
                serviceWorkerRegistration.active.postMessage({
                    type: 'SET_ALARM',
                    time,
                    date,
                    description,
                    soundType,
                    soundUrl: sound,
                    repeat
                });
            } catch (error) {
                console.error('Failed to send message to service worker:', error);
                showNotification('Failed to set alarm');
            }
        }
        
        // Reset form
        alarmForm.reset();
        
        // Show notification
        showNotification('Alarm added successfully!');
        
        // Reload alarms
        loadAlarms();
    });

    // Handle sound file upload
    document.getElementById('soundFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const soundOption = document.createElement('option');
                soundOption.value = e.target.result;
                soundOption.textContent = file.name;
                document.getElementById('sound').appendChild(soundOption);
                showNotification('Sound file added to options!');
            };
            reader.readAsDataURL(file);
        }
    });

    // Check alarms every minute
    setInterval(checkAlarms, 60000);
    // Initial check
    checkAlarms();
    // Request notification permission
    requestNotificationPermission();
    // Register service worker
    registerServiceWorker();
});

function saveAlarm(alarm) {
    let alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    alarms.push(alarm);
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

function loadAlarms() {
    const alarmsList = document.getElementById('alarmsList');
    alarmsList.innerHTML = '';
    
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    
    alarms.forEach((alarm, index) => {
        const alarmElement = document.createElement('div');
        alarmElement.className = 'list-group-item';
        alarmElement.innerHTML = `
            <div>
                <strong>${alarm.description}</strong><br>
                <small>Date: ${alarm.date}</small><br>
                <small>Time: ${alarm.time}</small>
            </div>
            <div>
                <button class="btn btn-danger btn-sm" onclick="deleteAlarm(${index})">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-warning btn-sm" onclick="toggleAlarm(${index})">
                    <i class="fas ${alarm.active ? 'fa-bell' : 'fa-bell-slash'}"></i>
                </button>
            </div>
        `;
        alarmsList.appendChild(alarmElement);
    });
}

function deleteAlarm(index) {
    let alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    alarms.splice(index, 1);
    localStorage.setItem('alarms', JSON.stringify(alarms));
    loadAlarms();
}

function toggleAlarm(index) {
    let alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    alarms[index].active = !alarms[index].active;
    localStorage.setItem('alarms', JSON.stringify(alarms));
    loadAlarms();
}

function checkAlarms() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    
    alarms.forEach((alarm, index) => {
        if (alarm.active && alarm.date === currentDate && alarm.time === currentTime) {
            // Play sound
            playAlarmSound(alarm.soundType, alarm.sound);
            
            // Show notifications
            showNotification(`Alarm: ${alarm.description}`);
            
            // Send message to service worker
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'ALARM_TRIGGERED',
                    description: alarm.description,
                    soundType: alarm.soundType,
                    soundUrl: alarm.sound
                });
            }
        }
    });
} 