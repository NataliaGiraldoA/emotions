from flask import Flask, render_template, Response, jsonify, send_file, request, session
import cv2
import json
import os
import atexit
import tempfile
from datetime import datetime
from time import time
from src.emotion_detector import EmotionDetector
from src.api import gemini_reply
from src.audio_recorder import AudioRecorder
from flask_cors import CORS
from faster_whisper import WhisperModel

import json
import re


app = Flask(__name__)
app.secret_key = "natali"
CORS(app)

model = WhisperModel("base", device="cpu", compute_type="int8")

INITIAL_PROMPT = (
    "Eres un asistente musical amable y curioso llamado Kelsier. "
    "Tu tarea es conocer al usuario con solo 3 preguntas cortas para recomendarle canciones que puedan gustarle. "
    "Empieza tú la conversación saludando y haciendo la primera pregunta. "
    "Ten en cuenta que las respuestas del usuario pueden venir con errores de transcripción, así que interpreta lo mejor posible. "
    "Evita respuestas largas, sé natural y conversacional. "
    "Cuando llegues a la quinta pregunta, da tus recomendaciones basadas en lo que conoces de la persona."
)

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
# Instancia global del audio recorder
audio_recorder = None

def get_web_detector():
    global web_detector
    if web_detector is None:
        web_detector = WebEmotionDetector(webcam_index=0)
    return web_detector

def get_audio_recorder():
    global audio_recorder
    if audio_recorder is None:
        audio_recorder = AudioRecorder()
    return audio_recorder


@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/setup')
def setup():
    return render_template('setup.html')

@app.route('/app')
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

"""
@app.route('/llm')
def call_deepseek():
    text = "Hola, ¿cómo estás?"
    respuesta = gemini_reply(text)
    print(respuesta)
    return respuesta"""

# Rutas para el audio recorder
@app.route('/audio/start_recording', methods=['POST'])
def start_audio_recording():
    """Inicia la grabación de audio."""
    recorder = get_audio_recorder()
    success, message = recorder.start_recording()
    return jsonify({
        'success': success,
        'message': message,
        'status': recorder.get_recording_status()
    })

@app.route('/audio/stop_recording', methods=['POST'])
def stop_audio_recording():
    """Detiene la grabación de audio."""
    recorder = get_audio_recorder()
    success, message = recorder.stop_recording()
    return jsonify({
        'success': success,
        'message': message,
        'status': recorder.get_recording_status()
    })

@app.route('/audio/status')
def audio_status():
    """Obtiene el estado actual de la grabación."""
    recorder = get_audio_recorder()
    return jsonify(recorder.get_recording_status())


@app.route("/transcribe")
def transcribe():
    session.pop("chat_history", None)
    return render_template("transcribe.html")



@app.route("/transcribe_audio", methods=["POST"])
def transcribe_audio():
    try:
        audio_file = request.files["audio"]
        filename = "temp.wav"
        audio_file.save(filename)

        segments, info = model.transcribe(filename, beam_size=5)
        text = " ".join([seg.text for seg in segments])
        os.remove(filename)

        #print(f"🎙️ Transcripción: {text}")
        return jsonify({"text": text})
    except Exception as e:
        print(f"Error al transcribir: {e}")
        return jsonify({"error": str(e)})
    

@app.route("/start_chat", methods=["GET"])
def start_chat():
    """Inicia la conversación: la IA saluda y hace la primera pregunta."""
    session["chat_history"] = []
    session["question_count"] = 1

    primera_respuesta = "¡Hola! Soy Kelsier. Quiero conocerte un poco para recomendarte música que te encante. " \
                        "Cuéntame, ¿qué tipo de música sueles escuchar últimamente?"

    session["chat_history"].append({"role": "assistant", "text": primera_respuesta})
    return jsonify({"response": primera_respuesta})

"""
@app.route("/llm", methods=["POST"])
def call_llm():
    try:
        data = request.get_json()
        user_message = data.get("text", "").strip()

        # Recuperar historial
        chat_history = session.get("chat_history", [])

        # Si el último mensaje del usuario no está agregado aún, lo agregamos
        if not chat_history or chat_history[-1]["text"] != user_message:
            chat_history.append({"role": "user", "text": user_message})

        # Generar contexto concatenando toda la conversación
        context_text = "\n".join(
            [f"{msg['role'].upper()}: {msg['text']}" for msg in chat_history]
        )

        respuesta = gemini_call(context_text)

        # Agregar respuesta del modelo al historial
        chat_history.append({"role": "assistant", "text": respuesta})
        session["chat_history"] = chat_history

        #print(f"🤖 Respuesta: {respuesta}")
        return jsonify({
            "response": respuesta,
            "history": chat_history
        })

    except Exception as e:
        print(f"⚠️ Error al llamar al LLM: {e}")
        return jsonify({"error": str(e)})
"""

