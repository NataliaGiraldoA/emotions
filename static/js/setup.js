class DeviceSetup {
    constructor() {
        this.currentStream = null;
        this.audioContext = null;
        this.analyzer = null;
        this.isAudioAnimating = false;
        this.cameraAllowed = false;
        this.microphoneAllowed = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Try to check existing permissions first
        await this.checkInitialPermissions(); 
        
        // If no permissions detected, request them
        if (!this.cameraAllowed && !this.microphoneAllowed) {
            console.log('No existing permissions found, requesting...');
            await this.requestPermissions(); 
        } else {
            console.log('Existing permissions found:', {
                camera: this.cameraAllowed,
                microphone: this.microphoneAllowed
            });
        }
        
        // Always populate devices at the end
        await this.populateDevices();
    }

    setupEventListeners() {
        const testCameraBtn = document.getElementById('test-camera');
        const testMicBtn = document.getElementById('test-mic');
        const cameraSelect = document.getElementById('camera-select');
        const micSelect = document.getElementById('mic-select');
        const continueBtn = document.getElementById('continue-app');
        const setupLaterBtn = document.getElementById('setup-later');

        if (testCameraBtn) {
            testCameraBtn.addEventListener('click', () => this.testCamera());
        }
        if (testMicBtn) {
            testMicBtn.addEventListener('click', () => this.testMicrophone());
        }
        if (cameraSelect) {
            cameraSelect.addEventListener('change', () => this.switchCamera());
        }
        if (micSelect) {
            micSelect.addEventListener('change', () => this.switchMicrophone());
        }
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.continueToApp());
        }
        if (setupLaterBtn) {
            setupLaterBtn.addEventListener('click', () => this.setupLater());
        }
    }

    async requestPermissions() {
        try {
            // Try to request both camera and microphone
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Keep stream briefly to maintain permissions, then stop
            setTimeout(() => {
                stream.getTracks().forEach(track => track.stop());
            }, 100);

            this.cameraAllowed = true;
            this.microphoneAllowed = true;
            this.updatePermissionStatus();

            // Hide permission alert
            const alert = document.getElementById('permission-denied-alert');
            if (alert) {
                alert.classList.add('hidden');
            }

        } catch (error) {
            console.warn('Both permissions denied, trying individually:', error);

            // Try camera only
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setTimeout(() => {
                    videoStream.getTracks().forEach(track => track.stop());
                }, 100);
                this.cameraAllowed = true;
                console.log('Camera permission granted');
            } catch (videoError) {
                console.warn('Camera permission denied:', videoError);
                this.cameraAllowed = false;
            }

            // Try microphone only
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setTimeout(() => {
                    audioStream.getTracks().forEach(track => track.stop());
                }, 100);
                this.microphoneAllowed = true;
                console.log('Microphone permission granted');
            } catch (audioError) {
                console.warn('Microphone permission denied:', audioError);
                this.microphoneAllowed = false;
            }

            this.updatePermissionStatus();

            // Show permission denied alert if both failed
            if (!this.cameraAllowed && !this.microphoneAllowed) {
                this.handlePermissionDenied();
            } else {
                // Hide alert if at least one permission was granted
                const alert = document.getElementById('permission-denied-alert');
                if (alert) {
                    alert.classList.add('hidden');
                }
            }
        }
    }

    handlePermissionDenied() {
        const alert = document.getElementById('permission-denied-alert');
        if (alert) {
            alert.classList.remove('hidden');
        }
        this.updatePermissionStatus();
    }

    async checkInitialPermissions() {
        console.log('Checking initial permissions...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('MediaDevices API not supported');
            this.handlePermissionDenied();
            return;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log('Devices found:', devices.map(d => ({ kind: d.kind, label: d.label, hasLabel: !!d.label })));
            
            // If we can see device labels, permissions were already granted
            const hasLabels = devices.some(device => device.label);
            console.log('Devices have labels (permissions granted):', hasLabels);
            
            if (hasLabels) {
                // Check specifically for camera and microphone devices
                const hasCamera = devices.some(device => device.kind === 'videoinput' && device.label);
                const hasMicrophone = devices.some(device => device.kind === 'audioinput' && device.label);
                
                this.cameraAllowed = hasCamera;
                this.microphoneAllowed = hasMicrophone;
                
                console.log('Initial permissions set:', {
                    camera: this.cameraAllowed,
                    microphone: this.microphoneAllowed
                });
                
                this.updatePermissionStatus();

                // Hide permission alert if it exists
                const alert = document.getElementById('permission-denied-alert');
                if (alert) {
                    alert.classList.add('hidden');
                }
            } else {
                console.log('No device labels found, permissions likely not granted');
                this.cameraAllowed = false;
                this.microphoneAllowed = false;
            }
        } catch (error) {
            console.warn('Error checking permissions:', error);
        }
    }

    updatePermissionStatus() {
        console.log('Updating permission status:', {
            camera: this.cameraAllowed,
            microphone: this.microphoneAllowed
        });

        // Update camera status
        const cameraStatus = document.getElementById('camera-status');
        const cameraCheck = document.getElementById('camera-check');

        if (cameraStatus) {
            if (this.cameraAllowed) {
                cameraStatus.textContent = 'Cámara lista';
                cameraStatus.className = 'device-status connected';
                if (cameraCheck) cameraCheck.classList.remove('hidden');
            } else {
                cameraStatus.textContent = 'Permiso requerido';
                cameraStatus.className = 'device-status error';
                if (cameraCheck) cameraCheck.classList.add('hidden');
            }
        }

        // Update microphone status
        const micStatus = document.getElementById('mic-status');
        const micCheck = document.getElementById('mic-check');

        if (micStatus) {
            if (this.microphoneAllowed) {
                micStatus.textContent = 'Micrófono listo';
                micStatus.className = 'device-status connected';
                if (micCheck) micCheck.classList.remove('hidden');
            } else {
                micStatus.textContent = 'Permiso requerido';
                micStatus.className = 'device-status error';
                if (micCheck) micCheck.classList.add('hidden');
            }
        }

        // Update continue button state
        this.updateContinueButton();
    }

    updateContinueButton() {
        const continueBtn = document.getElementById('continue-app');
        if (!continueBtn) {
            console.warn('Continue button not found');
            return;
        }

        const canContinue = this.cameraAllowed || this.microphoneAllowed;
        console.log('Updating continue button:', {
            canContinue,
            camera: this.cameraAllowed,
            microphone: this.microphoneAllowed
        });

        if (canContinue) {
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';

            if (this.cameraAllowed && this.microphoneAllowed) {
                continueBtn.innerHTML = '<span>Continuar a la aplicación</span><i data-lucide="arrow-right"></i>';
            } else {
                continueBtn.innerHTML = '<span>Continuar (Acceso limitado)</span><i data-lucide="arrow-right"></i>';
            }
        } else {
            continueBtn.disabled = true;
            continueBtn.style.opacity = '0.5';
            continueBtn.innerHTML = '<span>Permite acceso a dispositivos</span><i data-lucide="alert-circle"></i>';
        }

        // Refresh Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async populateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameraSelect = document.getElementById('camera-select');
            const micSelect = document.getElementById('mic-select');
            const testCameraBtn = document.getElementById('test-camera');
            const testMicBtn = document.getElementById('test-mic');

            if (cameraSelect) {
                const cameras = devices.filter(device => device.kind === 'videoinput');
                cameraSelect.innerHTML = '<option value="">Seleccionar cámara...</option>';
                cameras.forEach(camera => {
                    const option = document.createElement('option');
                    option.value = camera.deviceId;
                    option.textContent = camera.label || `Cámara ${cameraSelect.children.length}`;
                    cameraSelect.appendChild(option);
                });

                // Enable/disable camera controls based on permission and devices
                cameraSelect.disabled = !this.cameraAllowed || cameras.length === 0;
                if (testCameraBtn) {
                    testCameraBtn.disabled = !this.cameraAllowed || cameras.length === 0;
                    if (!this.cameraAllowed) {
                        testCameraBtn.innerHTML = '<i data-lucide="camera-off"></i> Permiso requerido';
                    } else if (cameras.length === 0) {
                        testCameraBtn.innerHTML = '<i data-lucide="camera-off"></i> No hay cámaras';
                    } else {
                        testCameraBtn.innerHTML = '<i data-lucide="camera"></i> Probar cámara';
                        // Auto-select first device
                        if (cameras.length > 0) {
                            cameraSelect.selectedIndex = 1;
                        }
                    }
                }

                // Update camera status based on results
                const cameraStatus = document.getElementById('camera-status');
                if (cameraStatus) {
                    if (!this.cameraAllowed) {
                        cameraStatus.textContent = 'Permiso requerido';
                        cameraStatus.className = 'device-status error';
                    } else if (cameras.length === 0) {
                        cameraStatus.textContent = 'No hay cámaras disponibles';
                        cameraStatus.className = 'device-status error';
                    } else {
                        cameraStatus.textContent = 'Cámara lista';
                        cameraStatus.className = 'device-status connected';
                    }
                }
            }

            if (micSelect) {
                const microphones = devices.filter(device => device.kind === 'audioinput');
                micSelect.innerHTML = '<option value="">Seleccionar micrófono...</option>';
                microphones.forEach(mic => {
                    const option = document.createElement('option');
                    option.value = mic.deviceId;
                    option.textContent = mic.label || `Micrófono ${micSelect.children.length}`;
                    micSelect.appendChild(option);
                });

                // Enable/disable microphone controls based on permission and devices
                micSelect.disabled = !this.microphoneAllowed || microphones.length === 0;
                if (testMicBtn) {
                    testMicBtn.disabled = !this.microphoneAllowed || microphones.length === 0;
                    if (!this.microphoneAllowed) {
                        testMicBtn.innerHTML = '<i data-lucide="mic-off"></i> Permiso requerido';
                    } else if (microphones.length === 0) {
                        testMicBtn.innerHTML = '<i data-lucide="mic-off"></i> No hay micrófonos';
                    } else {
                        testMicBtn.innerHTML = '<i data-lucide="mic"></i> Probar micrófono';
                        // Auto-select first device
                        if (microphones.length > 0) {
                            micSelect.selectedIndex = 1;
                        }
                    }
                }

                // Update microphone status based on results
                const micStatus = document.getElementById('mic-status');
                if (micStatus) {
                    if (!this.microphoneAllowed) {
                        micStatus.textContent = 'Permiso requerido';
                        micStatus.className = 'device-status error';
                    } else if (microphones.length === 0) {
                        micStatus.textContent = 'No hay micrófonos disponibles';
                        micStatus.className = 'device-status error';
                    } else {
                        micStatus.textContent = 'Micrófono listo';
                        micStatus.className = 'device-status connected';
                    }
                }
            }

            // Refresh icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }

    async testCamera() {
        const video = document.getElementById('camera-preview');
        const placeholder = document.getElementById('camera-placeholder');
        const cameraSelect = document.getElementById('camera-select');
        const testBtn = document.getElementById('test-camera');
        
        console.log('Testing camera - State:', {
            cameraAllowed: this.cameraAllowed,
            hasVideo: !!video,
            selectedDevice: cameraSelect ? cameraSelect.value : 'no select element'
        });
        
        if (!video) {
            console.error('Camera test failed: no video element');
            return;
        }
        
        if (!this.cameraAllowed) {
            console.error('Camera test failed: permission denied');
            // Try to request permission again
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                this.cameraAllowed = true;
                this.updatePermissionStatus();
                console.log('Camera permission granted after retry');
            } catch (error) {
                console.error('Camera permission still denied:', error);
                return;
            }
        }        // If no device is selected, try to select the first available one
        if (!cameraSelect.value && cameraSelect.options.length > 1) {
            cameraSelect.selectedIndex = 1; // Select first actual device (skip placeholder)
        }

        if (!cameraSelect.value) {
            console.warn('Camera test failed: no device selected');
            return;
        }

        try {
            if (this.currentStream) {
                this.stopCurrentStream();
            }

            // Update button state
            if (testBtn) {
                testBtn.disabled = true;
                testBtn.innerHTML = '<i data-lucide="loader"></i> Conectando...';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }

            const constraints = {
                video: {
                    deviceId: cameraSelect.value ? { ideal: cameraSelect.value } : undefined,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            
            console.log('Using constraints:', constraints);

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentStream = stream;

            video.srcObject = stream;
            video.play();

            if (placeholder) placeholder.classList.add('hidden');
            video.classList.remove('hidden');

            // Update camera status
            const cameraStatus = document.getElementById('camera-status');
            if (cameraStatus) {
                cameraStatus.textContent = 'Cámara activa';
                cameraStatus.className = 'device-status connected';
            }

        } catch (error) {
            console.error('Error accessing camera:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                constraint: error.constraint
            });

            // Try with basic constraints if exact device fails
            if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
                try {
                    console.log('Trying with basic constraints...');
                    const basicConstraints = { video: true };
                    const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
                    this.currentStream = stream;
                    
                    video.srcObject = stream;
                    video.play();
                    
                    if (placeholder) placeholder.classList.add('hidden');
                    video.classList.remove('hidden');
                    
                    const cameraStatus = document.getElementById('camera-status');
                    if (cameraStatus) {
                        cameraStatus.textContent = 'Cámara activa (dispositivo por defecto)';
                        cameraStatus.className = 'device-status connected';
                    }
                    return; // Exit successfully
                } catch (retryError) {
                    console.error('Basic constraints also failed:', retryError);
                }
            }

            // Update camera status with error
            const cameraStatus = document.getElementById('camera-status');
            if (cameraStatus) {
                let errorMessage = 'Error al acceder a la cámara';
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Permiso denegado';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'Cámara no encontrada';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Cámara en uso por otra aplicación';
                }
                cameraStatus.textContent = errorMessage;
                cameraStatus.className = 'device-status error';
            }
        } finally {
            // Reset button state
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = '<i data-lucide="video"></i> Probar cámara';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
    }

    async testMicrophone() {
        const micSelect = document.getElementById('mic-select');
        const testBtn = document.getElementById('test-mic');

        if (!this.microphoneAllowed) {
            console.warn('Microphone test failed: permission denied');
            return;
        }

        // If no device is selected, try to select the first available one
        if (!micSelect.value && micSelect.options.length > 1) {
            micSelect.selectedIndex = 1; // Select first actual device (skip placeholder)
        }

        if (!micSelect.value) {
            console.warn('Microphone test failed: no device selected');
            return;
        }

        try {
            if (this.currentStream) {
                this.stopCurrentStream();
            }

            // Update button state
            if (testBtn) {
                testBtn.disabled = true;
                testBtn.innerHTML = '<i data-lucide="loader"></i> Conectando...';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }

            const constraints = {
                audio: {
                    deviceId: micSelect.value ? { ideal: micSelect.value } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            };
            
            console.log('Using microphone constraints:', constraints);

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentStream = stream;

            this.setupAudioAnalysis(stream);

            // Update microphone status
            const micStatus = document.getElementById('mic-status');
            if (micStatus) {
                micStatus.textContent = 'Micrófono activo - Habla para probar';
                micStatus.className = 'device-status connected';
            }

        } catch (error) {
            console.error('Error accessing microphone:', error);

            // Update microphone status
            const micStatus = document.getElementById('mic-status');
            if (micStatus) {
                micStatus.textContent = 'Error al acceder al micrófono';
                micStatus.className = 'device-status error';
            }
        } finally {
            // Reset button state
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = '<i data-lucide="mic"></i> Probar micrófono';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        }
    }

    setupAudioAnalysis(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyzer = this.audioContext.createAnalyser();

        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyzer);

        this.analyzer.fftSize = 256;
        this.analyzeAudio();
    }

    analyzeAudio() {
        if (!this.analyzer) return;

        const bufferLength = this.analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateAudio = () => {
            if (!this.analyzer) return;

            this.analyzer.getByteFrequencyData(dataArray);

            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const normalizedLevel = average / 255;

            this.updateAudioVisualizer(normalizedLevel);

            if (this.isAudioAnimating) {
                requestAnimationFrame(updateAudio);
            }
        };

        this.isAudioAnimating = true;
        updateAudio();
    }

    updateAudioVisualizer(level) {
        // Update microphone icon animation
        const micIconLarge = document.getElementById('mic-icon-large');
        if (micIconLarge) {
            if (level > 0.1) {
                micIconLarge.classList.add('active');
            } else {
                micIconLarge.classList.remove('active');
            }
        }

        // Update audio level bar
        const audioLevelFill = document.getElementById('audio-level-fill');
        if (audioLevelFill) {
            audioLevelFill.style.width = `${level * 100}%`;
        }

        // Update audio level value
        const audioLevelValue = document.getElementById('audio-level-percent');
        if (audioLevelValue) {
            audioLevelValue.textContent = `${Math.round(level * 100)}%`;
        }

        // Update audio bars
        const bars = document.querySelectorAll('.audio-bars-container .audio-bar');
        const activeCount = Math.floor(level * bars.length);

        bars.forEach((bar, index) => {
            if (index < activeCount) {
                bar.classList.add('active', 'animated');
            } else {
                bar.classList.remove('active', 'animated');
            }
        });

        // Show audio level container when mic is active
        const audioLevelContainer = document.getElementById('audio-visualizer');
        const micPlaceholder = document.getElementById('mic-placeholder');

        if (this.isAudioAnimating) {
            if (audioLevelContainer) audioLevelContainer.classList.remove('hidden');
            if (micPlaceholder) micPlaceholder.classList.add('hidden');
        }
    }

    async switchCamera() {
        if (this.currentStream && this.currentStream.getVideoTracks().length > 0) {
            await this.testCamera();
        }
    }

    async switchMicrophone() {
        if (this.currentStream && this.currentStream.getAudioTracks().length > 0) {
            await this.testMicrophone();
        }
    }

    stopCurrentStream() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.analyzer = null;
            this.isAudioAnimating = false;
        }

        // Reset video
        const video = document.getElementById('camera-preview');
        const placeholder = document.getElementById('camera-placeholder');
        if (video) {
            video.srcObject = null;
            video.classList.add('hidden');
        }
        if (placeholder) {
            placeholder.classList.remove('hidden');
        }

        // Reset audio visualizer
        const micIconLarge = document.getElementById('mic-icon-large');
        const audioLevelFill = document.getElementById('audio-level-fill');
        const audioLevelContainer = document.getElementById('audio-visualizer');
        const micPlaceholder = document.getElementById('mic-placeholder');
        const bars = document.querySelectorAll('.audio-bars-container .audio-bar');

        if (micIconLarge) micIconLarge.classList.remove('active');
        if (audioLevelFill) audioLevelFill.style.width = '0%';
        if (audioLevelContainer) audioLevelContainer.classList.add('hidden');
        if (micPlaceholder) micPlaceholder.classList.remove('hidden');

        bars.forEach(bar => {
            bar.classList.remove('active', 'animated');
        });
    }

    continueToApp() {
        // Store device preferences in localStorage
        const cameraSelect = document.getElementById('camera-select');
        const micSelect = document.getElementById('mic-select');

        if (cameraSelect && cameraSelect.value) {
            localStorage.setItem('preferredCamera', cameraSelect.value);
        }
        if (micSelect && micSelect.value) {
            localStorage.setItem('preferredMicrophone', micSelect.value);
        }

        // Clean up streams before navigating
        this.stopCurrentStream();

        // Navigate to main application
        window.location.href = '/app';
    }

    setupLater() {
        // Clean up any active streams
        this.stopCurrentStream();

        // Navigate directly to app without saving preferences
        window.location.href = '/app';
    }
}

// Helper function to handle continue button
function continueToApp() {
    if (!deviceSetup.cameraAllowed && !deviceSetup.microphoneAllowed) {
        alert('Please allow at least camera or microphone access to continue.');
        return false;
    }
    return true;
}

// Initialize device setup when page loads
let deviceSetup;
document.addEventListener('DOMContentLoaded', () => {
    deviceSetup = new DeviceSetup();
});

// Cleanup when leaving page
window.addEventListener('beforeunload', () => {
    if (deviceSetup) {
        deviceSetup.stopCurrentStream();
    }
});