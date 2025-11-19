import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import showdown from "https://esm.run/showdown";

const converter = new showdown.Converter();

// === KONSTANTA AI ===
// Catatan: Mengekspos API Key di sisi klien tidak aman dan dapat menyebabkan penyalahgunaan.
const GEMINI_API_KEY = "AIzaSyAEGw7E0699PjTBJfUkdnOzN9A5GxE2KTI"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Menggunakan model yang Anda sarankan. Jika terjadi error 404, model ini mungkin tidak tersedia untuk API key Anda.
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Menghasilkan respons dari AI berdasarkan pesan pengguna.
 * @param {string} message Pesan dari pengguna.
 * @returns {Promise<string>} Respons dari AI dalam format Markdown.
 */
async function generateAIResponse(message) {
    const systemContext = `
Anda adalah asisten AI untuk sistem monitoring PLTMH bernama Agnivolt.
Tugas Anda adalah membantu pengguna memahami data monitoring, menjelaskan performa sistem, dan memberi insight atau saran maintenance jika perlu.
Gunakan Bahasa Indonesia yang jelas, profesional, dan ramah.

PENTING: Format selalu respons Anda menggunakan MARKDOWN untuk membuat jawaban lebih terstruktur dan mudah dibaca.
Gunakan elemen-elemen berikut:
- **Teks tebal** untuk penekanan.
- *Teks miring* untuk istilah.
- Bullet points (menggunakan tanda hubung '-' atau bintang '*') untuk daftar.
- Heading (menggunakan '##') untuk judul bagian.

Contoh Respons:
## Analisis Performa Harian
Berikut adalah analisis performa sistem PLTMH Anda hari ini:
- **Tegangan**: Terpantau stabil di angka *220V*.
- **Daya Rata-rata**: Sekitar *1500W*, ini menunjukkan performa yang sangat bagus!
`;

    const prompt = `${systemContext}\n\nPertanyaan Pengguna: ${message}`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || "Tidak ada respons dari AI.";
    } catch (error) {
      console.error("AI Response Error:", error);
      if (error.message.includes("404")) {
          return `**Error**: Model AI ('gemini-2.0-flash') tidak ditemukan. Ini berarti model tersebut tidak tersedia untuk API Key Anda.`;
      }
      if (error.message.includes("429")) {
          return `**Error**: Terlalu banyak permintaan ke AI dalam waktu singkat. Kuota Anda mungkin habis. Silakan coba lagi nanti.`;
      }
      return `**Error**: Terjadi kesalahan saat menghubungi AI. Silakan periksa konsol untuk detailnya.`;
    }
}

/**
 * Menambahkan pesan ke dalam kotak chat dan merender Markdown untuk respons AI.
 * @param {('user'|'ai')} sender Pengirim pesan.
 * @param {string} text Isi pesan (bisa berupa Markdown untuk AI).
 * @param {string} avatar Teks atau emoji untuk avatar.
 */
function appendMessage(sender, text, avatar) {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;

    const msgRow = document.createElement("div");
    msgRow.className = `message-row ${sender}`;
    
    const bubbleHtml = sender === 'ai' 
      ? converter.makeHtml(text) 
      : text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Basic escaping for user text

    msgRow.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-bubble">${bubbleHtml}</div>`;
      
    chatMessages.appendChild(msgRow);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Menginisialisasi semua fungsionalitas AI Assistant.
 * @param {string} userAvatarInitial Inisial pengguna untuk ditampilkan sebagai avatar.
 */
export function initAiAssistant(userAvatarInitial) {
    const openAiBtn = document.getElementById("openAiAssistantButton");
    const closeAiBtn = document.getElementById("closeAiAssistantButton");
    const aiOverlay = document.getElementById("aiOverlay");
    const aiBackdrop = document.getElementById("aiBackdrop");
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendAiMessageButton");

    if (!openAiBtn || !closeAiBtn || !aiOverlay || !aiBackdrop || !chatInput || !sendBtn) {
        console.warn("Beberapa elemen UI untuk AI Assistant tidak ditemukan. Fungsi AI tidak akan berjalan.");
        return;
    }

    openAiBtn.addEventListener("click", () => aiOverlay.classList.add("show"));
    closeAiBtn.addEventListener("click", () => aiOverlay.classList.remove("show"));
    aiBackdrop.addEventListener("click", () => aiOverlay.classList.remove("show"));

    chatInput.addEventListener("input", () => sendBtn.disabled = !chatInput.value.trim());

    const handleSendMessage = async () => {
        const msg = chatInput.value.trim();
        if (!msg || sendBtn.disabled) return;

        appendMessage("user", msg, userAvatarInitial);
        chatInput.value = "";
        sendBtn.disabled = true;

        // Menampilkan indikator "mengetik" dari AI
        appendMessage("ai", "...", "🤖");
        const loadingBubble = document.querySelector(".message-row:last-child .message-bubble");
        if(loadingBubble) loadingBubble.classList.add("typing-indicator");


        const response = await generateAIResponse(msg);

        // Menghapus indikator "mengetik" dan menggantinya dengan respons asli
        if(loadingBubble) {
            loadingBubble.classList.remove("typing-indicator");
            loadingBubble.innerHTML = converter.makeHtml(response);
        } else {
            appendMessage("ai", response, "🤖");
        }
        
        sendBtn.disabled = !chatInput.value.trim();
    };

    sendBtn.addEventListener("click", handleSendMessage);

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
    });
}