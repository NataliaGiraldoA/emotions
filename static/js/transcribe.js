let mediaRecorder;
let audioChunks = [];
const recordBtn = document.getElementById("record-btn");
const chatBox = document.getElementById("chat-box");
const statusText = document.getElementById("status");

// --- Mostrar mensajes en pantalla ---
function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = role === "assistant" ? "msg assistant" : "msg user";
    msg.textContent = text;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- Convertir texto a voz (opcional) ---
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    speechSynthesis.speak(utterance);
}

// --- Mostrar recomendaciones finales ---
function mostrarRecomendaciones(data) {
    chatBox.innerHTML = ""; // Limpiamos el chat

    const titulo = document.createElement("h3");
    titulo.textContent = "🎶 Tus recomendaciones musicales:";
    chatBox.appendChild(titulo);

    data.recomendaciones.forEach(item => {
        const card = document.createElement("div");
        card.classList.add("reco-card");

        // Usamos el logo local de Spotify
        const logoPath = "/static/img/spotify_logo.png";

        card.innerHTML = `
            <img src="${logoPath}" alt="Spotify logo" class="reco-img">
            <div class="reco-info">
                <h3>${item.cancion}</h3>
                <a href="${item.spotify_url}" target="_blank" class="artist-link">${item.artista}</a>
            </div>
        `;

        chatBox.appendChild(card);
    });

    statusText.textContent = "🎧 ¡Recomendaciones generadas!";
    speak("Aquí tienes tus recomendaciones musicales.");
}

// --- Iniciar la conversación automáticamente ---
async function startChat() {
    const response = await fetch("/start_chat");
    const data = await response.json();
    addMessage("assistant", data.response);
    speak(data.response);
}
startChat(); // 👈 inicia automáticamente

// --- Grabación de audio ---
recordBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        recordBtn.textContent = "🎤 Hablar";
        statusText.textContent = "Procesando...";
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
        recordBtn.textContent = "⏹️ Detener";
        statusText.textContent = "Grabando...";
    }
});

// --- Enviar audio al backend ---
async function sendAudio(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "recording.wav");

    const res = await fetch("/transcribe_audio", { method: "POST", body: formData });
    const data = await res.json();

    if (data.text) {
        const userText = data.text.trim();
        addMessage("user", userText);
        await sendToLLM(userText);
    } else {
        statusText.textContent = "Error al transcribir";
    }
}

// --- Enviar texto al modelo ---
async function sendToLLM(userText) {
    const res = await fetch("/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText })
    });

    const data = await res.json();

    if (data.done && data.parsed) {
        // ✅ Mostrar recomendaciones con logo de Spotify y links clickeables
        mostrarRecomendaciones(data.response);
        recordBtn.disabled = true;
    } else if (data.response) {
        addMessage("assistant", data.response);
        speak(data.response);

        if (data.done) {
            statusText.textContent = "✅ Conversación completada.";
            recordBtn.disabled = true;
        } else {
            statusText.textContent = "Listo para responder";
        }
    } else {
        statusText.textContent = "Error al obtener respuesta";
    }
}
