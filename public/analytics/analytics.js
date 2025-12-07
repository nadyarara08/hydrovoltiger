import { db } from "../auth/firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { auth } from "../auth/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Tarif listrik PLN per kWh (dalam Rupiah)
const TARIF_PER_KWH = 1444.70;
const AVERAGE_MONTHLY_COST = 150000; // Rata-rata biaya bulanan untuk 900VA

// Global data
let currentData = {
  voltage: 0,
  current: 0,
  power: 0,
  rpm: 0,
  totalEnergy: 0
};

let aiAnalysisCache = {
  recommendation: null,
  lastAnalyzed: null,
  isAnalyzing: false
};

// Tambahan: Data historis untuk analisis trend
let historicalData = {
  daily: [],
  weekly: [],
  monthly: []
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Analytics page loaded");

  const userAvatarNav = document.getElementById("userAvatarNav");
  const userNameNav = document.getElementById("userNameNav");

  // === LOGIN CHECK ===
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ User logged in:", user.email);
      const name = user.displayName || user.email.split("@")[0];
      const initial = name.charAt(0).toUpperCase();
      
      if (userAvatarNav) userAvatarNav.textContent = initial;
      if (userNameNav) userNameNav.textContent = name;

      initAnalytics();
    } else {
      console.log("❌ No user logged in, redirecting to login...");
      window.location.href = "../login/login.html";
    }
  });

  // === DROPDOWN profile SIDEBAR ===
  const userInfoButton = document.getElementById("userInfoButton");
  const profileDropdownNav = document.getElementById("profileDropdownNav");
  const dropdownIconNav = document.getElementById("dropdownIconNav");

  if (userInfoButton && profileDropdownNav) {
    userInfoButton.addEventListener("click", () => {
      profileDropdownNav.classList.toggle("show");
      dropdownIconNav.classList.toggle("rotated");
    });

    document.addEventListener("click", (e) => {
      if (!userInfoButton.contains(e.target) && !profileDropdownNav.contains(e.target)) {
        profileDropdownNav.classList.remove("show");
        dropdownIconNav.classList.remove("rotated");
      }
    });

    // === AKSI TOMBOL DROPDOWN ===
    const settingsItemNav = profileDropdownNav.querySelector(".dropdown-item-nav:nth-child(1)");
    const logoutItemNav = profileDropdownNav.querySelector(".dropdown-item-nav.logout");

    if (settingsItemNav) {
      settingsItemNav.addEventListener("click", () => {
        showToast("Settings not available yet");
      });
    }

    if (logoutItemNav) {
      logoutItemNav.addEventListener("click", () => {
        console.log("🚪 Logging out...");
        showToast("Processing logout...");

        signOut(auth)
          .then(() => {
            console.log("✅ Logout successful");
            showToast("Logout successful!");
            setTimeout(() => {
              window.location.href = "../login/login.html";
            }, 700);
          })
          .catch((error) => {
            console.error("❌ Logout error:", error);
            showToast("An error occurred during logout. Please try again.");
          });
      });
    }
  }
});

function initAnalytics() {
  console.log("📊 Initializing Analytics...");

  // Listen to Firebase data
  const pltmhRef = ref(db, "PLTMH");
  const historyRef = ref(db, "history");

  // Load historical data for trend analysis
  onValue(historyRef, (snapshot) => {
    if (snapshot.exists()) {
      const history = snapshot.val();
      processHistoricalData(history);
    }
  });

  onValue(pltmhRef, (snapshot) => {
    if (!snapshot.exists()) {
      console.warn("⚠️ PLTMH data does not exist");
      return;
    }

    const data = snapshot.val();
    console.log("📊 PLTMH data received:", data);

    currentData = {
      voltage: parseFloat(data.Tegangan_V || 0),
      current: parseFloat(data.Arus_mA || 0),
      power: parseFloat(data.Daya_mW || 0),
      rpm: parseFloat(data.RPM_Turbin || 0),
      totalEnergy: parseFloat(data.Total_Energi_mWh || 0)
    };

    updateAnalytics();
  });
}