def generar_recomendaciones(chat_history):
    """Analiza las respuestas y da recomendaciones finales."""
    context_text = "\n".join(
        [f"{msg['role'].upper()}: {msg['text']}" for msg in chat_history]
    )

    prompt = (
        "Basado en la siguiente conversación, identifica el tipo de persona y sus gustos musicales. "
        "Luego, recomienda de forma amigable entre 3 y 5 canciones o artistas que puedan gustarle. "
        "Responde exclusivamente en formato JSON con la siguiente estructura:\n\n"
        "{\n"
        '  "recomendaciones": [\n'
        '    {"artista": "nombre", "cancion": "nombre", "spotify_url": "https://open.spotify.com/artist/..."}\n'
        "  ]\n"
        "}\n\n"
        "No incluyas texto adicional fuera del JSON.\n\n"
        "Asegúrate de que el enlace sea el del perfil del artista, no de una canción.\n\n"
        f"{context_text}"
    )

    raw_response = gemini_reply(prompt)
    print(f"\n🧠 RAW JSON DE LA IA:\n{raw_response}\n")

    # 🧹 Limpieza de formato markdown
    cleaned = raw_response.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)

    print(f"🧩 JSON LIMPIO:\n{cleaned}\n")

    try:
        data = json.loads(cleaned)
        if "recomendaciones" in data:
            print("✅ JSON parseado correctamente.")
            return {"parsed": True, "data": data}
        else:
            raise ValueError("No contiene 'recomendaciones'")
    except Exception as e:
        print(f"⚠️ No se pudo parsear el JSON: {e}")
        return {"parsed": False, "data": raw_response}

@app.route("/llm", methods=["POST"])
def call_llm():
    try:
        data = request.get_json()
        user_message = data.get("text", "").strip()

        chat_history = session.get("chat_history", [])
        question_count = session.get("question_count", 1)

        # Lo ultimo que dijo el user
        if not chat_history or chat_history[-1]["role"] != "user":
            chat_history.append({"role": "user", "text": user_message})

        """
        if question_count >= 5:
            respuesta = generar_recomendaciones(chat_history)
            session["chat_history"].append({"role": "assistant", "text": respuesta})
            session.modified = True
            return jsonify({"response": respuesta, "done": True})"""
        
        if question_count >= 3:
            recomendacion = generar_recomendaciones(chat_history)
            chat_history.append({"role": "assistant", "text": recomendacion})
            session["chat_history"] = chat_history
            session.modified = True

            return jsonify({
                "response": recomendacion["data"],
                "parsed": recomendacion["parsed"],
                "done": True
            })

        # contexto
        context_text = "\n".join(
            [f"{msg['role'].upper()}: {msg['text']}" for msg in chat_history]
        )

        # Instrucción dinámica para el modelo
        prompt = (
            f"{INITIAL_PROMPT}\n\nCONVERSACIÓN HASTA AHORA:\n{context_text}\n\n"
            f"Ahora haz la siguiente pregunta corta número {question_count + 1} según lo que te haya dicho."
        )

        respuesta = gemini_reply(prompt)

        chat_history.append({"role": "assistant", "text": respuesta})
        session["chat_history"] = chat_history
        session["question_count"] = question_count + 1

        #print(f"🤖 Pregunta {question_count + 1}: {respuesta}")
        return jsonify({"response": respuesta, "done": False})

    except Exception as e:
        print(f"⚠️ Error en LLM: {e}")
        return jsonify({"error": str(e)})

"""
def gemini_call(text):
    context = "Estás teniendo una conversación Natalia y esto es lo que llevas de la conversación. Responde teniendo en cuenta lo que has " \
    "respondido :"
    context += text
    print(f"Respuesta: {context}")
    respuesta = gemini_reply(context)
    #print(respuesta)
    return respuesta
"""
    
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
        if audio_recorder:
            audio_recorder.cleanup()
        cv2.destroyAllWindows()
        print("Recursos liberados y archivos temporales eliminados")