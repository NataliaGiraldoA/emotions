let mediaRecorder;
let audioChunks = [];
const recordBtn = document.getElementById("record-btn");
const chatBox = document.getElementById("chat-box");
const statusText = document.getElementById("status");
let audioContext = null;
let analyzer = null;
let isAudioAnimating = false;

// --- Mostrar mensajes en pantalla ---
function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = role === "assistant" ? "msg assistant" : "msg user";
    msg.textContent = text;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Remover clase 'empty' cuando hay mensajes
    if (chatBox.classList.contains('empty')) {
        chatBox.classList.remove('empty');
    }
}

// --- Mostrar indicador de escritura ---
function showTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        typingIndicator.style.display = "flex";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// --- Ocultar indicador de escritura ---
function hideTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
        typingIndicator.style.display = "none";
    }
}

// --- Convertir texto a voz (opcional) ---
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    speechSynthesis.speak(utterance);
}

// --- Mostrar recomendaciones finales ---
function mostrarRecomendaciones(data) {
    // Mostrar mensaje en el chat
    addMessage("assistant", "✨ He generado tus recomendaciones musicales personalizadas.");
    
    // Mostrar modal con recomendaciones
    const modal = document.getElementById("recommendations-modal");
    const container = document.getElementById("recommendations-container");
    
    // Limpiar contenedor
    container.innerHTML = "";
    
    // Agregar cada recomendación al modal
    data.recomendaciones.forEach(item => {
        const card = document.createElement("div");
        card.classList.add("reco-card-modal");

        // Usamos el logo local de Spotify
        const logoPath = "/static/img/spotify_logo.png";

        card.innerHTML = `
            <div class="reco-card-modal-image">
                <img src="${logoPath}" alt="Spotify logo">
            </div>
            <div class="reco-card-modal-content">
                <div>
                    <h3>${item.cancion}</h3>
                    <p class="artist-name">${item.artista}</p>
                </div>
                <a href="${item.spotify_url}" target="_blank" class="artist-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    Abrir en Spotify
                </a>
            </div>
        `;

        container.appendChild(card);
    });
    
    // Mostrar modal
    modal.style.display = "flex";
    
    statusText.textContent = "🎧 ¡Recomendaciones generadas!";
    speak("Aquí tienes tus recomendaciones musicales.");
    
    // Event listener para cerrar modal
    const closeBtn = document.getElementById("close-modal");
    const handleClose = () => {
        modal.style.display = "none";
    };
    
    // Remover listeners anteriores y agregar nuevo
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    document.getElementById("close-modal").addEventListener("click", handleClose);
    
    // Cerrar al hacer clic fuera del modal
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            handleClose();
        }
    });
}

// --- Iniciar la conversación automáticamente ---
async function startChat() {
    showTypingIndicator();
    
    const response = await fetch("/start_chat");
    const data = await response.json();
    
    hideTypingIndicator();
    addMessage("assistant", data.response);
    speak(data.response);
}
startChat(); // 👈 inicia automáticamente

// --- Configurar análisis de audio para visualizador ---
function setupAudioAnalysis(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyzer = audioContext.createAnalyser();

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyzer);

    analyzer.fftSize = 256;
    analyzeAudio();
}

function analyzeAudio() {
    if (!analyzer) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateAudio = () => {
        if (!analyzer) return;

        analyzer.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const normalizedLevel = average / 255;

        updateAudioVisualizer(normalizedLevel);

        if (isAudioAnimating) {
            requestAnimationFrame(updateAudio);
        }
    };

    isAudioAnimating = true;
    updateAudio();
}

function updateAudioVisualizer(level) {
    // Actualizar las barras del visualizador
    const bars = document.querySelectorAll('#visualizer .bar');
    
    bars.forEach((bar, index) => {
        // Cada barra tiene su propia altura aleatoria pero influenciada por el nivel de audio
        // Esto crea un efecto más dinámico y fluido
        const randomFactor = Math.random();
        const baseHeight = level * 35; // Altura base según el nivel de audio
        const variation = randomFactor * 15; // Variación aleatoria
        
        // Altura final: combina nivel de audio real con variación aleatoria
        let height = baseHeight + variation;
        
        // Si el nivel de audio es muy bajo, usar altura mínima
        if (level < 0.05) {
            height = 2 + Math.random() * 3;
        } else {
            // Asegurar altura mínima visible cuando hay audio
            height = Math.max(8, height);
        }
        
        bar.style.height = height + 'px';
        bar.classList.remove('inactive');
    });
}

