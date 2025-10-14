from flask import Flask, render_template, Response, jsonify, send_file, request
import cv2
import json
import os
import atexit
import tempfile
from datetime import datetime
from time import time
from src.emotion_detector import EmotionDetector

app = Flask(__name__)

class WebEmotionDetector(EmotionDetector):
    
    def __init__(self, webcam_index=0):
        super().__init__(webcam_index)
        self.current_emotion_data = {
            'emotion': 'neutral',
            'confidence': 0.0,
            'all_emotions': {},
            'timestamp': time()
        }
        self.is_capturing = True  # Estado de captura
        self.temp_file = tempfile.NamedTemporaryFile(
            mode='w+', 
            suffix='.json', 
            prefix='emotions_session_', 
            delete=False,
            encoding='utf-8'
        )
        self.json_file_path = self.temp_file.name
        self.initialize_json_file()
        
        # Registrar función para limpiar al finalizar
        atexit.register(self.cleanup_session)
    
    def initialize_json_file(self):
        initial_data = {
            'session_id': os.path.basename(self.json_file_path),
            'session_start': datetime.now().isoformat(),
            'emotions': []
        }
        # Cerrar el temp file y abrirlo para escritura
        self.temp_file.close()
        with open(self.json_file_path, 'w', encoding='utf-8') as f:
            json.dump(initial_data, f, ensure_ascii=False, indent=2)
    
    def cleanup_session(self):
        try:
            if os.path.exists(self.json_file_path):
                os.unlink(self.json_file_path)
                print(f"Archivo de sesión eliminado: {self.json_file_path}")
        except Exception as e:
            print(f"Error al eliminar archivo de sesión: {e}")
    
    def restart_session(self):
        try:
            # Eliminar archivo anterior
            if os.path.exists(self.json_file_path):
                os.unlink(self.json_file_path)
                print(f"Sesión anterior eliminada: {self.json_file_path}")
            
            # Crear nuevo archivo temporal
            self.temp_file = tempfile.NamedTemporaryFile(
                mode='w+', 
                suffix='.json', 
                prefix='emotions_session_', 
                delete=False,
                encoding='utf-8'
            )
            self.json_file_path = self.temp_file.name
            self.initialize_json_file()
            print(f"Nueva sesión iniciada: {self.json_file_path}")
            
        except Exception as e:
            print(f"Error al reiniciar sesión: {e}")
    
    def save_emotion_to_json(self, emotion):
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            emotion_entry = {
                'emotion': emotion,
            }
            
            data['emotions'].append(emotion_entry)
            
            if len(data['emotions']) > 200:
                data['emotions'] = data['emotions'][-200:]
            
            with open(self.json_file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"Error al guardar en JSON: {e}")
    
    def generate_frames(self):
        """Genera frames para streaming web, reutilizando la lógica existente."""
        if not self.cap or not self.cap.isOpened():
            print("No se puede acceder a la cámara")
            return
        
        last_analysis_time = 0.0
        emotion, confidence, all_emotions = 'neutral', 0.0, {}
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    break
                
                frame = cv2.flip(frame, 1)
                current_time = time()
                
                if self.is_capturing and current_time - last_analysis_time > 3.0:
                    emotion, confidence, all_emotions = self.detect_emotion(frame)
                    
                    # Actualizar datos
                    self.current_emotion_data = {
                        'emotion': emotion,
                        'confidence': confidence,
                        'all_emotions': all_emotions,
                        'timestamp': current_time
                    }
                    
                    # Guardar en json
                    self.save_emotion_to_json(emotion)
                    
                    last_analysis_time = current_time
                # Dibujar resultados solo si está capturando
                if self.is_capturing:
                    self.draw_results(frame, emotion, confidence)
                else:
                    # Mostrar texto de pausa
                    cv2.putText(frame, "CAPTURA PAUSADA", (50, 50), 
                              cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                
                ret, buffer = cv2.imencode('.jpg', frame)
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                           
        except Exception as e:
            print(f"Error en generate_frames: {e}")

# Instancia global del detector web
web_detector = None

def get_web_detector():
    global web_detector
    if web_detector is None:
        web_detector = WebEmotionDetector(webcam_index=0)
    return web_detector

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():

    detector = get_web_detector()
    return Response(detector.generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/emotion_data')
def emotion_data():

    detector = get_web_detector()
    return jsonify(detector.current_emotion_data)

@app.route('/emotions_history')
def emotions_history():
    detector = get_web_detector()
    try:
        if os.path.exists(detector.json_file_path):
            with open(detector.json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify(data)
        else:
            return jsonify({'session_start': datetime.now().isoformat(), 'emotions': []})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/toggle_capture', methods=['POST'])
def toggle_capture():
    """Endpoint para pausar/reanudar la captura de emociones."""
    detector = get_web_detector()
    data = request.get_json()
    
    if data and 'capturing' in data:
        was_paused = not detector.is_capturing
        detector.is_capturing = data['capturing']
        
        # Si se está reanudando después de pausa, reiniciar sesión
        if was_paused and detector.is_capturing:
            detector.restart_session()
        
        return jsonify({
            'success': True, 
            'capturing': detector.is_capturing,
            'session_restarted': was_paused and detector.is_capturing
        })
    
    return jsonify({'success': False, 'error': 'Invalid request'}), 400

@app.route('/get_emotions')
def get_emotions():
    detector = get_web_detector()
    if detector.is_capturing and detector.current_emotion_data['all_emotions']:
        return jsonify(detector.current_emotion_data['all_emotions'])
    else:
        return jsonify({})

@app.route('/health')
def health():
    detector = get_web_detector()
    camera_status = "OK" if (detector.cap and detector.cap.isOpened()) else "Error"
    
    # Verificar si existe el archivo JSON temporal
    json_status = "OK" if os.path.exists(detector.json_file_path) else "No iniciado"
    
    return jsonify({
        'status': 'OK',
        'camera': camera_status,
        'json_logging': json_status,
        'session_file': os.path.basename(detector.json_file_path),
        'capturing': detector.is_capturing,
        'timestamp': time()
    })

if __name__ == '__main__':
    try:
        print("Iniciando servidor en: http://localhost:8080")
        app.run(debug=True, host='0.0.0.0', port=8080, threaded=True)
    except KeyboardInterrupt:
        print("\nAplicación detenida por el usuario")
    finally:
        # Limpiar recursos
        if web_detector and web_detector.cap:
            web_detector.cap.release()
        if web_detector:
            web_detector.cleanup_session()
        cv2.destroyAllWindows()
        print("Recursos liberados y archivo de sesión eliminado")