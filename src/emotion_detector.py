from time import time
from typing import Optional, Tuple, Dict
import cv2
from deepface import DeepFace


class EmotionDetector:
    def __init__(self, webcam_index: int = 0):
        self.webcam_index = webcam_index
        self.cap: Optional[cv2.VideoCapture] = None

        self.colors = {
            'angry': (0, 0, 255),
            'disgust': (128, 0, 128),
            'fear': (255, 165, 0),
            'happy': (0, 255, 0),
            'sad': (255, 0, 0),
            'surprise': (0, 255, 255),
            'neutral': (255, 255, 255)
        }

        self.setup_camera()

    def setup_camera(self) -> None:
        try:
            self.cap = cv2.VideoCapture(self.webcam_index)
            if not self.cap.isOpened():
                raise ValueError("No se puede abrir la cámara")
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            print("Cámara configurada correctamente")
        except Exception as e:
            print(f"Error al configurar la cámara: {e}")
            self.cap = None

    def detect_emotion(self, frame) -> Tuple[str, float, Dict[str, float]]:
        """
            frame: imagen (BGR) proporcionada por OpenCV

        Returns:
            (dominant_emotion, confidence, all_emotions)
        """
        try:
            result = DeepFace.analyze(
                frame,
                actions=['emotion'],
                enforce_detection=False,
                silent=True,
            )

            # DeepFace puede retornar una lista si detecta varias caras
            if isinstance(result, list) and len(result) > 0:
                emotions = result[0].get('emotion', {})
            else:
                emotions = result.get('emotion', {}) if isinstance(result, dict) else {}

            if not emotions:
                return 'neutral', 0.0, {}

            dominant_emotion = max(emotions, key=emotions.get)
            dominant_confidence = float(emotions[dominant_emotion])
            return dominant_emotion, dominant_confidence, emotions
        except Exception as e:
            print(f"Error al detectar emociones: {e}")
            return 'neutral', 0.0, {}

    def draw_results(self, frame, emotion: str, confidence: float, all_emotions: Optional[Dict[str, float]] = None) -> None:
        color = self.colors.get(emotion.lower(), (255, 255, 255))
        # Emoción principal
        cv2.putText(frame, f"Emocion: {emotion}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

        cv2.putText(frame, f"Confianza: {confidence:.2f}", (10, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)


    def run(self) -> None:
        if not self.cap:
            print("Captura de vídeo no inicializada. Saliendo...")
            return

        last_analysis_time = 0.0
        emotion, confidence, all_emotions = 'neutral', 0.0, {}

        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    print("No se puede recibir frame (stream end?). Saliendo ...")
                    break

                frame = cv2.flip(frame, 1)
                current_time = time()
                if current_time - last_analysis_time > 3.0:
                    emotion, confidence, all_emotions = self.detect_emotion(frame)
                    last_analysis_time = current_time

                # Dibujar resultados sobre el mismo frame
                self.draw_results(frame, emotion, confidence, all_emotions)

                cv2.imshow('Emotion Detector', frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break

        except KeyboardInterrupt:
            print("Detención por teclado")
        except Exception as e:
            print("Error durante la ejecución: ", e)
        finally:
            if self.cap:
                self.cap.release()
            cv2.destroyAllWindows()
            print("Recursos liberados, programa terminado.")


def main() -> None:
    detector = EmotionDetector(webcam_index=0)
    detector.run()


if __name__ == "__main__":
    main()
        
        