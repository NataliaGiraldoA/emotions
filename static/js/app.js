class EmotionDetectorApp {
    constructor() {
        this.captureBtn = document.getElementById('toggleCapture');
        this.isCapturing = true;
        
        // Audio recorder elements
        this.startRecordingBtn = document.getElementById('startRecording');
        this.stopRecordingBtn = document.getElementById('stopRecording');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.recordingDuration = document.getElementById('recordingDuration');
        
        this.isRecording = false;
        this.recordingStartTime = null;
        this.statusUpdateInterval = null;
        
        if (!this.captureBtn) {
            console.error('Botón de captura no encontrado');
            return;
        }
        
        this.setupEventListeners();
        this.startEmotionPolling();
    }

    setupEventListeners() {
        this.captureBtn.addEventListener('click', () => {
            this.toggleCapture();
        });

        // Audio recorder event listeners
        if (this.startRecordingBtn) {
            this.startRecordingBtn.addEventListener('click', () => {
                this.startRecording();
            });
        }

        if (this.stopRecordingBtn) {
            this.stopRecordingBtn.addEventListener('click', () => {
                this.stopRecording();
            });
        }
    }

    async toggleCapture() {
        this.isCapturing = !this.isCapturing;
        
        try {
            const response = await fetch('/toggle_capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ capturing: this.isCapturing })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.updateCaptureButton();
                
            }
        } catch (error) {
            console.error('Error toggling capture:', error);
        }
    }

    updateCaptureButton() {
        if (this.isCapturing) {
            this.captureBtn.textContent = 'Pausar Captura';
            this.captureBtn.classList.remove('paused');
        } else {
            this.captureBtn.textContent = 'Reanudar Captura';
            this.captureBtn.classList.add('paused');
        }
    }

    async startRecording() {
        try {
            const response = await fetch('/audio/start_recording', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.isRecording = true;
                    this.recordingStartTime = Date.now();
                    this.updateRecordingUI();
                    this.startStatusUpdates();
                    console.log('Grabación iniciada:', result.message);
                } else {
                    console.error('Error al iniciar grabación:', result.message);
                    this.showMessage('Error al iniciar grabación: ' + result.message, 'error');
                }
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showMessage('Error de conexión al iniciar grabación', 'error');
        }
    }

    async stopRecording() {
        try {
            const response = await fetch('/audio/stop_recording', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.isRecording = false;
                    this.stopStatusUpdates();
                    this.updateRecordingUI();
                    console.log('Grabación detenida:', result.message);
                    this.showMessage('Grabación completada', 'success');
                } else {
                    console.error('Error al detener grabación:', result.message);
                    this.showMessage('Error al detener grabación: ' + result.message, 'error');
                }
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showMessage('Error de conexión al detener grabación', 'error');
        }
    }

    updateRecordingUI() {
        if (this.isRecording) {
            this.startRecordingBtn.disabled = true;
            this.startRecordingBtn.classList.add('recording');
            this.stopRecordingBtn.disabled = false;
            this.recordingStatus.textContent = 'Grabando...';
            this.recordingStatus.classList.add('recording');
        } else {
            this.startRecordingBtn.disabled = false;
            this.startRecordingBtn.classList.remove('recording');
            this.stopRecordingBtn.disabled = true;
            this.recordingStatus.textContent = 'Listo para grabar';
            this.recordingStatus.classList.remove('recording');
        }
    }

    startStatusUpdates() {
        this.statusUpdateInterval = setInterval(() => {
            if (this.isRecording && this.recordingStartTime) {
                const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                this.recordingDuration.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopStatusUpdates() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
    }


}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EmotionDetectorApp();
});