// Function to process historical data
function processHistoricalData(history) {
  const now = new Date();
  const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);
  const oneWeekAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);

  historicalData.daily = [];
  historicalData.weekly = [];
  historicalData.monthly = [];

  Object.entries(history).forEach(([timestamp, data]) => {
    const ts = parseInt(timestamp);
    
    if (ts >= oneDayAgo) {
      historicalData.daily.push({
        timestamp: ts,
        power: parseFloat(data.power || 0),
        voltage: parseFloat(data.voltage || 0),
        current: parseFloat(data.current || 0),
        rpm: parseFloat(data.rpm || 0)
      });
    }
    
    if (ts >= oneWeekAgo) {
      historicalData.weekly.push({
        timestamp: ts,
        power: parseFloat(data.power || 0),
        voltage: parseFloat(data.voltage || 0),
        current: parseFloat(data.current || 0),
        rpm: parseFloat(data.rpm || 0)
      });
    }
    
    if (ts >= oneMonthAgo) {
      historicalData.monthly.push({
        timestamp: ts,
        power: parseFloat(data.power || 0),
        voltage: parseFloat(data.voltage || 0),
        current: parseFloat(data.current || 0),
        rpm: parseFloat(data.rpm || 0)
      });
    }
  });

  console.log("📈 Historical data processed:", {
    daily: historicalData.daily.length,
    weekly: historicalData.weekly.length,
    monthly: historicalData.monthly.length
  });
}

async function updateAnalytics() {
  const powerInWatt = currentData.power / 1000;
  
  // Update Quick Stats
  updateQuickStats(powerInWatt);
  
  // Update Prediction
  updatePrediction(powerInWatt);
  
  // Update Cost
  updateCost(powerInWatt);
  
  // Get AI Analysis using Gemini
  await getGeminiAnalysis();
}

