import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from tkcalendar import Calendar
from datetime import datetime, timedelta
import json
import threading
import time
from playsound import playsound
import os
import shutil

class WorkAlarmApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Work Reminder Alarm")
        self.root.geometry("800x600")
        
        # Create sounds directory if it doesn't exist
        self.sounds_dir = "alarm_sounds"
        if not os.path.exists(self.sounds_dir):
            os.makedirs(self.sounds_dir)
        
        # Load existing alarms
        self.alarms = self.load_alarms()
        
        # Create main frame
        self.main_frame = ttk.Frame(self.root, padding="10")
        self.main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Create widgets
        self.create_widgets()
        
        # Start alarm checker thread
        self.alarm_thread = threading.Thread(target=self.check_alarms, daemon=True)
        self.alarm_thread.start()

    def create_widgets(self):
        # Add new alarm section
        add_frame = ttk.LabelFrame(self.main_frame, text="Add New Reminder", padding="10")
        add_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        ttk.Label(add_frame, text="Description:").grid(row=0, column=0, sticky=tk.W)
        self.description_entry = ttk.Entry(add_frame, width=40)
        self.description_entry.grid(row=0, column=1, padx=5)
        
        ttk.Label(add_frame, text="Time (HH:MM):").grid(row=1, column=0, sticky=tk.W)
        self.time_entry = ttk.Entry(add_frame, width=10)
        self.time_entry.grid(row=1, column=1, sticky=tk.W, padx=5)
        
        # Add volume control
        ttk.Label(add_frame, text="Alarm Volume:").grid(row=2, column=0, sticky=tk.W)
        self.volume_scale = ttk.Scale(add_frame, from_=0, to=100, orient=tk.HORIZONTAL)
        self.volume_scale.set(80)  # Default volume
        self.volume_scale.grid(row=2, column=1, sticky=(tk.W, tk.E), padx=5)
        
        # Add repeat options
        ttk.Label(add_frame, text="Repeat every 5 min:").grid(row=3, column=0, sticky=tk.W)
        self.repeat_var = tk.BooleanVar(value=True)  # Default to True
        ttk.Checkbutton(add_frame, variable=self.repeat_var).grid(row=3, column=1, sticky=tk.W)
        
        # Add sound selection
        ttk.Label(add_frame, text="Alarm Sound:").grid(row=4, column=0, sticky=tk.W)
        self.sound_frame = ttk.Frame(add_frame)
        self.sound_frame.grid(row=4, column=1, sticky=tk.W)
        
        self.sound_var = tk.StringVar(value="default")
        self.sound_combo = ttk.Combobox(self.sound_frame, textvariable=self.sound_var, width=20)
        self.sound_combo.grid(row=0, column=0, padx=5)
        self.update_sound_list()
        
        ttk.Button(self.sound_frame, text="Add Sound", command=self.add_sound).grid(row=0, column=1, padx=5)
        
        ttk.Button(add_frame, text="Add Reminder", command=self.add_alarm).grid(row=5, column=1, pady=10)
        
        # Alarms list section
        list_frame = ttk.LabelFrame(self.main_frame, text="Your Reminders", padding="10")
        list_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # Create Treeview
        self.tree = ttk.Treeview(list_frame, columns=("Time", "Description", "Repeat", "Sound"), show="headings")
        self.tree.heading("Time", text="Time")
        self.tree.heading("Description", text="Description")
        self.tree.heading("Repeat", text="Repeat")
        self.tree.heading("Sound", text="Sound")
        self.tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Add scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        # Buttons frame
        button_frame = ttk.Frame(list_frame)
        button_frame.grid(row=1, column=0, pady=5)
        
        ttk.Button(button_frame, text="Delete Selected", command=self.delete_alarm).grid(row=0, column=0, padx=5)
        ttk.Button(button_frame, text="Clear Past Alarms", command=self.clear_past_alarms).grid(row=0, column=1, padx=5)
        ttk.Button(button_frame, text="Test Alarm Sound", command=self.test_alarm_sound).grid(row=0, column=2, padx=5)
        
        # Populate tree with existing alarms
        self.update_alarm_list()

    def update_sound_list(self):
        sounds = ["default"]
        if os.path.exists(self.sounds_dir):
            sounds.extend([f for f in os.listdir(self.sounds_dir) if f.endswith(('.wav', '.mp3'))])
        self.sound_combo['values'] = sounds

    def add_sound(self):
        file_path = filedialog.askopenfilename(
            title="Select Sound File",
            filetypes=[("Sound files", "*.wav *.mp3")]
        )
        if file_path:
            filename = os.path.basename(file_path)
            dest_path = os.path.join(self.sounds_dir, filename)
            shutil.copy2(file_path, dest_path)
            self.update_sound_list()
            self.sound_var.set(filename)
            messagebox.showinfo("Success", f"Sound {filename} added successfully!")

    def clear_past_alarms(self):
        current_time = datetime.now().strftime("%H:%M")
        self.alarms = [alarm for alarm in self.alarms if alarm["time"] >= current_time]
        self.save_alarms()
        self.update_alarm_list()
        messagebox.showinfo("Success", "Past alarms cleared!")

    def test_alarm_sound(self):
        """Test the alarm sound with current volume settings"""
        sound_file = self.sound_var.get()
        if sound_file == "default":
            sound_path = "alarm.wav"
        else:
            sound_path = os.path.join(self.sounds_dir, sound_file)
            
        try:
            playsound(sound_path)
        except Exception as e:
            messagebox.showerror("Error", f"Could not play alarm sound: {str(e)}")

    def add_alarm(self):
        description = self.description_entry.get().strip()
        time_str = self.time_entry.get().strip()
        
        if not description or not time_str:
            messagebox.showerror("Error", "Please fill in all fields")
            return
            
        try:
            # Validate time format
            datetime.strptime(time_str, "%H:%M")
        except ValueError:
            messagebox.showerror("Error", "Invalid time format. Use HH:MM")
            return
            
        alarm = {
            "description": description,
            "time": time_str,
            "volume": self.volume_scale.get(),
            "repeat": self.repeat_var.get(),
            "repeat_count": 0,  # Track number of repeats
            "sound": self.sound_var.get()
        }
        
        self.alarms.append(alarm)
        self.save_alarms()
        self.update_alarm_list()
        
        # Clear entries
        self.description_entry.delete(0, tk.END)
        self.time_entry.delete(0, tk.END)

    def delete_alarm(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("Warning", "Please select an alarm to delete")
            return
            
        index = self.tree.index(selected_item[0])
        del self.alarms[index]
        self.save_alarms()
        self.update_alarm_list()

    def update_alarm_list(self):
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)
            
        # Add alarms to tree
        for alarm in self.alarms:
            repeat_text = "Yes" if alarm.get("repeat", False) else "No"
            sound_text = alarm.get("sound", "default")
            self.tree.insert("", tk.END, values=(alarm["time"], alarm["description"], repeat_text, sound_text))

    def check_alarms(self):
        while True:
            current_time = datetime.now().strftime("%H:%M")
            for alarm in self.alarms:
                if alarm["time"] == current_time:
                    self.trigger_alarm(alarm)
                    if alarm.get("repeat", False):
                        # Schedule next repeat
                        next_time = (datetime.strptime(current_time, "%H:%M") + timedelta(minutes=5)).strftime("%H:%M")
                        alarm["time"] = next_time
                        alarm["repeat_count"] = alarm.get("repeat_count", 0) + 1
                        
                        # Stop repeating after 5 times
                        if alarm["repeat_count"] >= 5:
                            alarm["repeat"] = False
                            
                        self.save_alarms()
                        self.update_alarm_list()
            time.sleep(30)  # Check every 30 seconds

    def trigger_alarm(self, alarm):
        # Create a new window for the alarm
        alarm_window = tk.Toplevel(self.root)
        alarm_window.title("Reminder!")
        alarm_window.geometry("300x150")
        
        # Make the window stay on top
        alarm_window.attributes('-topmost', True)
        
        repeat_text = f" (Repeat {alarm.get('repeat_count', 0) + 1}/5)" if alarm.get("repeat", False) else ""
        ttk.Label(alarm_window, text=f"Time for: {alarm['description']}{repeat_text}", font=("Arial", 12)).pack(pady=20)
        ttk.Button(alarm_window, text="Dismiss", command=alarm_window.destroy).pack()
        
        # Play sound
        try:
            sound_file = alarm.get("sound", "default")
            if sound_file == "default":
                sound_path = "alarm.wav"
            else:
                sound_path = os.path.join(self.sounds_dir, sound_file)
            playsound(sound_path)
        except Exception as e:
            print(f"Error playing sound: {str(e)}")

    def load_alarms(self):
        try:
            with open("alarms.json", "r") as f:
                return json.load(f)
        except FileNotFoundError:
            return []

    def save_alarms(self):
        with open("alarms.json", "w") as f:
            json.dump(self.alarms, f)

if __name__ == "__main__":
    root = tk.Tk()
    app = WorkAlarmApp(root)
    root.mainloop() 