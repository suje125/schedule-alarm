// Function to check if DOM is ready
function domReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// Function to get element with retry
function getElementWithRetry(id, maxRetries = 5, delay = 100) {
    return new Promise((resolve) => {
        let retries = 0;
        
        function tryGetElement() {
            const element = document.getElementById(id);
            if (element) {
                resolve(element);
            } else if (retries < maxRetries) {
                retries++;
                setTimeout(tryGetElement, delay);
            } else {
                resolve(null);
            }
        }
        
        tryGetElement();
    });
}

// Main initialization function
async function initializeApp() {
    try {
        // Get all required elements with retry
        const elements = {
            alarmForm: await getElementWithRetry('alarmForm'),
            alarmsList: await getElementWithRetry('alarmsList'),
            soundTypeSelect: await getElementWithRetry('soundType'),
            customSoundContainer: await getElementWithRetry('customSoundContainer'),
            soundSelect: await getElementWithRetry('sound'),
            soundFileInput: await getElementWithRetry('soundFile')
        };

        // Check if all elements exist
        const missingElements = Object.entries(elements)
            .filter(([_, element]) => !element)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            console.error('Missing elements:', missingElements);
            alert('Some required elements are missing. Please refresh the page.');
            return;
        }

        // Initialize variables
        let audioContext = null;
        let currentAlarmSound = null;
        let serviceWorkerRegistration = null;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);

        // Show notification
        function showNotification(message) {
            notification.textContent = message;
            notification.style.display = 'block';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 5000);
        }

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

        // Create sound based on type
        function createSound(type, soundUrl) {
            if (!audioContext) {
                if (!initAudio()) return null;
            }

            try {
                if (type === 'custom' && soundUrl) {
                    const audio = new Audio(soundUrl);
                    return audio;
                } else {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.type = 'sine';
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
                        currentAlarmSound.loop = true;
                        currentAlarmSound.play();
                        
                        setTimeout(() => {
                            if (currentAlarmSound) {
                                currentAlarmSound.pause();
                                currentAlarmSound.currentTime = 0;
                                currentAlarmSound = null;
                            }
                        }, 10000);
                    } else {
                        currentAlarmSound.start(0);
                        
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

        // Request notification permission
        async function requestNotificationPermission() {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    showNotification('Notifications enabled!');
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
                    
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data.type === 'ALARM_TRIGGERED') {
                            playAlarmSound(event.data.soundType, event.data.soundUrl);
                            showNotification(`Alarm: ${event.data.description}`);
                        }
                    });
                }
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }

        // Show/hide custom sound options
        elements.soundTypeSelect.addEventListener('change', function() {
            elements.customSoundContainer.style.display = this.value === 'custom' ? 'block' : 'none';
        });

        // Load sounds when custom sound is selected
        elements.soundTypeSelect.addEventListener('change', async function() {
            if (this.value === 'custom') {
                try {
                    const response = await fetch('/api/sounds');
                    const sounds = await response.json();
                    
                    elements.soundSelect.innerHTML = '<option value="">Select a sound</option>';
                    sounds.forEach(sound => {
                        const option = document.createElement('option');
                        option.value = sound;
                        option.textContent = sound;
                        elements.soundSelect.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error loading sounds:', error);
                }
            }
        });

        // Handle sound file upload
        elements.soundFileInput.addEventListener('change', async function() {
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
                        const soundsResponse = await fetch('/api/sounds');
                        const sounds = await soundsResponse.json();
                        
                        elements.soundSelect.innerHTML = '<option value="">Select a sound</option>';
                        sounds.forEach(sound => {
                            const option = document.createElement('option');
                            option.value = sound;
                            option.textContent = sound;
                            elements.soundSelect.appendChild(option);
                        });
                        
                        elements.soundSelect.value = result.filename;
                    }
                } catch (error) {
                    console.error('Error uploading sound:', error);
                }
            }
        });

        // Handle form submission
        elements.alarmForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const description = document.getElementById('description').value;
            const date = document.getElementById('date').value;
            const time = document.getElementById('time').value;
            const soundType = elements.soundTypeSelect.value;
            const repeat = document.getElementById('repeat').checked;
            
            if (!description || !date || !time) {
                alert('Please fill in all required fields');
                return;
            }
            
            const alarm = {
                description,
                date,
                time,
                soundType,
                repeat,
                sound: soundType === 'custom' ? elements.soundSelect.value : null
            };
            
            try {
                const response = await fetch('/api/alarms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(alarm)
                });
                
                const result = await response.json();
                if (result.message) {
                    elements.alarmForm.reset();
                    elements.customSoundContainer.style.display = 'none';
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
                
                elements.alarmsList.innerHTML = '';
                
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
                    elements.alarmsList.appendChild(alarmElement);
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
                    loadAlarms();
                } else {
                    alert('Error deleting alarm: ' + result.error);
                }
            } catch (error) {
                console.error('Error deleting alarm:', error);
                alert('Error deleting alarm. Please try again.');
            }
        }

        // Initialize
        loadAlarms();
        requestNotificationPermission();
        registerServiceWorker();
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing app. Please refresh the page.');
    }
}

// Start the app when DOM is ready
domReady(initializeApp);

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