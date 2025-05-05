import numpy as np
from scipy.io import wavfile

# Generate a simple alarm sound
sample_rate = 44100
duration = 2  # seconds
t = np.linspace(0, duration, int(sample_rate * duration), False)

# Create a beeping sound
frequency = 1000
sound = np.sin(2 * np.pi * frequency * t) * 0.5

# Add some variation to make it more interesting
sound = sound * np.exp(-t)  # Fade out
sound = np.int16(sound * 32767)  # Convert to 16-bit PCM

# Save the sound file
wavfile.write('alarm.wav', sample_rate, sound) 