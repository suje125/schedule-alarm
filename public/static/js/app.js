// Function to check if DOM is ready
function domReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// Function to get element with retry
function getElementWithRetry(id, maxRetries = 10, delay = 200) {
    return new Promise((resolve) => {
        let retries = 0;
        
        function tryGetElement() {
            const element = document.getElementById(id);
            if (element) {
                console.log(`Found element: ${id}`);
                resolve(element);
            } else if (retries < maxRetries) {
                retries++;
                console.log(`Retry ${retries} for element: ${id}`);
                setTimeout(tryGetElement, delay);
            } else {
                console.error(`Element with id '${id}' not found after ${maxRetries} retries`);
                resolve(null);
            }
        }
        
        tryGetElement();
    });
}

// Function to wait for an element to be available
function waitForElement(id, maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        function checkElement() {
            const element = document.getElementById(id);
            if (element) {
                console.log(`Found element: ${id}`);
                resolve(element);
            } else if (attempts < maxAttempts) {
                attempts++;
                console.log(`Attempt ${attempts} to find element: ${id}`);
                setTimeout(checkElement, interval);
            } else {
                console.error(`Failed to find element: ${id}`);
                reject(new Error(`Element ${id} not found`));
            }
        }
        
        checkElement();
    });
}

// Function to get or create an element
function getOrCreateElement(id, type = 'div') {
    let element = document.getElementById(id);
    if (!element) {
        console.log(`Creating missing element: ${id}`);
        element = document.createElement(type);
        element.id = id;
        document.body.appendChild(element);
    }
    return element;
}

// Main initialization function
async function initializeApp() {
    try {
        console.log('Starting app initialization...');
        
        // Get or create all required elements
        const elements = {
            alarmForm: getOrCreateElement('alarmForm', 'form'),
            alarmsList: getOrCreateElement('alarmsList', 'div'),
            soundTypeSelect: getOrCreateElement('soundType', 'select'),
            customSoundContainer: getOrCreateElement('customSoundContainer', 'div'),
            soundSelect: getOrCreateElement('sound', 'select'),
            soundFileInput: getOrCreateElement('soundFile', 'input'),
            description: getOrCreateElement('description', 'input'),
            date: getOrCreateElement('date', 'input'),
            time: getOrCreateElement('time', 'input'),
            repeat: getOrCreateElement('repeat', 'input')
        };

        // Set up form structure if it was created
        if (!document.getElementById('alarmForm')) {
            elements.alarmForm.innerHTML = `
                <div class="mb-3">
                    <label for="description" class="form-label">Description</label>
                    <input type="text" class="form-control" id="description" required>
                </div>
                
                <div class="mb-3">
                    <label for="date" class="form-label">Date</label>
                    <input type="date" class="form-control" id="date" required>
                </div>
                
                <div class="mb-3">
                    <label for="time" class="form-label">Time</label>
                    <input type="time" class="form-control" id="time" required>
                </div>
                
                <div class="mb-3">
                    <label for="soundType" class="form-label">Sound Type</label>
                    <select class="form-select" id="soundType" required>
                        <option value="normal">Normal Beep</option>
                        <option value="deep">Deep Beep</option>
                        <option value="custom">Custom Sound</option>
                    </select>
                </div>
                
                <div class="mb-3" id="customSoundContainer" style="display: none;">
                    <label for="sound" class="form-label">Custom Sound</label>
                    <select class="form-select" id="sound">
                        <option value="">Select a sound</option>
                    </select>
                    <input type="file" class="form-control mt-2" id="soundFile" accept="audio/*">
                </div>
                
                <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="repeat">
                    <label class="form-check-label" for="repeat">Repeat every 10 minutes</label>
                </div>
                
                <button type="submit" class="btn btn-primary">Set Alarm</button>
            `;
        }

        // Set up input types and attributes
        elements.description.type = 'text';
        elements.date.type = 'date';
        elements.time.type = 'time';
        elements.repeat.type = 'checkbox';
        elements.soundFileInput.type = 'file';
        elements.soundFileInput.accept = 'audio/*';

        // Set up select options if they were created
        if (!elements.soundTypeSelect.options.length) {
            elements.soundTypeSelect.innerHTML = `
                <option value="normal">Normal Beep</option>
                <option value="deep">Deep Beep</option>
                <option value="custom">Custom Sound</option>
            `;
        }

        if (!elements.soundSelect.options.length) {
            elements.soundSelect.innerHTML = '<option value="">Select a sound</option>';
        }

        console.log('All elements ready, continuing initialization...');

        // Initialize variables
        let audioContext = null;
        let currentAlarmSound = null;
        let serviceWorkerRegistration = null;
        let repeatAlarmInterval = null;

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
                // Check if notifications are supported
                if (!('Notification' in window)) {
                    console.log('This browser does not support notifications');
                    return;
                }

                // Check if permission is already granted
                if (Notification.permission === 'granted') {
                    console.log('Notification permission already granted');
                    return;
                }

                // Check if permission is denied
                if (Notification.permission === 'denied') {
                    console.log('Notification permission denied');
                    showNotification('Please enable notifications in your browser settings');
                    return;
                }

                // Request permission
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                    showNotification('Notifications enabled!');
                } else {
                    console.log('Notification permission denied');
                    showNotification('Please enable notifications to receive alarm alerts');
                }
            } catch (error) {
                console.error('Error requesting notification permission:', error);
            }
        }

        // Show notification
        function showAlarmNotification(description) {
            if (Notification.permission === 'granted') {
                new Notification('Alarm', {
                    body: description,
                    icon: '/static/images/alarm-icon.png'
                });
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
                            showAlarmNotification(event.data.description);
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
            
            const description = elements.description.value;
            const date = elements.date.value;
            const time = elements.time.value;
            const soundType = elements.soundTypeSelect.value;
            const repeat = elements.repeat.checked;
            
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

                    // If repeat is enabled, set up the repeat interval
                    if (repeat) {
                        if (repeatAlarmInterval) {
                            clearInterval(repeatAlarmInterval);
                        }
                        repeatAlarmInterval = setInterval(() => {
                            playAlarmSound(soundType, alarm.sound);
                            showAlarmNotification(description);
                        }, 10 * 60 * 1000); // 10 minutes
                    }
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
                                ${alarm.repeat ? '<br><small>Repeats every 10 minutes</small>' : ''}
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
                    // Clear repeat interval if it exists
                    if (repeatAlarmInterval) {
                        clearInterval(repeatAlarmInterval);
                        repeatAlarmInterval = null;
                    }
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
        
        console.log('App initialization complete');
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Error initializing app. Please refresh the page.');
    }
}

// Start the app
initializeApp();

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