async function getGeminiAnalysis() {
  // Check cache - don't analyze too frequently (max 1x per 2 minutes)
  const now = Date.now();
  if (aiAnalysisCache.lastAnalyzed && (now - aiAnalysisCache.lastAnalyzed) < 120000) {
    console.log("🤖 Using cached AI analysis");
    displayAIRecommendation(aiAnalysisCache.recommendation);
    return;
  }

  if (aiAnalysisCache.isAnalyzing) {
    console.log("🤖 AI analysis already in progress");
    return;
  }

  console.log("🤖 Starting Gemini AI analysis...");
  aiAnalysisCache.isAnalyzing = true;

  // Show loading state
  showAILoadingState();

  try {
    const powerInWatt = currentData.power / 1000;
    const hoursPerDay = 8;
    const daysPerMonth = 30;
    const dailyWh = powerInWatt * hoursPerDay;
    const monthlyKWh = (dailyWh * daysPerMonth) / 1000;
    const monthlyCost = monthlyKWh * TARIF_PER_KWH;

    // Calculate trend from historical data
    const dailyTrend = calculateTrend(historicalData.daily);
    const weeklyTrend = calculateTrend(historicalData.weekly);
    const monthlyTrend = calculateTrend(historicalData.monthly);

    // Calculate peak hours (hours with highest consumption)
    const peakHours = findPeakHours(historicalData.daily);

    // Prepare prompt for Gemini AI
    const prompt = `You are an AI assistant expert in energy analysis for the Hydrovoltiger PLTMH (Micro Hydro Power Plant) monitoring system.

Analyze the following data and provide specific and actionable recommendations in English:

REAL-TIME DATA:
- Voltage: ${currentData.voltage.toFixed(2)} V
- Current: ${currentData.current.toFixed(2)} mA
- Power: ${powerInWatt.toFixed(2)} W
- RPM Turbin: ${currentData.rpm.toFixed(2)}
- Total Energy Produced: ${currentData.totalEnergy.toFixed(4)} mWh

CONSUMPTION AND COST PREDICTION:
- Daily Consumption: ${dailyWh.toFixed(2)} Wh
- Monthly Consumption: ${monthlyKWh.toFixed(2)} kWh
- Estimated Monthly Cost: Rp ${Math.round(monthlyCost).toLocaleString('id-ID')}
- Average monthly cost for 900VA: Rp ${AVERAGE_MONTHLY_COST.toLocaleString('id-ID')}
- Difference with average: Rp ${Math.round(monthlyCost - AVERAGE_MONTHLY_COST).toLocaleString('id-ID')}

TREND ANALYSIS:
- Daily Trend: ${dailyTrend.direction} (${dailyTrend.percentage.toFixed(1)}%)
- Weekly Trend: ${weeklyTrend.direction} (${weeklyTrend.percentage.toFixed(1)}%)
- Monthly Trend: ${monthlyTrend.direction} (${monthlyTrend.percentage.toFixed(1)}%)

PEAK USAGE:
- Peak Hours: ${peakHours.join(', ')}
- Average Daily Power: ${calculateAverage(historicalData.daily).toFixed(2)} W

SYSTEM CONDITION:
- RPM Status: ${currentData.rpm > 1000 ? 'Optimal' : currentData.rpm > 500 ? 'Normal' : 'Low'}
- Estimated Efficiency: ${calculateEfficiency(currentData)}%
- Voltage Status: ${currentData.voltage >= 200 && currentData.voltage <= 240 ? 'Stable' : 'Needs Attention'}

ANALYSIS TASK:
1. Determine efficiency status: "Very Efficient" (if cost < Rp 100,000), "Efficient" (Rp 100,000 - Rp 150,000), or "Needs Optimization" (> Rp 150,000)

2. Provide a comprehensive analysis including:
   - System condition (turbine health, output stability)
   - Energy consumption pattern and efficiency
   - Cost projection and potential savings
   - Identification of problems or anomalies if any

3. Provide 4-6 specific and actionable recommendations for:
   - Reducing monthly electricity costs
   - Optimizing PLTMH performance
   - Improving energy efficiency
   - Preventive maintenance
   - Load management (load control)
   - Peak/off-peak time utilization

4. If cost is high or there are problems, provide a WARNING and urgent solution

Format response MUST be in JSON (without markdown backticks):
{
  "status": "good/moderate/high",
  "statusText": "Very Efficient/Efficient/Needs Optimization",
  "analysis": "Comprehensive analysis 3-4 sentences that includes system condition, efficiency, and cost projection",
  "costSavingPotential": "Estimated savings in Rupiah per month",
  "recommendations": [
    "Specific recommendation 1 with implementation details",
    "Specific recommendation 2 with implementation details",
    "Specific recommendation 3 with implementation details",
    "Specific recommendation 4 with implementation details"
  ],
  "urgentActions": ["Urgent action if there are serious problems"],
  "maintenanceAdvice": "Maintenance advice based on current condition"
}`;

    // Call Gemini API
    const response = await fetch("https://hydrovoltiger-production.up.railway.app/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log("🤖 Gemini Response:", data);

    // Parse Gemini response
    let aiResult;
    try {
      const aiText = data.text || data.result || "";
      
      // Find JSON in response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in Gemini response");
      }
    } catch (parseError) {
      console.error("❌ Error parsing Gemini response:", parseError);
      // Fallback to basic analysis
      aiResult = getBasicAnalysis(powerInWatt, monthlyCost);
    }

    // Cache the result
    aiAnalysisCache.recommendation = aiResult;
    aiAnalysisCache.lastAnalyzed = Date.now();
    
    // Display result
    displayAIRecommendation(aiResult);

  } catch (error) {
    console.error("❌ Gemini Analysis Error:", error);
    // Fallback to basic analysis
    const powerInWatt = currentData.power / 1000;
    const monthlyCost = (powerInWatt * 8 * 30 * TARIF_PER_KWH) / 1000;
    const fallbackResult = getBasicAnalysis(powerInWatt, monthlyCost);
    displayAIRecommendation(fallbackResult);
  } finally {
    aiAnalysisCache.isAnalyzing = false;
  }
}

