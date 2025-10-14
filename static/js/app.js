class EmotionDetectorApp {
    constructor() {
        this.captureBtn = document.getElementById('toggleCapture');
        this.isCapturing = true;
        
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

}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EmotionDetectorApp();
});