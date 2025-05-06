document.addEventListener('DOMContentLoaded', function() {
    const alarmForm = document.getElementById('alarmForm');
    const alarmsList = document.getElementById('alarmsList');

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
            sound
        };

        // Save alarm
        saveAlarm(alarm);
        
        // Reset form
        alarmForm.reset();
        
        // Reload alarms
        loadAlarms();
    });

    // Handle sound file upload
    document.getElementById('soundFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Here you would typically upload the file to the server
            // and add it to the sound options
            console.log('Sound file selected:', file.name);
        }
    });
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
            <button class="btn btn-danger btn-sm" onclick="deleteAlarm(${index})">Delete</button>
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