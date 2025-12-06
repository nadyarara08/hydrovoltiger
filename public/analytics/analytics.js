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

  // === DROPDOWN Profile SIDEBAR ===
  const userInfoButton = document.getElementById("userInfoButton");
  const ProfileDropdownNav = document.getElementById("ProfileDropdownNav");
  const dropdownIconNav = document.getElementById("dropdownIconNav");

  if (userInfoButton && ProfileDropdownNav) {
    userInfoButton.addEventListener("click", () => {
      ProfileDropdownNav.classList.toggle("show");
      dropdownIconNav.classList.toggle("rotated");
    });

    document.addEventListener("click", (e) => {
      if (!userInfoButton.contains(e.target) && !ProfileDropdownNav.contains(e.target)) {
        ProfileDropdownNav.classList.remove("show");
        dropdownIconNav.classList.remove("rotated");
      }
    });

    // === AKSI TOMBOL DROPDOWN ===
    const settingsItemNav = ProfileDropdownNav.querySelector(".dropdown-item-nav:nth-child(1)");
    const logoutItemNav = ProfileDropdownNav.querySelector(".dropdown-item-nav.logout");

    if (settingsItemNav) {
      settingsItemNav.addEventListener("click", () => {
        showToast("Pengaturan belum tersedia");
      });
    }

    if (logoutItemNav) {
      logoutItemNav.addEventListener("click", () => {
        console.log("🚪 Logging out...");
        showToast("Memproses logout...");

        signOut(auth)
          .then(() => {
            console.log("✅ Logout successful");
            showToast("Logout berhasil!");
            setTimeout(() => {
              window.location.href = "../login/login.html";
            }, 700);
          })
          .catch((error) => {
            console.error("❌ Logout error:", error);
            showToast("Terjadi kesalahan saat logout. Silahkan coba lagi.");
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

  // Load historical data untuk analisis trend
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

// Fungsi untuk memproses data historis
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
  
  // Get AI Analysis menggunakan Gemini
  await getGeminiAnalysis();
}

async function getGeminiAnalysis() {
  // Cek cache - jangan analisis terlalu sering (max 1x per 2 menit)
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

    // Hitung trend dari data historis
    const dailyTrend = calculateTrend(historicalData.daily);
    const weeklyTrend = calculateTrend(historicalData.weekly);
    const monthlyTrend = calculateTrend(historicalData.monthly);

    // Hitung peak hours (jam dengan konsumsi tertinggi)
    const peakHours = findPeakHours(historicalData.daily);

    // Prepare prompt untuk Gemini AI
    const prompt = `Kamu adalah AI assistant ahli dalam analisis energi untuk sistem monitoring Hydrovoltiger PLTMH (Pembangkit Listrik Tenaga Mikro Hidro). 

Analisis data berikut dan berikan rekomendasi SPESIFIK dan ACTIONABLE dalam bahasa Indonesia:

DATA REALTIME SAAT INI:
- Tegangan: ${currentData.voltage.toFixed(2)} V
- Arus: ${currentData.current.toFixed(2)} mA
- Daya: ${powerInWatt.toFixed(2)} W
- RPM Turbin: ${currentData.rpm.toFixed(2)}
- Total Energi Dihasilkan: ${currentData.totalEnergy.toFixed(4)} mWh

PREDIKSI KONSUMSI & BIAYA:
- Konsumsi Harian: ${dailyWh.toFixed(2)} Wh
- Konsumsi Bulanan: ${monthlyKWh.toFixed(2)} kWh
- Estimasi Biaya Bulanan: Rp ${Math.round(monthlyCost).toLocaleString('id-ID')}
- Rata-rata biaya rumah tangga 900VA: Rp ${AVERAGE_MONTHLY_COST.toLocaleString('id-ID')}
- Selisih dengan rata-rata: Rp ${Math.round(monthlyCost - AVERAGE_MONTHLY_COST).toLocaleString('id-ID')}

ANALISIS TREND:
- Trend Harian: ${dailyTrend.direction} (${dailyTrend.percentage.toFixed(1)}%)
- Trend Mingguan: ${weeklyTrend.direction} (${weeklyTrend.percentage.toFixed(1)}%)
- Trend Bulanan: ${monthlyTrend.direction} (${monthlyTrend.percentage.toFixed(1)}%)

PEAK USAGE:
- Jam Puncak Konsumsi: ${peakHours.join(', ')}
- Rata-rata Daya Harian: ${calculateAverage(historicalData.daily).toFixed(2)} W

KONDISI SISTEM PLTMH:
- Status RPM: ${currentData.rpm > 1000 ? 'Optimal' : currentData.rpm > 500 ? 'Normal' : 'Rendah'}
- Efisiensi Estimasi: ${calculateEfficiency(currentData)}%
- Status Tegangan: ${currentData.voltage >= 200 && currentData.voltage <= 240 ? 'Stabil' : 'Perlu Perhatian'}

TUGAS ANALISIS:
1. Tentukan status efisiensi: "Sangat Efisien" (jika biaya < Rp 100.000), "Cukup Efisien" (Rp 100.000 - Rp 150.000), atau "Perlu Optimasi" (> Rp 150.000)

2. Berikan analisis lengkap meliputi:
   - Kondisi sistem PLTMH (kesehatan turbin, stabilitas output)
   - Pola konsumsi energi dan efisiensi
   - Proyeksi biaya dan potensi penghematan
   - Identifikasi masalah atau anomali jika ada

3. Berikan 4-6 rekomendasi KONKRET dan SPESIFIK untuk:
   - Mengurangi biaya listrik bulanan
   - Mengoptimalkan performa PLTMH
   - Meningkatkan efisiensi energi
   - Maintenance preventif
   - Load management (pengaturan beban)
   - Pemanfaatan waktu peak/off-peak

4. Jika biaya tinggi atau ada masalah, berikan WARNING dan solusi URGENT

Format response HARUS dalam JSON (tanpa markdown backticks):
{
  "status": "good/moderate/high",
  "statusText": "Sangat Efisien/Cukup Efisien/Perlu Optimasi",
  "analysis": "Analisis lengkap 3-4 kalimat yang mencakup kondisi sistem, efisiensi, dan proyeksi biaya",
  "costSavingPotential": "Estimasi penghematan dalam rupiah per bulan",
  "recommendations": [
    "Rekomendasi konkret 1 dengan detail implementasi",
    "Rekomendasi konkret 2 dengan detail implementasi",
    "Rekomendasi konkret 3 dengan detail implementasi",
    "Rekomendasi konkret 4 dengan detail implementasi"
  ],
  "urgentActions": ["Aksi urgent jika ada masalah serius"],
  "maintenanceAdvice": "Saran maintenance berdasarkan kondisi saat ini"
}`;

    // Panggil Gemini API
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
      
      // Cari JSON dalam response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in Gemini response");
      }
    } catch (parseError) {
      console.error("❌ Error parsing Gemini response:", parseError);
      // Fallback ke analisis dasar
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

// Fungsi untuk menghitung trend
function calculateTrend(data) {
  if (data.length < 2) {
    return { direction: "Tidak cukup data", percentage: 0 };
  }

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const avgFirst = firstHalf.reduce((sum, d) => sum + d.power, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, d) => sum + d.power, 0) / secondHalf.length;

  const percentage = ((avgSecond - avgFirst) / avgFirst) * 100;

  let direction = "Stabil";
  if (percentage > 5) direction = "Naik";
  else if (percentage < -5) direction = "Turun";

  return { direction, percentage: Math.abs(percentage) };
}

// Fungsi untuk mencari jam puncak konsumsi
function findPeakHours(data) {
  if (data.length === 0) return ["Data tidak tersedia"];

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

// Fungsi untuk menghitung rata-rata
function calculateAverage(data) {
  if (data.length === 0) return 0;
  const sum = data.reduce((total, d) => total + d.power, 0);
  return sum / data.length / 1000; // Convert to W
}

// Fungsi untuk menghitung efisiensi
function calculateEfficiency(data) {
  // Efisiensi sederhana berdasarkan rasio daya output vs RPM
  const expectedPower = (data.rpm / 1000) * 100; // Asumsi: 100W per 1000 RPM
  const actualPower = data.power / 1000;
  const efficiency = (actualPower / expectedPower) * 100;
  return Math.min(100, Math.max(0, efficiency)).toFixed(1);
}

function getBasicAnalysis(powerInWatt, monthlyCost) {
  // Fallback analysis jika Gemini gagal
  let status, statusText, costSavingPotential;
  
  if (monthlyCost < 100000) {
    status = "good";
    statusText = "Sangat Efisien";
    costSavingPotential = "Rp 10.000 - Rp 20.000 dengan optimasi minor";
  } else if (monthlyCost < 150000) {
    status = "moderate";
    statusText = "Cukup Efisien";
    costSavingPotential = "Rp 20.000 - Rp 40.000 dengan optimasi beban";
  } else {
    status = "high";
    statusText = "Perlu Optimasi";
    costSavingPotential = "Rp 40.000 - Rp 80.000 dengan manajemen energi";
  }

  return {
    status,
    statusText,
    analysis: `Sistem PLTMH Anda menghasilkan daya ${powerInWatt.toFixed(2)}W dengan estimasi biaya bulanan Rp ${Math.round(monthlyCost).toLocaleString('id-ID')}. ${status === 'good' ? 'Performa sangat baik dan efisien.' : status === 'moderate' ? 'Masih dalam batas wajar namun ada ruang untuk optimasi.' : 'Konsumsi tinggi, diperlukan optimasi segera.'} Dengan manajemen yang tepat, Anda dapat mengoptimalkan penggunaan energi dan mengurangi biaya operasional.`,
    costSavingPotential,
    recommendations: [
      "Lakukan monitoring rutin setiap hari untuk mendeteksi anomali konsumsi daya",
      "Optimalkan jadwal penggunaan di luar jam puncak (${findPeakHours(historicalData.daily).join(', ')})",
      "Periksa kondisi turbin dan pastikan tidak ada hambatan aliran air",
      status === 'high' ? "URGENT: Kurangi beban listrik segera untuk mencegah overload" : "Pertimbangkan penggunaan perangkat hemat energi",
      "Lakukan maintenance preventif setiap 2 minggu untuk menjaga efisiensi optimal",
      "Catat pola konsumsi untuk identifikasi peluang penghematan lebih lanjut"
    ],
    urgentActions: status === 'high' ? [
      "Matikan perangkat non-esensial segera",
      "Cek sistem PLTMH untuk memastikan tidak ada masalah teknis"
    ] : [],
    maintenanceAdvice: `Berdasarkan RPM ${currentData.rpm.toFixed(0)}, ${currentData.rpm > 1000 ? 'sistem dalam kondisi baik. Lanjutkan maintenance rutin.' : currentData.rpm > 500 ? 'periksa aliran air dan bersihkan filter turbin.' : 'segera cek sistem - RPM terlalu rendah!'}`
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
      <span>Menganalisis dengan AI...</span>
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
      <p>🤖 Gemini AI sedang menganalisis data PLTMH Anda secara mendalam untuk memberikan rekomendasi terbaik...</p>
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
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #e53e3e; font-size: 0.9rem;">⚠️ Tindakan Urgent:</p>
        <ul style="margin: 0; padding-left: 20px; color: #e53e3e; font-size: 0.85rem; line-height: 1.8;">
          ${result.urgentActions.map(action => `<li>${action}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const savingHTML = result.costSavingPotential ? `
      <div style="padding: 12px; background: rgba(56, 161, 105, 0.1); border-radius: 10px; border-left: 3px solid #38a169; margin-bottom: 12px;">
        <p style="margin: 0; font-weight: 600; color: #38a169; font-size: 0.9rem;">💰 Potensi Penghematan: ${result.costSavingPotential}</p>
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
          <p style="margin: 0 0 8px 0; font-weight: 600; color: var(--accent-primary); font-size: 0.9rem;">💡 Rekomendasi AI:</p>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-primary); font-size: 0.9rem; line-height: 1.8;">
            ${recommendationsHTML}
          </ul>
        </div>
        
        ${result.maintenanceAdvice ? `
        <div style="padding: 12px; background: rgba(214, 158, 46, 0.1); border-radius: 10px; border-left: 3px solid #d69e2e;">
          <p style="margin: 0; font-weight: 600; color: #d69e2e; font-size: 0.85rem;">🔧 Saran Maintenance:</p>
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
      costComparison.textContent = `${percentage.toFixed(0)}% lebih hemat`;
      costComparison.style.color = "#38a169";
    } else if (difference > 0) {
      costComparison.textContent = `${percentage.toFixed(0)}% lebih tinggi`;
      costComparison.style.color = "#e53e3e";
    } else {
      costComparison.textContent = `Sesuai rata-rata`;
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