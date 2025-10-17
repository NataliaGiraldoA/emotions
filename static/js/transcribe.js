let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const transcriptionEl = document.getElementById("transcription");

startBtn.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = event => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstart = () => {
    statusEl.textContent = "Grabando...";
    startBtn.disabled = true;
    stopBtn.disabled = false;
  };

  mediaRecorder.onstop = async () => {
    statusEl.textContent = "Procesando audio...";
    const blob = new Blob(audioChunks, { type: "audio/webm" });
    const wavBlob = await convertToWav(blob);

    const formData = new FormData();
    formData.append("audio", wavBlob, "audio.wav");

    const response = await fetch("/transcribe_audio", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (data.text) {
      transcriptionEl.textContent = data.text;
      statusEl.textContent = "Transcripción completada.";
    } else {
      statusEl.textContent = "Error: " + (data.error || "Desconocido");
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
  };

  mediaRecorder.start();
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});

// Convertir WebM a WAV (16-bit PCM)
async function convertToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numChannels * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  let pos = 0;

  function writeString(s) {
    for (let i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i));
  }
  function writeUint16(data) { view.setUint16(pos, data, true); pos += 2; }
  function writeUint32(data) { view.setUint32(pos, data, true); pos += 4; }

  writeString("RIFF");
  writeUint32(length - 8);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16);
  writeUint16(1);
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(sampleRate * numChannels * 2);
  writeUint16(numChannels * 2);
  writeUint16(16);
  writeString("data");
  writeUint32(length - 44);

  const channels = [];
  for (let i = 0; i < numChannels; i++) channels.push(audioBuffer.getChannelData(i));

  let offset = 0;
  while (offset < audioBuffer.length) {
    for (let i = 0; i < numChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