// Function to calculate trend
function calculateTrend(data) {
  if (data.length < 2) {
    return { direction: "Insufficient data", percentage: 0 };
  }

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const avgFirst = firstHalf.reduce((sum, d) => sum + d.power, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, d) => sum + d.power, 0) / secondHalf.length;

  const percentage = ((avgSecond - avgFirst) / avgFirst) * 100;

  let direction = "Stable";
  if (percentage > 5) direction = "Increasing";
  else if (percentage < -5) direction = "Decreasing";

  return { direction, percentage: Math.abs(percentage) };
}

// Function to find peak hours
function findPeakHours(data) {
  if (data.length === 0) return ["No data available"];

  const hourlyAvg = {};
  
  data.forEach(d => {
    const hour = new Date(d.timestamp).getHours();
    if (!hourlyAvg[hour]) {
      hourlyAvg[hour] = { total: 0, count: 0 };
    }
    hourlyAvg[hour].total += d.power;
    hourlyAvg[hour].count++;
  });

  const avgByHour = Object.entries(hourlyAvg).map(([hour, data]) => ({
    hour: parseInt(hour),
    avg: data.total / data.count
  }));

  avgByHour.sort((a, b) => b.avg - a.avg);

  return avgByHour.slice(0, 3).map(h => `${h.hour}:00-${h.hour + 1}:00`);
}

// Function to calculate average
function calculateAverage(data) {
  if (data.length === 0) return 0;
  const sum = data.reduce((total, d) => total + d.power, 0);
  return sum / data.length / 1000; // Convert to W
}

// Function to calculate efficiency
function calculateEfficiency(data) {
  // Simple efficiency based on power output vs RPM ratio
  const expectedPower = (data.rpm / 1000) * 100; // Assume: 100W per 1000 RPM
  const actualPower = data.power / 1000;
  const efficiency = (actualPower / expectedPower) * 100;
  return Math.min(100, Math.max(0, efficiency)).toFixed(1);
}

function getBasicAnalysis(powerInWatt, monthlyCost) {
  // Fallback analysis if Gemini fails
  let status, statusText, costSavingPotential;
  
  if (monthlyCost < 100000) {
    status = "good";
    statusText = "Very Efficient";
    costSavingPotential = "Rp 10,000 - Rp 20,000 with minor optimization";
  } else if (monthlyCost < 150000) {
    status = "moderate";
    statusText = "Efficient";
    costSavingPotential = "Rp 20,000 - Rp 40,000 with load optimization";
  } else {
    status = "high";
    statusText = "Needs Optimization";
    costSavingPotential = "Rp 40,000 - Rp 80,000 with energy management";
  }

  return {
    status,
    statusText,
    analysis: `Your PLTMH system is producing ${powerInWatt.toFixed(2)}W with an estimated monthly cost of Rp ${Math.round(monthlyCost).toLocaleString('id-ID')}. ${status === 'good' ? 'Performance is very good and efficient.' : status === 'moderate' ? 'Still within reasonable limits but there is room for optimization.' : 'Consumption is high, optimization is needed.'} With proper management, you can optimize energy usage and reduce operational costs.`,
    costSavingPotential,
    recommendations: [
      "Perform daily monitoring to detect anomalies in power consumption",
      "Optimize usage schedule outside peak hours (${findPeakHours(historicalData.daily).join(', ')})",
      "Check turbine condition and ensure there are no water flow obstructions",
      status === 'high' ? "URGENT: Reduce electricity load immediately to prevent overload" : "Consider using energy-saving devices",
      "Perform preventive maintenance every 2 weeks to maintain optimal efficiency",
      "Record consumption patterns to identify further savings opportunities"
    ],
    urgentActions: status === 'high' ? [
      "Turn off non-essential devices immediately",
      "Check the PLTMH system to ensure there are no technical issues"
    ] : [],
    maintenanceAdvice: `Based on RPM ${currentData.rpm.toFixed(0)}, ${currentData.rpm > 1000 ? 'the system is in good condition. Continue with routine maintenance.' : currentData.rpm > 500 ? 'check water flow and clean the turbine filter.' : 'immediately check the system - RPM is too low!'}`
  };
}