function stopAudioAnalysis() {
    isAudioAnimating = false;
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        analyzer = null;
    }
    
    // Restablecer las barras
    const bars = document.querySelectorAll('#visualizer .bar');
    bars.forEach(bar => {
        bar.style.height = '2px';
        bar.classList.add('inactive');
    });
}

// --- Grabación de audio ---
recordBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        
        // Actualizar botón a estado normal
        recordBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
            <span>Hablar</span>
        `;
        recordBtn.classList.remove("btn-destructive");
        recordBtn.classList.add("btn-primary");
        statusText.textContent = "Procesando...";
        
        // Detener análisis de audio y ocultar visualizador
        stopAudioAnalysis();
        const visualizer = document.getElementById("visualizer");
        if (visualizer) {
            visualizer.style.display = "none";
        }
        
        // Actualizar estado
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) {
            recordingStatus.textContent = "Procesando audio...";
            recordingStatus.classList.remove("recording");
        }
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            await sendAudio(audioBlob);
        };

        mediaRecorder.start();
        
        // Actualizar botón a estado grabando
        recordBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
            <span>Detener</span>
        `;
        recordBtn.classList.remove("btn-primary");
        recordBtn.classList.add("btn-destructive");
        statusText.textContent = "Grabando...";
        
        // Mostrar visualizador y configurar análisis de audio
        const visualizer = document.getElementById("visualizer");
        if (visualizer) {
            visualizer.style.display = "flex";
        }
        
        // Configurar análisis de audio para animación basada en niveles reales
        setupAudioAnalysis(stream);
        
        // Actualizar estado
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) {
            recordingStatus.textContent = "Grabando...";
            recordingStatus.classList.add("recording");
        }
    }
});

// --- Enviar audio al backend ---
async function sendAudio(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "recording.wav");

    showTypingIndicator();
    const res = await fetch("/transcribe_audio", { method: "POST", body: formData });
    const data = await res.json();

    if (data.text) {
        const userText = data.text.trim();
        hideTypingIndicator();
        addMessage("user", userText);
        
        // Actualizar estado después de transcribir
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) {
            recordingStatus.textContent = "Transcripción completada";
        }
        
        await sendToLLM(userText);
    } else {
        hideTypingIndicator();
        statusText.textContent = "Error al transcribir";
        
        // Actualizar estado en caso de error
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) {
            recordingStatus.textContent = "Error al transcribir";
        }
    }
}

// --- Enviar texto al modelo ---
async function sendToLLM(userText) {
    showTypingIndicator();
    
    const res = await fetch("/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText })
    });

    const data = await res.json();
    hideTypingIndicator();

    if (data.done && data.parsed) {
        // ✅ Mostrar recomendaciones con logo de Spotify y links clickeables
        mostrarRecomendaciones(data.response);
        recordBtn.disabled = true;
        
        // Actualizar estado final
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) {
            recordingStatus.textContent = "Conversación completada";
        }
    } else if (data.response) {
        addMessage("assistant", data.response);
        speak(data.response);

        if (data.done) {
            statusText.textContent = "✅ Conversación completada.";
            recordBtn.disabled = true;
            
            const recordingStatus = document.getElementById("recordingStatus");
            if (recordingStatus) {
                recordingStatus.textContent = "Conversación completada";
            }
        } else {
            statusText.textContent = "Listo para responder";
            
            // Restablecer estado para permitir otra grabación
            const recordingStatus = document.getElementById("recordingStatus");
            if (recordingStatus) {
                recordingStatus.textContent = "Listo para grabar";
            }
        }
    } else {
        statusText.textContent = "Error al obtener respuesta";
        
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) {
            recordingStatus.textContent = "Error al obtener respuesta";
        }
    }
}
