import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from datetime import datetime
import json
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from whitenoise import WhiteNoise

# Get the absolute path to the project root
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, 
    static_url_path='/static',
    static_folder=os.path.join(BASE_DIR, 'public/static'),
    template_folder=os.path.join(BASE_DIR, 'public/templates')
)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(BASE_DIR, 'public/static'))

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public/static/sounds')
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure the upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Ensure the alarms.json file exists
ALARMS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'alarms.json')
if not os.path.exists(ALARMS_FILE):
    with open(ALARMS_FILE, 'w') as f:
        json.dump([], f)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/app')
def app_page():
    return render_template('app.html', now=datetime.now())

@app.route('/sw.js')
def service_worker():
    response = send_from_directory('public/static/js', 'sw.js')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/api/alarms', methods=['GET'])
def get_alarms():
    try:
        with open(ALARMS_FILE, 'r') as f:
            alarms = json.load(f)
        return jsonify(alarms)
    except FileNotFoundError:
        return jsonify([])

@app.route('/api/alarms', methods=['POST'])
def add_alarm():
    try:
        data = request.json
        with open(ALARMS_FILE, 'r') as f:
            alarms = json.load(f)
        
        # Add new alarm
        alarms.append(data)
        
        with open(ALARMS_FILE, 'w') as f:
            json.dump(alarms, f)
        
        return jsonify({"message": "Alarm added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alarms/<int:index>', methods=['DELETE'])
def delete_alarm(index):
    try:
        with open(ALARMS_FILE, 'r') as f:
            alarms = json.load(f)
        
        if 0 <= index < len(alarms):
            alarms.pop(index)
            
            with open(ALARMS_FILE, 'w') as f:
                json.dump(alarms, f)
            
            return jsonify({"message": "Alarm deleted successfully"})
        else:
            return jsonify({"error": "Invalid alarm index"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sounds', methods=['GET'])
def get_sounds():
    try:
        sounds = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) 
                 if allowed_file(f)]
        return jsonify(sounds)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sounds', methods=['POST'])
def upload_sound():
    if 'sound' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['sound']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return jsonify({"message": "Sound uploaded successfully", "filename": filename})
    
    return jsonify({"error": "Invalid file type"}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port) 