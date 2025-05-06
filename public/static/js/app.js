document.addEventListener('DOMContentLoaded', function() {
    // Wait for DOM to be fully loaded
    setTimeout(function() {
        const alarmForm = document.getElementById('alarmForm');
        const alarmsList = document.getElementById('alarmsList');
        const soundTypeSelect = document.getElementById('soundType');
        const customSoundContainer = document.getElementById('customSoundContainer');
        const soundSelect = document.getElementById('sound');
        const soundFileInput = document.getElementById('soundFile');

        if (!alarmForm || !alarmsList || !soundTypeSelect || !customSoundContainer || !soundSelect || !soundFileInput) {
            console.error('Required DOM elements not found. Please refresh the page.');
            alert('Required elements not found. Please refresh the page.');
            return;
        }

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

        // Show/hide custom sound options based on sound type
        soundTypeSelect.addEventListener('change', function() {
            customSoundContainer.style.display = this.value === 'custom' ? 'block' : 'none';
        });

        // Load sounds when custom sound is selected
        soundTypeSelect.addEventListener('change', async function() {
            if (this.value === 'custom') {
                try {
                    const response = await fetch('/api/sounds');
                    const sounds = await response.json();
                    
                    // Clear existing options
                    soundSelect.innerHTML = '<option value="">Select a sound</option>';
                    
                    // Add new options
                    sounds.forEach(sound => {
                        const option = document.createElement('option');
                        option.value = sound;
                        option.textContent = sound;
                        soundSelect.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error loading sounds:', error);
                }
            }
        });

        // Handle sound file upload
        soundFileInput.addEventListener('change', async function() {
            if (this.files.length > 0) {
                const formData = new FormData();
                formData.append('sound', this.files[0]);
                
                try {
                    const response = await fetch('/api/sounds', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.message) {
                        // Reload sounds after upload
                        const soundsResponse = await fetch('/api/sounds');
                        const sounds = await soundsResponse.json();
                        
                        // Update sound select
                        soundSelect.innerHTML = '<option value="">Select a sound</option>';
                        sounds.forEach(sound => {
                            const option = document.createElement('option');
                            option.value = sound;
                            option.textContent = sound;
                            soundSelect.appendChild(option);
                        });
                        
                        // Select the newly uploaded sound
                        soundSelect.value = result.filename;
                    }
                } catch (error) {
                    console.error('Error uploading sound:', error);
                }
            }
        });

        // Handle form submission
        alarmForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form values
            const description = document.getElementById('description').value;
            const date = document.getElementById('date').value;
            const time = document.getElementById('time').value;
            const soundType = soundTypeSelect.value;
            const repeat = document.getElementById('repeat').checked;
            
            // Validate form
            if (!description || !date || !time) {
                alert('Please fill in all required fields');
                return;
            }
            
            // Create alarm object
            const alarm = {
                description,
                date,
                time,
                soundType,
                repeat,
                sound: soundType === 'custom' ? soundSelect.value : null
            };
            
            try {
                // Send alarm to server
                const response = await fetch('/api/alarms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(alarm)
                });
                
                const result = await response.json();
                if (result.message) {
                    // Clear form
                    alarmForm.reset();
                    customSoundContainer.style.display = 'none';
                    
                    // Reload alarms
                    loadAlarms();
                } else {
                    alert('Error adding alarm: ' + result.error);
                }
            } catch (error) {
                console.error('Error adding alarm:', error);
                alert('Error adding alarm. Please try again.');
            }
        });

        // Load alarms from server
        async function loadAlarms() {
            try {
                const response = await fetch('/api/alarms');
                const alarms = await response.json();
                
                // Clear existing alarms
                alarmsList.innerHTML = '';
                
                // Add each alarm to the list
                alarms.forEach((alarm, index) => {
                    const alarmElement = document.createElement('div');
                    alarmElement.className = 'list-group-item';
                    alarmElement.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">${alarm.description}</h5>
                                <small>${alarm.date} at ${alarm.time}</small>
                                <br>
                                <small>Sound: ${alarm.soundType}${alarm.sound ? ' - ' + alarm.sound : ''}</small>
                                ${alarm.repeat ? '<br><small>Repeats every 2 hours</small>' : ''}
                            </div>
                            <button class="btn btn-danger btn-sm" onclick="deleteAlarm(${index})">Delete</button>
                        </div>
                    `;
                    alarmsList.appendChild(alarmElement);
                });
            } catch (error) {
                console.error('Error loading alarms:', error);
            }
        }

        // Delete alarm
        async function deleteAlarm(index) {
            try {
                const response = await fetch(`/api/alarms/${index}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                if (result.message) {
                    // Reload alarms
                    loadAlarms();
                } else {
                    alert('Error deleting alarm: ' + result.error);
                }
            } catch (error) {
                console.error('Error deleting alarm:', error);
                alert('Error deleting alarm. Please try again.');
            }
        }

        // Load alarms when page loads
        loadAlarms();
        // Request notification permission
        requestNotificationPermission();
        // Register service worker
        registerServiceWorker();
    }, 100); // Small delay to ensure DOM is fully loaded
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