function showAILoadingState() {
  const badge = document.getElementById("recommendationBadge");
  const powerDetail = document.getElementById("currentPowerDetail");
  const recommendationText = document.getElementById("recommendationText");
  
  if (badge) {
    badge.className = "status-badge";
    badge.innerHTML = `
      <ion-icon name="hourglass-outline"></ion-icon>
      <span>Processing AI analysis...</span>
    `;
  }
  
  if (powerDetail) {
    const powerInWatt = currentData.power / 1000;
    powerDetail.textContent = `${powerInWatt.toFixed(2)} W`;
    powerDetail.className = "detail-value";
  }
  
  if (recommendationText) {
    recommendationText.innerHTML = `
      <ion-icon name="sync-outline" style="animation: spin 1s linear infinite;"></ion-icon>
      <p>🤖 Gemini AI is analyzing your PLTMH data in-depth to provide the best recommendations...</p>
    `;
  }
}

function displayAIRecommendation(result) {
  const badge = document.getElementById("recommendationBadge");
  const powerDetail = document.getElementById("currentPowerDetail");
  const recommendationText = document.getElementById("recommendationText");
  const efficiencyStatus = document.getElementById("efficiencyStatus");
  
  const iconMap = {
    good: "checkmark-circle",
    moderate: "warning",
    high: "alert-circle"
  };
  
  const classMap = {
    good: "good",
    moderate: "moderate",
    high: "high"
  };
  
  if (badge) {
    badge.className = `status-badge ${classMap[result.status] || "moderate"}`;
    badge.innerHTML = `
      <ion-icon name="${iconMap[result.status] || "information-circle"}"></ion-icon>
      <span>${result.statusText}</span>
    `;
  }
  
  if (powerDetail) {
    const powerInWatt = currentData.power / 1000;
    powerDetail.textContent = `${powerInWatt.toFixed(2)} W`;
    powerDetail.className = `detail-value ${result.status === 'good' ? 'success' : result.status === 'moderate' ? 'warning' : 'danger'}`;
  }
  
  if (efficiencyStatus) {
    efficiencyStatus.textContent = result.statusText;
    const colorMap = {
      good: "#38a169",
      moderate: "#d69e2e",
      high: "#e53e3e"
    };
    efficiencyStatus.style.color = colorMap[result.status] || "#d69e2e";
  }
  
  if (recommendationText) {
    const recommendationsHTML = result.recommendations
      .map(rec => `<li>${rec}</li>`)
      .join('');
    
    const urgentHTML = result.urgentActions && result.urgentActions.length > 0 ? `
      <div style="padding: 12px; background: rgba(229, 62, 62, 0.1); border-radius: 10px; border-left: 3px solid #e53e3e; margin-bottom: 12px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #e53e3e; font-size: 0.9rem;">⚠️ Urgent Actions:</p>
        <ul style="margin: 0; padding-left: 20px; color: #e53e3e; font-size: 0.85rem; line-height: 1.8;">
          ${result.urgentActions.map(action => `<li>${action}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const savingHTML = result.costSavingPotential ? `
      <div style="padding: 12px; background: rgba(56, 161, 105, 0.1); border-radius: 10px; border-left: 3px solid #38a169; margin-bottom: 12px;">
        <p style="margin: 0; font-weight: 600; color: #38a169; font-size: 0.9rem;">💰 Saving Potential: ${result.costSavingPotential}</p>
      </div>
    ` : '';
    
    recommendationText.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <ion-icon name="analytics-outline" style="font-size: 24px; color: var(--accent-primary); flex-shrink: 0; margin-top: 2px;"></ion-icon>
          <p style="margin: 0; color: var(--text-primary); font-size: 0.95rem; line-height: 1.6;">${result.analysis}</p>
        </div>
        
        ${urgentHTML}
        ${savingHTML}
        
        <div style="padding: 12px; background: rgba(18, 52, 64, 0.04); border-radius: 10px; border-left: 3px solid var(--accent-primary);">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: var(--accent-primary); font-size: 0.9rem;">💡 AI Recommendations:</p>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-primary); font-size: 0.9rem; line-height: 1.8;">
            ${recommendationsHTML}
          </ul>
        </div>
        
        ${result.maintenanceAdvice ? `
        <div style="padding: 12px; background: rgba(214, 158, 46, 0.1); border-radius: 10px; border-left: 3px solid #d69e2e;">
          <p style="margin: 0; font-weight: 600; color: #d69e2e; font-size: 0.85rem;">🔧 Maintenance Advice:</p>
          <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6;">${result.maintenanceAdvice}</p>
        </div>
        ` : ''}
      </div>
    `;
  }
}

function updateQuickStats(powerInWatt) {
  const currentPowerStat = document.getElementById("currentPowerStat");
  
  if (currentPowerStat) {
    currentPowerStat.textContent = `${powerInWatt.toFixed(2)} W`;
  }
}

function updatePrediction(powerInWatt) {
  const hoursPerDay = 8;
  const daysPerMonth = 30;
  
  const dailyWh = powerInWatt * hoursPerDay;
  const monthlyKWh = (dailyWh * daysPerMonth) / 1000;
  
  const dailyConsumption = document.getElementById("dailyConsumption");
  const monthlyConsumption = document.getElementById("monthlyConsumption");
  
  if (dailyConsumption) {
    dailyConsumption.textContent = `${dailyWh.toFixed(2)} Wh`;
  }
  
  if (monthlyConsumption) {
    monthlyConsumption.textContent = `${monthlyKWh.toFixed(2)} kWh`;
  }
}

function updateCost(powerInWatt) {
  const hoursPerDay = 8;
  const daysPerMonth = 30;
  
  const dailyWh = powerInWatt * hoursPerDay;
  const monthlyKWh = (dailyWh * daysPerMonth) / 1000;
  const monthlyCost = monthlyKWh * TARIF_PER_KWH;
  
  const monthlyCostEl = document.getElementById("monthlyCost");
  const costBarFill = document.getElementById("costBarFill");
  const costComparison = document.getElementById("costComparison");
  
  if (monthlyCostEl) {
    monthlyCostEl.textContent = `Rp ${Math.round(monthlyCost).toLocaleString('id-ID')}`;
    
    // Update color based on cost
    if (monthlyCost > 200000) {
      monthlyCostEl.style.color = "#e53e3e";
    } else if (monthlyCost > 100000) {
      monthlyCostEl.style.color = "#d69e2e";
    } else {
      monthlyCostEl.style.color = "#38a169";
    }
  }
  
  if (costBarFill) {
    const percentage = Math.min((monthlyCost / AVERAGE_MONTHLY_COST) * 100, 150);
    costBarFill.style.width = `${percentage}%`;
    
    // Update bar color
    if (percentage > 80) {
      costBarFill.style.background = "linear-gradient(90deg, #e53e3e, #fc8181)";
    } else if (percentage > 50) {
      costBarFill.style.background = "linear-gradient(90deg, #d69e2e, #f6ad55)";
    } else {
      costBarFill.style.background = "linear-gradient(90deg, #10b981, #34d399)";
    }
  }
  
  if (costComparison) {
    const difference = monthlyCost - AVERAGE_MONTHLY_COST;
    const percentage = Math.abs((difference / AVERAGE_MONTHLY_COST) * 100);
    
    if (difference < 0) {
      costComparison.textContent = `${percentage.toFixed(0)}% more efficient`;
      costComparison.style.color = "#38a169";
    } else if (difference > 0) {
      costComparison.textContent = `${percentage.toFixed(0)}% higher`;
      costComparison.style.color = "#e53e3e";
    } else {
      costComparison.textContent = `Average`;
      costComparison.style.color = "#d69e2e";
    }
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Add CSS for spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);