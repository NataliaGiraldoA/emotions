let isRecording = false;
let isPaused = false;

function startRecording() {
    isRecording = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('recordingStatus').textContent = 'Grabando...';
    document.getElementById('recordingStatus').classList.add('recording');
    document.getElementById('visualizer').style.display = 'flex';

}

function stopRecording() {
    isRecording = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('recordingStatus').textContent = 'Grabación completada';
    document.getElementById('recordingStatus').classList.remove('recording');
    document.getElementById('visualizer').style.display = 'none';

}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pauseBtn');
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (isPaused) {
        btn.textContent = 'Reanudar Análisis';
        dot.classList.add('offline');
        text.textContent = 'Pausado';
        document.getElementById('emotionOverlay').style.display = 'none';
    } else {
        btn.textContent = 'Pausar Análisis';
        dot.classList.remove('offline');
        text.textContent = 'En vivo';
        document.getElementById('emotionOverlay').style.display = 'block';
    }
}

function showMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

// Simulate emotion detection
setInterval(() => {
    if (!isPaused) {
        const emotions = ['Feliz', 'Triste', 'Neutral', 'Sorprendido', 'Enojado'];
        const emotion = emotions[Math.floor(Math.random() * emotions.length)];
        const confidence = Math.floor(Math.random() * 30) + 70;

        document.getElementById('detectedEmotion').textContent = emotion;
        document.getElementById('emotionConfidence').textContent = confidence + '% confianza';
        document.getElementById('videoEmotion').textContent = emotion;
    }
}, 3000);

// Animate visualizer
setInterval(() => {
    if (isRecording) {
        document.querySelectorAll('.bar').forEach(bar => {
            const height = Math.random() * 30 + 10;
            bar.style.height = height + 'px';
            bar.classList.remove('inactive');
        });
    }
}, 100);