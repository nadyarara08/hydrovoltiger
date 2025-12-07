import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import showdown from "https://esm.run/showdown";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { db } from "../auth/firebase-init.js";

const converter = new showdown.Converter();

// Global variables to store real-time data
let currentData = {
  voltage: 0,
  current: 0,
  power: 0,
  rpm: 0,
  totalEnergy: 0
};

// PLN electricity tariff per kWh (in Rupiah)
const TARIF_PER_KWH = 1444.70;

/**
 * Function to open/close chat - FIXED for main.html
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
    document.body.style.overflow = 'auto'; // Restore scrolling
  }
  if (sidebar) {
    sidebar.classList.remove('show');
  }
  if (backdrop) {
    backdrop.classList.remove('show');
  }
}

/**
 * Get real-time data from Firebase
 */
function listenToRealtimeData() {
  const auth = getAuth();
  
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.warn("User not authenticated. Please sign in to view real-time data.");
      return;
    }
    
    const pltmhRef = ref(db, "PLTMH");
    
    onValue(pltmhRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.warn("PLTMH data not found in Firebase");
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
      
      console.log("PLTMH data updated:", currentData);
    }, (error) => {
      console.error("Error listening to Firebase:", error);
    });
  });
}

/**
 * Calculate monthly prediction and cost
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
 * Generate recommendation based on power usage
 */
function generateRecommendation() {
  const powerInWatt = currentData.power / 1000;
  
  let recommendation = "";
  let status = "good";
  let icon = "checkmark-circle";
  
  if (powerInWatt < 50) {
    recommendation = "Power usage is very efficient! Continue this consumption pattern.";
    status = "good";
    icon = "checkmark-circle";
  } else if (powerInWatt >= 50 && powerInWatt < 150) {
    recommendation = "Power usage is within a reasonable limit. Consider turning off unused devices.";
    status = "moderate";
    icon = "warning";
  } else {
    recommendation = "⚠️ High power usage detected! Reduce the load to save energy and cost.";
    status = "high";
    icon = "alert-circle";
  }
  
  return { recommendation, status, icon };
}

/**
 * Toggle function for opening/closing analysis card
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
 * Create HTML for analysis card with collapse functionality
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
            <h4>Energy Saving Recommendation</h4>
          </div>
          <ion-icon name="chevron-down" class="analysis-toggle" id="${cardId}-toggle"></ion-icon>
        </div>
        <div class="analysis-content" id="${cardId}-content">
          <div class="analysis-item">
            <span class="analysis-label">Current Power:</span>
            <span class="analysis-value ${recommendation.status === 'good' ? 'success' : recommendation.status === 'moderate' ? 'warning' : 'danger'}">
              ${prediction.currentPowerW} W
            </span>
          </div>
          <div class="recommendation-badge ${recommendation.status}">
            <ion-icon name="${recommendation.icon}"></ion-icon>
            ${recommendation.status === 'good' ? 'Very Efficient' : recommendation.status === 'moderate' ? 'Moderately Efficient' : 'Needs Improvement'}
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
            <h4>Monthly Consumption Prediction</h4>
          </div>
          <ion-icon name="chevron-down" class="analysis-toggle" id="${cardId}-toggle"></ion-icon>
        </div>
        <div class="analysis-content" id="${cardId}-content">
          <div class="analysis-item">
            <span class="analysis-label">Daily Consumption:</span>
            <span class="analysis-value">${prediction.dailyWh} Wh</span>
          </div>
          <div class="analysis-item">
            <span class="analysis-label">Monthly Consumption:</span>
            <span class="analysis-value">${prediction.monthlyKWh} kWh</span>
          </div>
          <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-light); font-style: italic;">
            *Based on 8 hours/day for 30 days
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
            <h4>Estimated Monthly Cost</h4>
          </div>
          <ion-icon name="chevron-down" class="analysis-toggle" id="${cardId}-toggle"></ion-icon>
        </div>
        <div class="analysis-content" id="${cardId}-content">
          <div class="analysis-item">
            <span class="analysis-label">Tariff per kWh:</span>
            <span class="analysis-value">Rp ${TARIF_PER_KWH.toLocaleString('id-ID')}</span>
          </div>
          <div class="analysis-item">
            <span class="analysis-label">Estimated Monthly Cost:</span>
            <span class="analysis-value ${parseFloat(prediction.monthlyCost) > 200000 ? 'danger' : parseFloat(prediction.monthlyCost) > 100000 ? 'warning' : 'success'}">
              Rp ${parseFloat(prediction.monthlyCost).toLocaleString('id-ID')}
            </span>
          </div>
          <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-light); font-style: italic;">
            *PLN tariff for household 900VA (R1/900VA)
          </p>
        </div>
      </div>
    `;
  }
  
  return "";
}

/**
 * Generate AI response based on user message
 */
async function generateAIResponse(message) {
  const systemContext = `
You are an AI assistant named **Hydrovoltiger**, designed to help with monitoring and analysis. 
You monitor technical parameters such as:
- **mA (current)**
- **mW (power output)**
- **RPM (turbine speed)**
- **Volt (voltage)**
- **mWh (total energy generated)**

Current data:
- Voltage: ${currentData.voltage.toFixed(2)} V
- Current: ${currentData.current.toFixed(2)} mA
- Power: ${currentData.power.toFixed(2)} mW
- RPM: ${currentData.rpm.toFixed(2)}
- Total Energy: ${currentData.totalEnergy.toFixed(4)} mWh

Your main task:
- Provide technical explanations that are easy to understand.
- Provide real-time performance analysis.
- Provide preventive maintenance insights if necessary.
- Answer user questions with accurate, friendly, and professional information.

Format your response using **MARKDOWN** to make it neat and easy to read.

Use the following elements:
- **Bold** for highlights.
- *Italic* for technical terms.
- Bullet lists for important information.
- Headings (##) for analysis or explanation titles.

Example output format:
## Current System Status
- **Current:** 124 mA → *Stable*
- **Voltage:** 220V → *Within safe range*
- **Turbine RPM:** 780 RPM → *Slightly low, check water flow*

### Recommendations
- Clean the water filter to increase RPM.
- Monitor voltage in the next 10 minutes.

IMPORTANT: Never use card or box formats in your response. Provide answers in plain text with markdown.

If the user sends a message unrelated to monitoring, respond in a friendly but relevant manner to the system context.
`; 

  const prompt = `${systemContext}\n\nUser Question: ${message}`;

  try {
    const response = await fetch("https://hydrovoltiger-production.up.railway.app/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return "⚠️ **Warning**: AI quota is currently full. Please try again later or contact the administrator.";
      } else if (response.status === 502) {
        return "⚠️ **Warning**: AI server is currently experiencing issues. Please try again later.";
      }
      return `**Error**: ${errorData.error || `Failed to connect to AI backend (code: ${response.status})`}.`;
    }

    const data = await response.json();
    return data.text || "No response from AI.";
  } catch (error) {
    console.error("AI Response Error:", error);
    return `**Error**: Failed to connect to AI server. Please check your internet connection.`;
  }
}

/**
 * Add user message to chat
 */
function appendMessage(sender, text, avatar, includeAnalysis = false, analysisType = null) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) {
    console.error("Element chatMessages not found");
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
 * Initialize AI Assistant
 */
export function initAiAssistant(userAvatarInitial = "👤") {
  console.log("🚀 Initializing AI Assistant...");
  
  // Start listening to real-time data
  listenToRealtimeData();

  // Setup event listeners for opening/closing AI sidebar
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
    console.error("❌ Button openAiAssistantButton not found");
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
    console.error("❌ Chat input or send button elements not found");
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