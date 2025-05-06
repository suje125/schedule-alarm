document.addEventListener('DOMContentLoaded', function() {
    const alarmForm = document.getElementById('alarmForm');
    const alarmsList = document.getElementById('alarmsList');
    let audioContext;
    let currentAlarmSound = null;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    document.body.appendChild(notification);

    // Initialize audio context
    function initAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create a simple beep sound
    function createBeepSound() {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        return oscillator;
    }

    // Show notification
    function showNotification(message) {
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    // Load existing alarms
    loadAlarms();

    // Handle form submission
    alarmForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const description = document.getElementById('description').value;
        const time = document.getElementById('time').value;
        const sound = document.getElementById('sound').value;
        
        const alarm = {
            description,
            time,
            sound,
            active: true
        };

        // Save alarm
        saveAlarm(alarm);
        
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
            // Here you would typically upload the file to the server
            // and add it to the sound options
            showNotification('Sound file selected: ' + file.name);
        }
    });

    // Check alarms every minute
    setInterval(checkAlarms, 60000);
    // Initial check
    checkAlarms();
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
                <small>Time: ${alarm.time}</small>
            </div>
            <div>
                <button class="btn btn-danger btn-sm" onclick="deleteAlarm(${index})">Delete</button>
                <button class="btn btn-warning btn-sm" onclick="toggleAlarm(${index})">
                    ${alarm.active ? 'Disable' : 'Enable'}
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
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    const alarms = JSON.parse(localStorage.getItem('alarms') || '[]');
    
    alarms.forEach((alarm, index) => {
        if (alarm.active && alarm.time === currentTime) {
            // Play sound
            if (!audioContext) {
                initAudio();
            }
            currentAlarmSound = createBeepSound();
            currentAlarmSound.start(0);
            
            // Show notification
            showNotification(`Alarm: ${alarm.description}`);
            
            // Stop sound after 5 seconds
            setTimeout(() => {
                if (currentAlarmSound) {
                    currentAlarmSound.stop();
                    currentAlarmSound = null;
                }
            }, 5000);
        }
    });
} 