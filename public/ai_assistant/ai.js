import showdown from "https://esm.run/showdown";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { db } from "../auth/firebase-init.js";

const converter = new showdown.Converter();

// Global variables untuk menyimpan data realtime
let currentData = {
  voltage: 0,
  current: 0,
  power: 0,
  rpm: 0,
  totalEnergy: 0
};

// Tarif listrik PLN per kWh (dalam Rupiah)
const TARIF_PER_KWH = 1444.70;

/**
 * Fungsi untuk membuka/menutup chat - FIXED untuk main.html
 */
function openChat() {
  const overlay = document.getElementById('aiOverlay');
  const sidebar = overlay?.querySelector('.ai-sidebar');
  const backdrop = document.getElementById('aiBackdrop');
  
  console.log("Opening AI Assistant...", { overlay, sidebar, backdrop });
  
  if (overlay) {
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  }
  if (sidebar) {
    sidebar.classList.add('show');
  }
  if (backdrop) {
    backdrop.classList.add('show');
  }
}

function closeChat() {
  const overlay = document.getElementById('aiOverlay');
  const sidebar = overlay?.querySelector('.ai-sidebar');
  const backdrop = document.getElementById('aiBackdrop');
  
  console.log("Closing AI Assistant...", { overlay, sidebar, backdrop });
  
  if (overlay) {
    overlay.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
  }
  if (sidebar) {
    sidebar.classList.remove('show');
  }
  if (backdrop) {
    backdrop.classList.remove('show');
  }
}

/**
 * Mengambil data realtime dari Firebase
 */
function listenToRealtimeData() {
  const pltmhRef = ref(db, "PLTMH");
  
  onValue(pltmhRef, (snapshot) => {
    if (!snapshot.exists()) {
      console.warn("Data PLTMH tidak ditemukan di Firebase");
      return;
    }
    const data = snapshot.val();

    currentData = {
      voltage: parseFloat(data.Tegangan_V || 0),
      current: parseFloat(data.Arus_mA || 0),
      power: parseFloat(data.Daya_mW || 0),
      rpm: parseFloat(data.RPM_Turbin || 0),
      totalEnergy: parseFloat(data.Total_Energi_mWh || 0)
    };
    
    console.log("Data PLTMH updated:", currentData);
  }, (error) => {
    console.error("Error listening to Firebase:", error);
  });
}

/**
 * Menghitung prediksi penggunaan dan biaya bulanan
 */
function calculateMonthlyPrediction() {
  const powerInWatt = currentData.power / 1000;
  const hoursPerDay = 8;
  const daysPerMonth = 30;
  const dailyConsumption = powerInWatt * hoursPerDay;
  const monthlyConsumption = (dailyConsumption * daysPerMonth) / 1000;
  const monthlyCost = monthlyConsumption * TARIF_PER_KWH;
  
  return {
    dailyWh: dailyConsumption.toFixed(2),
    monthlyKWh: monthlyConsumption.toFixed(2),
    monthlyCost: monthlyCost.toFixed(0),
    currentPowerW: powerInWatt.toFixed(2)
  };
}

/**
 * Memberikan rekomendasi berdasarkan penggunaan daya
 */
function generateRecommendation() {
  const powerInWatt = currentData.power / 1000;
  
  let recommendation = "";
  let status = "good";
  let icon = "checkmark-circle";
  
  if (powerInWatt < 50) {
    recommendation = "Penggunaan daya sangat efisien! Teruskan pola konsumsi ini.";
    status = "good";
    icon = "checkmark-circle";
  } else if (powerInWatt >= 50 && powerInWatt < 150) {
    recommendation = "Penggunaan daya dalam batas wajar. Pertimbangkan untuk mematikan perangkat yang tidak terpakai.";
    status = "moderate";
    icon = "warning";
  } else {
    recommendation = "⚠️ Penggunaan daya tinggi terdeteksi! Segera kurangi beban untuk menghemat energi dan biaya.";
    status = "high";
    icon = "alert-circle";
  }
  
  return { recommendation, status, icon };
}

/**
 * Toggle fungsi untuk membuka/menutup analysis card
 */
function toggleAnalysisCard(cardId) {
  const content = document.getElementById(`${cardId}-content`);
  const toggle = document.getElementById(`${cardId}-toggle`);
  
  if (content && toggle) {
    content.classList.toggle('open');
    toggle.classList.toggle('open');
  }
}

/**
 * Membuat HTML untuk kartu analisis dengan collapse functionality
 */
