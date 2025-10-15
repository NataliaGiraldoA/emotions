import sounddevice as sd
import numpy as np
import threading
import tempfile
import os
from datetime import datetime
import wave


class AudioRecorder:
    def __init__(self, sample_rate=44100, channels=1):

        self.sample_rate = sample_rate
        self.channels = channels
        self.is_recording = False
        self.audio_data = []
        self.recording_thread = None
        self.temp_file_path = None
        
    def start_recording(self):
        if self.is_recording:
            return False, "Ya se está grabando"
            
        self.is_recording = True
        self.audio_data = []
        
        # Crear archivo temporal
        temp_file = tempfile.NamedTemporaryFile(
            suffix='.wav',
            prefix='audio_recording_',
            delete=False
        )
        self.temp_file_path = temp_file.name
        temp_file.close()
        

        self.recording_thread = threading.Thread(target=self._record_audio)
        self.recording_thread.start()
        
        return True, "Grabación iniciada"
    
    def stop_recording(self):
        if not self.is_recording:
            return False, "No se está grabando"
            
        self.is_recording = False
        
        # Esperar a que termine el hilo de grabación
        if self.recording_thread:
            self.recording_thread.join()
            
        # Guardar audio en archivo
        if self.audio_data:
            self._save_audio_file()
            return True, f"Grabación guardada en {self.temp_file_path}"
        else:
            return False, "No hay datos de audio para guardar"
    
    def _record_audio(self):
        try:
            def callback(indata, frames, time, status):
                if status:
                    print(f"Audio recording status: {status}")
                if self.is_recording:
                    self.audio_data.append(indata.copy())
            
            with sd.InputStream(
                callback=callback,
                channels=self.channels,
                samplerate=self.sample_rate,
                dtype=np.float32
            ):
                while self.is_recording:
                    sd.sleep(100)  # Dormir 100ms
                    
        except Exception as e:
            print(f"Error durante la grabación: {e}")
            self.is_recording = False
    
    def _save_audio_file(self):
        if not self.audio_data:
            return
            
        # Concatenar todos los fragmentos de audio
        audio_array = np.concatenate(self.audio_data, axis=0)
        
        # Convertir a int16 para compatibilidad WAV
        audio_int16 = (audio_array * 32767).astype(np.int16)
        
        # Guardar como archivo WAV
        with wave.open(self.temp_file_path, 'wb') as wav_file:
            wav_file.setnchannels(self.channels)
            wav_file.setsampwidth(2)  # 2 bytes para int16
            wav_file.setframerate(self.sample_rate)
            wav_file.writeframes(audio_int16.tobytes())
    
    def get_recording_status(self):
        return {
            'is_recording': self.is_recording,
            'file_path': self.temp_file_path if self.temp_file_path else None,
            'duration': len(self.audio_data) * 100 / 1000 if self.audio_data else 0 # en segundos
        }

    def cleanup(self):
        if self.is_recording:
            self.stop_recording()
            
        if self.temp_file_path and os.path.exists(self.temp_file_path):
            try:
                os.unlink(self.temp_file_path)
                print(f"Archivo de audio temporal eliminado: {self.temp_file_path}")
            except Exception as e:
                print(f"Error al eliminar archivo temporal: {e}")
    
    def get_audio_devices(self):
        try:
            devices = sd.query_devices()
            return devices
        except Exception as e:
            print(f"Error al obtener dispositivos de audio: {e}")
            return []
