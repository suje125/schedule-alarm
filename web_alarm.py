from flask import Flask, request, jsonify, render_template, send_from_directory
import os
from datetime import datetime
import time
import threading
import pygame
import json
import numpy as np
import wave
import struct

app = Flask(__name__, static_folder='static')

# Check if running on production (Render.com)
IS_PRODUCTION = os.environ.get('RENDER', False)

# Initialize pygame mixer only in development
if not IS_PRODUCTION:
    pygame.mixer.init()

# Create sounds directory if it doesn't exist
if not os.path.exists('sounds'):
    os.makedirs('sounds')

# Default alarm sound
DEFAULT_SOUND = 'sounds/default.wav'
if not os.path.exists(DEFAULT_SOUND) and not IS_PRODUCTION:
    # Create a simple beep sound as default
    sample_rate = 44100
    duration = 1  # seconds
    frequency = 440  # Hz (A4 note)
    t = np.linspace(0, duration, int(sample_rate * duration))
    samples = np.sin(2 * np.pi * frequency * t)
    samples = np.int16(samples * 32767)
    
    # Save as WAV file
    with wave.open(DEFAULT_SOUND, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 2 bytes per sample
        wav_file.setframerate(sample_rate)
        for sample in samples:
            wav_file.writeframes(struct.pack('h', sample))

# Store alarms and history in memory
alarms = []
alarm_history = []

def check_alarms():
    while True:
        try:
            current_date = datetime.now().strftime('%Y-%m-%d')
            current_time = datetime.now().strftime('%H:%M')
            
            for alarm in alarms[:]:
                if (alarm.get('date') == current_date and 
                    alarm.get('time') == current_time and 
                    not alarm.get('triggered', False)):
                    
                    # Add to history
                    history_entry = {
                        'description': alarm['description'],
                        'date': alarm['date'],
                        'time': alarm['time'],
                        'triggered_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'sound': alarm.get('sound', 'default.wav')
                    }
                    alarm_history.append(history_entry)
                    
                    # Play alarm sound
                    sound_file = os.path.join('sounds', alarm.get('sound', 'default.wav'))
                    if not os.path.exists(sound_file):
                        sound_file = DEFAULT_SOUND
                    
                    if not IS_PRODUCTION:
                        try:
                            sound = pygame.mixer.Sound(sound_file)
                            sound.set_volume(alarm.get('volume', 0.8))
                            sound.play()
                        except Exception as e:
                            print(f"Error playing sound: {str(e)}")
                    
                    # Mark as triggered
                    alarm['triggered'] = True
                    
                    # Handle repeat
                    if alarm.get('repeat', False):
                        # Reset triggered after 5 minutes
                        def reset_triggered():
                            time.sleep(300)  # 5 minutes
                            alarm['triggered'] = False
                        
                        threading.Thread(target=reset_triggered).start()
                    else:
                        # Remove alarm if not repeating
                        alarms.remove(alarm)
            
            time.sleep(1)  # Check every second
        except Exception as e:
            print(f"Error in check_alarms: {str(e)}")
            time.sleep(5)  # Wait a bit longer if there's an error

# Start alarm checking thread
if not IS_PRODUCTION:
    threading.Thread(target=check_alarms, daemon=True).start()

# Serve static files
@app.route('/sw.js')
def service_worker():
    return send_from_directory('static', 'sw.js')

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/icon-<size>.png')
def icon(size):
    return send_from_directory('static', f'icon-{size}.png')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/alarms', methods=['GET'])
def get_alarms():
    return jsonify(alarms)

@app.route('/api/alarms', methods=['POST'])
def add_alarm():
    try:
        alarm = request.json
        # Validate required fields
        required_fields = ['description', 'date', 'time']
        for field in required_fields:
            if field not in alarm:
                return jsonify({'status': 'error', 'message': f'Missing required field: {field}'})
        
        # Set default values
        alarm['triggered'] = False
        alarm['sound'] = alarm.get('sound', 'default.wav')
        alarm['repeat'] = alarm.get('repeat', False)
        
        alarms.append(alarm)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/alarms/<int:index>', methods=['DELETE'])
def delete_alarm(index):
    if 0 <= index < len(alarms):
        alarms.pop(index)
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Invalid alarm index'})

@app.route('/api/alarms/clear-past', methods=['POST'])
def clear_past_alarms():
    current_date = datetime.now().strftime('%Y-%m-%d')
    current_time = datetime.now().strftime('%H:%M')
    
    global alarms
    alarms = [alarm for alarm in alarms if 
              alarm.get('date', '') > current_date or 
              (alarm.get('date', '') == current_date and alarm.get('time', '') > current_time)]
    
    return jsonify({'status': 'success'})

@app.route('/api/sounds', methods=['GET'])
def get_sounds():
    sounds = ['default.wav']
    if os.path.exists('sounds'):
        for file in os.listdir('sounds'):
            if file.endswith(('.wav', '.mp3')):
                sounds.append(file)
    return jsonify(sounds)

@app.route('/api/sounds', methods=['POST'])
def upload_sound():
    if 'sound' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file uploaded'})
    
    file = request.files['sound']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No file selected'})
    
    if file and file.filename.endswith(('.wav', '.mp3')):
        filename = file.filename
        file.save(os.path.join('sounds', filename))
        return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error', 'message': 'Invalid file type'})

@app.route('/api/alarms/history', methods=['GET'])
def get_alarm_history():
    return jsonify(alarm_history)

@app.route('/api/alarms/history/clear', methods=['POST'])
def clear_alarm_history():
    global alarm_history
    alarm_history = []
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    # Use production server when deployed
    if IS_PRODUCTION:
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 10000)))
    else:
        app.run(debug=True) 