function createAnalysisCard(type) {
  const prediction = calculateMonthlyPrediction();
  const recommendation = generateRecommendation();
  const cardId = `analysis-${type}-${Date.now()}`;
  
  if (type === "recommendation") {
    return `
      <div class="analysis-card">
        <div class="analysis-header" onclick="toggleAnalysisCard('${cardId}')">
          <div class="analysis-header-left">
            <ion-icon name="${recommendation.icon}"></ion-icon>
            <h4>Rekomendasi Hemat Energi</h4>
          </div>
          <ion-icon name="chevron-down" class="analysis-toggle" id="${cardId}-toggle"></ion-icon>
        </div>
        <div class="analysis-content" id="${cardId}-content">
          <div class="analysis-item">
            <span class="analysis-label">Daya Saat Ini:</span>
            <span class="analysis-value ${recommendation.status === 'good' ? 'success' : recommendation.status === 'moderate' ? 'warning' : 'danger'}">
              ${prediction.currentPowerW} W
            </span>
          </div>
          <div class="recommendation-badge ${recommendation.status}">
            <ion-icon name="${recommendation.icon}"></ion-icon>
            ${recommendation.status === 'good' ? 'Sangat Efisien' : recommendation.status === 'moderate' ? 'Cukup Efisien' : 'Perlu Hemat'}
          </div>
          <p style="margin-top: 10px; font-size: 0.9rem; line-height: 1.5; color: var(--text-secondary);">
            ${recommendation.recommendation}
          </p>
        </div>
      </div>
    `;
  } else if (type === "prediction") {
    return `
      <div class="analysis-card">
        <div class="analysis-header" onclick="toggleAnalysisCard('${cardId}')">
          <div class="analysis-header-left">
            <ion-icon name="trending-up"></ion-icon>
            <h4>Prediksi Penggunaan Bulanan</h4>
          </div>
          <ion-icon name="chevron-down" class="analysis-toggle" id="${cardId}-toggle"></ion-icon>
        </div>
        <div class="analysis-content" id="${cardId}-content">
          <div class="analysis-item">
            <span class="analysis-label">Konsumsi Harian:</span>
            <span class="analysis-value">${prediction.dailyWh} Wh</span>
          </div>
          <div class="analysis-item">
            <span class="analysis-label">Konsumsi Bulanan:</span>
            <span class="analysis-value">${prediction.monthlyKWh} kWh</span>
          </div>
          <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-light); font-style: italic;">
            *Berdasarkan penggunaan 8 jam/hari selama 30 hari
          </p>
        </div>
      </div>
    `;
  } else if (type === "cost") {
    return `
      <div class="analysis-card">
        <div class="analysis-header" onclick="toggleAnalysisCard('${cardId}')">
          <div class="analysis-header-left">
            <ion-icon name="cash"></ion-icon>
            <h4>Estimasi Biaya Listrik</h4>
          </div>
          <ion-icon name="chevron-down" class="analysis-toggle" id="${cardId}-toggle"></ion-icon>
        </div>
        <div class="analysis-content" id="${cardId}-content">
          <div class="analysis-item">
            <span class="analysis-label">Tarif per kWh:</span>
            <span class="analysis-value">Rp ${TARIF_PER_KWH.toLocaleString('id-ID')}</span>
          </div>
          <div class="analysis-item">
            <span class="analysis-label">Estimasi Biaya Bulanan:</span>
            <span class="analysis-value ${parseFloat(prediction.monthlyCost) > 200000 ? 'danger' : parseFloat(prediction.monthlyCost) > 100000 ? 'warning' : 'success'}">
              Rp ${parseFloat(prediction.monthlyCost).toLocaleString('id-ID')}
            </span>
          </div>
          <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-light); font-style: italic;">
            *Tarif PLN untuk rumah tangga 900VA (R1/900VA)
          </p>
        </div>
      </div>
    `;
  }
  
  return "";
}

/**
 * Menghasilkan respons dari AI berdasarkan pesan pengguna
 */
async function generateAIResponse(message) {
  const systemContext = `
Anda adalah asisten AI bernama **Hydrovoltiger**, dirancang untuk membantu pemantauan dan analisis. 
Anda memonitor parameter teknis seperti:
- **mA (arus)**
- **mW (daya output)**
- **RPM (kecepatan turbin)**
- **Volt (tegangan)**
- **mWh (total energi yang dihasilkan)**

Data saat ini:
- Tegangan: ${currentData.voltage.toFixed(2)} V
- Arus: ${currentData.current.toFixed(2)} mA
- Daya: ${currentData.power.toFixed(2)} mW
- RPM: ${currentData.rpm.toFixed(2)}
- Total Energi: ${currentData.totalEnergy.toFixed(4)} mWh

Tugas utama Anda:
- Memberikan penjelasan teknis yang mudah dipahami.
- Memberikan analisis performa kondisi real-time.
- Memberikan saran preventif atau perawatan jika diperlukan (maintenance insight).
- Menjawab pertanyaan pengguna dengan informasi yang akurat, ramah, dan profesional.

Format jawaban **HARUS menggunakan MARKDOWN** agar rapi dan mudah dibaca.

Gunakan elemen berikut:
- **Bold** untuk highlight.
- *Italic* untuk istilah teknis.
- Bullet list untuk informasi penting.
- Heading (##) untuk judul analisis atau penjelasan.

Contoh Format Output:
## Status Sistem Saat Ini
- **Arus:** 124 mA → *Stabil*
- **Tegangan:** 220V → *Di dalam rentang aman*
- **RPM Turbin:** 780 RPM → *Sedikit rendah, periksa aliran air*

### Rekomendasi
- Bersihkan saringan air untuk meningkatkan RPM.
- Pantau tegangan dalam 10 menit ke depan.

PENTING: Jangan pernah gunakan format card atau kotak dalam respons Anda. Berikan jawaban dalam format text biasa dengan markdown.

Jika pengguna mengirim pesan yang tidak terkait monitoring, jawab dengan ramah namun tetap relevan dengan konteks sistem Anda.
`; 

  const prompt = `${systemContext}\n\nPertanyaan Pengguna: ${message}`;

  try {
    const response = await fetch("https://hydrovoltiger-production.up.railway.app/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      return `**Error**: Gagal menghubungi backend AI (status ${response.status}).`;
    }

    const data = await response.json();
    return data.text || "Tidak ada respons dari AI.";
  } catch (error) {
    console.error("AI Response Error:", error);
    return `**Error**: Terjadi kesalahan jaringan saat menghubungi Backend AI.`;
  }
}

/**
 * Menambahkan pesan ke dalam kotak chat
 */
function appendMessage(sender, text, avatar, includeAnalysis = false, analysisType = null) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) {
    console.error("Element chatMessages tidak ditemukan");
    return;
  }

  const msgRow = document.createElement("div");
  msgRow.className = `message-row ${sender}`;
  
  const bubbleHtml = sender === 'ai' 
    ? converter.makeHtml(text) 
    : text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const analysisHtml = includeAnalysis && analysisType ? createAnalysisCard(analysisType) : '';

  msgRow.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-bubble">${bubbleHtml}${analysisHtml}</div>`;
    
  chatMessages.appendChild(msgRow);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Make toggle function globally accessible
  window.toggleAnalysisCard = toggleAnalysisCard;
}

/**
 * Menginisialisasi AI Assistant
 */
export function initAiAssistant(userAvatarInitial = "👤") {
  console.log("🚀 Initializing AI Assistant...");
  
  // Mulai listen data realtime
  listenToRealtimeData();

  // Setup event listeners untuk buka/tutup AI sidebar
  const openAiButton = document.getElementById("openAiAssistantButton");
  const closeAiButton = document.getElementById("closeAiAssistantButton");
  const aiBackdrop = document.getElementById("aiBackdrop");
  
  console.log("🔍 Elements found:", {
    openAiButton: !!openAiButton,
    closeAiButton: !!closeAiButton,
    aiBackdrop: !!aiBackdrop
  });
  
  if (openAiButton) {
    openAiButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🎯 Open button clicked");
      openChat();
    });
  } else {
    console.error("❌ Button openAiAssistantButton tidak ditemukan");
  }
  
  if (closeAiButton) {
    closeAiButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🎯 Close button clicked");
      closeChat();
    });
  }
  
  if (aiBackdrop) {
    aiBackdrop.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🎯 Backdrop clicked");
      closeChat();
    });
  }

  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendAiMessageButton");

  if (!chatInput || !sendBtn) {
    console.error("❌ Elemen chat input atau send button tidak ditemukan");
    return;
  }

  // Handle input changes
  chatInput.addEventListener("input", () => {
    sendBtn.disabled = !chatInput.value.trim();
  });

  // Handle send message
  const handleSendMessage = async () => {
    const msg = chatInput.value.trim();
    if (!msg || sendBtn.disabled) return;

    appendMessage("user", msg, userAvatarInitial);
    chatInput.value = "";
    sendBtn.disabled = true;

    // Show typing indicator
    const chatMessages = document.getElementById("chatMessages");
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "message-row ai typing";
    loadingDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>`;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const response = await generateAIResponse(msg);

    // Remove typing indicator
    loadingDiv.remove();
    
    // Add actual response
    appendMessage("ai", response, "🤖");
    
    sendBtn.disabled = !chatInput.value.trim();
  };

  sendBtn.addEventListener("click", handleSendMessage);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  console.log("✅ AI Assistant initialized successfully");
}

// Export functions for global use
window.openChat = openChat;
window.closeChat = closeChat;