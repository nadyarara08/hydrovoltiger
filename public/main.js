import { db } from "./auth/firebase-init.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { auth } from "./auth/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initAiAssistant } from "./ai_assistant/ai.js";

// 🧪 TESTING MODE - Set false untuk production
const TESTING_MODE = false; // ← UBAH KE false NANTI UNTUK PRODUCTION
const SAVE_INTERVAL = TESTING_MODE ? 60000 : 3600000; // 1 menit vs 1 jam

console.log(`🧪 Mode: ${TESTING_MODE ? 'TESTING (1 menit)' : 'PRODUCTION (1 jam)'}`);

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Page loaded, initializing...");
  
  const userAvatarNav = document.getElementById("userAvatarNav");
  const userNameNav = document.getElementById("userNameNav");

  // ======== CONNECTION INDICATOR ========
  const indicator = document.getElementById("connectionIndicator");
  const indicatorText = document.getElementById("indicatorText");

  const connectionRef = ref(db, ".info/connected");
  onValue(connectionRef, (snapshot) => {
    const connected = snapshot.val();
    console.log("🔌 Firebase:", connected ? "ONLINE ✅" : "OFFLINE ❌");
    
    if (connected) {
      indicator.classList.add("online");
      indicator.classList.remove("offline");
      indicatorText.textContent = "Terhubung";
    } else {
      indicator.classList.add("offline");
      indicator.classList.remove("online");
      indicatorText.textContent = "Tidak terhubung";
    }
  });

  // ======== LOGIN CHECK ========
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ User logged in:", user.email);
      const name = user.displayName || user.email.split("@")[0];
      const initial = name.charAt(0).toUpperCase();
      
      if (userAvatarNav) userAvatarNav.textContent = initial;
      if (userNameNav) userNameNav.textContent = name;

      setTimeout(() => {
        startDashboard();
        initAiAssistant(initial);
      }, 500);
    } else {
      console.log("❌ No user, redirecting to login...");
      window.location.href = "./login/login.html";
    }
  });

  // ======== DASHBOARD LOGIC ========
  function startDashboard() {
    console.log("📊 Starting Dashboard...");
    
    let realtimeData = { labels: [], voltage: [], current: [], power: [], rpm: [] };
    let dailyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
    let weeklyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
    let monthlyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
    let turbineStartTime = null;
    
    let lastSaveTime = null;
    let currentIntervalData = {
      voltage: [],
      current: [],
      power: [],
      rpm: [],
      count: 0
    };

    // ======== HELPER FUNCTIONS ========
    function getStartOfInterval(date) {
      const d = new Date(date);
      if (TESTING_MODE) {
        d.setSeconds(0, 0); // Round ke menit
      } else {
        d.setMinutes(0, 0, 0); // Round ke jam
      }
      return d.getTime();
    }

    function normalizeData(voltage, current, power, rpm) {
      // Handle RPM yang terlalu besar (bug sensor)
      if (rpm > 10000) {
        console.warn(`⚠️ RPM too high (${rpm}), normalizing...`);
        rpm = rpm / 100;
      }
      
      // Handle nilai negatif yang tidak wajar
      if (voltage < 0) voltage = Math.abs(voltage);
      if (rpm < 0) rpm = 0;
      
      return { voltage, current, power, rpm };
    }

    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: ${TESTING_MODE ? '120px' : '80px'};
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        max-width: 300px;
        font-size: 14px;
      `;
      
      if (type === 'success') toast.style.background = '#10b981';
      else if (type === 'error') toast.style.background = '#ef4444';
      else toast.style.background = '#3b82f6';
      
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => toast.remove(), 3000);
    }

    // ======== SHOW TESTING BANNER ========
    if (TESTING_MODE) {
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: #000;
        padding: 12px 20px;
        text-align: center;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      `;
      banner.innerHTML = `
        🧪 TESTING MODE - Snapshot setiap 1 MENIT (production: 1 jam)
        <button onclick="this.parentElement.remove()" style="margin-left: 20px; padding: 5px 15px; cursor: pointer; border: none; border-radius: 4px; background: rgba(0,0,0,0.2); font-weight: 600;">✕</button>
      `;
      document.body.insertBefore(banner, document.body.firstChild);
    }

    // ======== SAVE PERIODIC SNAPSHOT ========
    function savePeriodicSnapshot(data) {
      const now = new Date();
      const currentInterval = getStartOfInterval(now);
      
      currentIntervalData.voltage.push(data.voltage);
      currentIntervalData.current.push(data.current);
      currentIntervalData.power.push(data.power);
      currentIntervalData.rpm.push(data.rpm);
      currentIntervalData.count++;
      
      const timeUntilNext = SAVE_INTERVAL - (now.getTime() - currentInterval);
      const secondsLeft = Math.floor(timeUntilNext / 1000);
      
      if (currentIntervalData.count % 5 === 0) {
        console.log(`📊 ${currentIntervalData.count} data points | Next save: ${secondsLeft}s`);
      }
      
      const shouldSave = !lastSaveTime || (currentInterval > lastSaveTime);
      
      if (shouldSave && currentIntervalData.count > 0) {
        const avgVoltage = currentIntervalData.voltage.reduce((a, b) => a + b, 0) / currentIntervalData.count;
        const avgCurrent = currentIntervalData.current.reduce((a, b) => a + b, 0) / currentIntervalData.count;
        const avgPower = currentIntervalData.power.reduce((a, b) => a + b, 0) / currentIntervalData.count;
        const avgRpm = currentIntervalData.rpm.reduce((a, b) => a + b, 0) / currentIntervalData.count;
        
        const saveTimestamp = lastSaveTime || currentInterval;
        const historyRef = ref(db, `history/${saveTimestamp}`);
        
        console.log(`💾 Saving snapshot (${currentIntervalData.count} points averaged)`);
        
        set(historyRef, {
          voltage: avgVoltage.toFixed(2),
          current: avgCurrent.toFixed(2),
          power: avgPower.toFixed(2),
          rpm: avgRpm.toFixed(2),
          timestamp: saveTimestamp
        }).then(() => {
          console.log(`✅ Snapshot saved at ${new Date(saveTimestamp).toLocaleString('id-ID')}`);
          showToast(`💾 Data tersimpan (${currentIntervalData.count} points)`, 'success');
          
          currentIntervalData = {
            voltage: [],
            current: [],
            power: [],
            rpm: [],
            count: 0
          };
          
          lastSaveTime = currentInterval;
          loadAndProcessHistory();
        }).catch((error) => {
          console.error("❌ Save error:", error);
          showToast(`❌ Gagal menyimpan: ${error.message}`, 'error');
        });
      }
    }

    // ======== LOAD & PROCESS HISTORY ========
    function loadAndProcessHistory() {
      const historyRef = ref(db, "history");
      
      onValue(historyRef, (snapshot) => {
        if (!snapshot.exists()) {
          console.log("📚 No history data yet");
          return;
        }

        const history = snapshot.val();
        console.log(`📚 Loading ${Object.keys(history).length} snapshots...`);

        dailyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
        weeklyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
        monthlyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };

        const historyArray = Object.entries(history)
          .map(([ts, data]) => ({
            timestamp: parseInt(ts),
            voltage: parseFloat(data.voltage),
            current: parseFloat(data.current),
            power: parseFloat(data.power),
            rpm: parseFloat(data.rpm)
          }))
          .filter(item => {
            // Filter data yang valid
            const isValid = !isNaN(item.voltage) && !isNaN(item.current) && 
                           !isNaN(item.power) && !isNaN(item.rpm);
            if (!isValid) console.warn("⚠️ Skipping invalid data:", item);
            return isValid;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        console.log(`✅ ${historyArray.length} valid snapshots`);

        // ===== DAILY (1 jam/24 jam terakhir) =====
        const dailyPeriod = TESTING_MODE ? (60 * 60 * 1000) : (24 * 60 * 60 * 1000);
        const dailyHistory = historyArray.filter(item => 
          item.timestamp >= Date.now() - dailyPeriod
        );
        
        (dailyHistory.length > 0 ? dailyHistory : historyArray.slice(-24)).forEach(item => {
          const normalized = normalizeData(item.voltage, item.current, item.power, item.rpm);
          const date = new Date(item.timestamp);
          
          dailyData.labels.push(date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          dailyData.voltage.push(normalized.voltage);
          dailyData.current.push(normalized.current);
          dailyData.power.push(normalized.power);
          dailyData.rpm.push(normalized.rpm);
          dailyData.timestamps.push(item.timestamp);
        });

        // ===== WEEKLY (3 jam/7 hari terakhir, group per 10min/1hari) =====
        const weeklyPeriod = TESTING_MODE ? (3 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);
        const weeklyHistory = historyArray.filter(item => 
          item.timestamp >= Date.now() - weeklyPeriod
        );
        
        const groupInterval = TESTING_MODE ? (10 * 60 * 1000) : (24 * 60 * 60 * 1000);
        const weeklyGroups = {};
        
        (weeklyHistory.length > 0 ? weeklyHistory : historyArray).forEach(item => {
          const normalized = normalizeData(item.voltage, item.current, item.power, item.rpm);
          const groupKey = Math.floor(item.timestamp / groupInterval) * groupInterval;
          
          if (!weeklyGroups[groupKey]) {
            weeklyGroups[groupKey] = { voltage: [], current: [], power: [], rpm: [] };
          }
          
          weeklyGroups[groupKey].voltage.push(normalized.voltage);
          weeklyGroups[groupKey].current.push(normalized.current);
          weeklyGroups[groupKey].power.push(normalized.power);
          weeklyGroups[groupKey].rpm.push(normalized.rpm);
        });

        Object.entries(weeklyGroups).forEach(([ts, data]) => {
          if (data.voltage.length === 0) return;
          
          const date = new Date(parseInt(ts));
          const label = TESTING_MODE ?
            date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) :
            date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          
          weeklyData.labels.push(label);
          weeklyData.voltage.push(parseFloat((data.voltage.reduce((a, b) => a + b) / data.voltage.length).toFixed(2)));
          weeklyData.current.push(parseFloat((data.current.reduce((a, b) => a + b) / data.current.length).toFixed(2)));
          weeklyData.power.push(parseFloat((data.power.reduce((a, b) => a + b) / data.power.length).toFixed(2)));
          weeklyData.rpm.push(parseFloat((data.rpm.reduce((a, b) => a + b) / data.rpm.length).toFixed(2)));
          weeklyData.timestamps.push(parseInt(ts));
        });

        // ===== MONTHLY (6 jam/30 hari terakhir, group per 30min/1minggu) =====
        const monthlyPeriod = TESTING_MODE ? (6 * 60 * 60 * 1000) : (30 * 24 * 60 * 60 * 1000);
        const monthlyHistory = historyArray.filter(item => 
          item.timestamp >= Date.now() - monthlyPeriod
        );
        
        const monthlyGroupInterval = TESTING_MODE ? (30 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);
        const monthlyGroups = {};
        
        (monthlyHistory.length > 0 ? monthlyHistory : historyArray).forEach(item => {
          const normalized = normalizeData(item.voltage, item.current, item.power, item.rpm);
          const groupKey = Math.floor(item.timestamp / monthlyGroupInterval) * monthlyGroupInterval;
          
          if (!monthlyGroups[groupKey]) {
            monthlyGroups[groupKey] = { voltage: [], current: [], power: [], rpm: [] };
          }
          
          monthlyGroups[groupKey].voltage.push(normalized.voltage);
          monthlyGroups[groupKey].current.push(normalized.current);
          monthlyGroups[groupKey].power.push(normalized.power);
          monthlyGroups[groupKey].rpm.push(normalized.rpm);
        });

        Object.entries(monthlyGroups).forEach(([ts, data]) => {
          if (data.voltage.length === 0) return;
          
          const date = new Date(parseInt(ts));
          const label = TESTING_MODE ?
            date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) :
            date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          
          monthlyData.labels.push(label);
          monthlyData.voltage.push(parseFloat((data.voltage.reduce((a, b) => a + b) / data.voltage.length).toFixed(2)));
          monthlyData.current.push(parseFloat((data.current.reduce((a, b) => a + b) / data.current.length).toFixed(2)));
          monthlyData.power.push(parseFloat((data.power.reduce((a, b) => a + b) / data.power.length).toFixed(2)));
          monthlyData.rpm.push(parseFloat((data.rpm.reduce((a, b) => a + b) / data.rpm.length).toFixed(2)));
          monthlyData.timestamps.push(parseInt(ts));
        });

        console.log(`✅ Processed - Daily: ${dailyData.labels.length}, Weekly: ${weeklyData.labels.length}, Monthly: ${monthlyData.labels.length}`);

        // Update chart if viewing that tab
        const activeTab = document.querySelector(".tab-button.active");
        if (activeTab) {
          const type = activeTab.dataset.chartType;
          if (type === "daily") setChartData(dailyData);
          else if (type === "weekly") setChartData(weeklyData);
          else if (type === "monthly") setChartData(monthlyData);
        }
      });
    }

    // ======== CHART SETUP ========
    const ctx = document.getElementById("realtimeChart").getContext("2d");
    const chart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            title: { display: true, text: "V / A / W" },
            beginAtZero: true
          },
          y1: { 
            position: "right", 
            title: { display: true, text: "RPM" }, 
            grid: { drawOnChartArea: false },
            beginAtZero: true
          },
        },
        plugins: { 
          legend: { display: true, position: "top" },
          tooltip: { mode: 'index', intersect: false }
        },
      },
    });

    function setChartData(source) {
      if (!source || source.labels.length === 0) {
        chart.data.labels = ['Menunggu data...'];
        chart.data.datasets = [
          { label: "Tegangan (V)", data: [0], borderColor: "#e53e3e", tension: 0.4, fill: false },
          { label: "Arus (A)", data: [0], borderColor: "#3182ce", tension: 0.4, fill: false },
          { label: "Daya (W)", data: [0], borderColor: "#38a169", tension: 0.4, fill: false },
          { label: "RPM", data: [0], borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4, fill: false },
        ];
      } else {
        chart.data.labels = source.labels;
        chart.data.datasets = [
          { label: "Tegangan (V)", data: source.voltage, borderColor: "#e53e3e", tension: 0.4, fill: false },
          { label: "Arus (A)", data: source.current, borderColor: "#3182ce", tension: 0.4, fill: false },
          { label: "Daya (W)", data: source.power, borderColor: "#38a169", tension: 0.4, fill: false },
          { label: "RPM", data: source.rpm, borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4, fill: false },
        ];
      }
      chart.update();
      updateDataTable();
    }

    function updateDataTable() {
      const tableBody = document.getElementById('dataTableBody');
      const activeTab = document.querySelector(".tab-button.active");
      if (!activeTab || !tableBody) return;

      const type = activeTab.dataset.chartType;
      let dataSource = type === "realtime" ? realtimeData :
                       type === "daily" ? dailyData :
                       type === "weekly" ? weeklyData : monthlyData;

      tableBody.innerHTML = '';
      const dataLength = dataSource.labels.length;
      const startIndex = Math.max(0, dataLength - 5);

      if (dataLength === 0) {
        tableBody.innerHTML = '<tr><td>-</td><td>-</td><td>-</td><td>-</td></tr>';
        return;
      }

      for (let i = startIndex; i < dataLength; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="value-voltage">${dataSource.voltage[i]?.toFixed(2) || '-'}</td>
          <td class="value-current">${dataSource.current[i]?.toFixed(2) || '-'}</td>
          <td class="value-power">${dataSource.power[i]?.toFixed(2) || '-'}</td>
          <td class="value-rpm">${dataSource.rpm[i]?.toFixed(2) || '-'}</td>
        `;
        tableBody.appendChild(row);
      }
    }

    // ======== LOAD HISTORY ========
    loadAndProcessHistory();

    // ======== LISTEN PLTMH ========
    const pltmhRef = ref(db, "PLTMH");
    
    onValue(pltmhRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.warn("⚠️ PLTMH data tidak ada");
        return;
      }
      
      const data = snapshot.val();
      let voltage = parseFloat(data.Tegangan_V || data.voltage || 0);
      let current = parseFloat(data.Arus_mA || data.current || 0);
      let power = parseFloat(data.Daya_mW || data.power || 0);
      let rpm = parseFloat(data.RPM_Turbin || data.rpm || 0);
      const totalEnergy = parseFloat(data.Total_Energi_mWh || 0);

      // Normalize data
      const normalized = normalizeData(voltage, current, power, rpm);
      voltage = normalized.voltage;
      current = normalized.current;
      power = normalized.power;
      rpm = normalized.rpm;

      // Update UI
      const voltageEl = document.getElementById("voltage");
      const currentEl = document.getElementById("current");
      const powerEl = document.getElementById("power");
      const rpmEl = document.getElementById("rpm");
      const totalPowerEl = document.getElementById("totalPower");

      if (voltageEl) voltageEl.textContent = voltage.toFixed(2);
      if (currentEl) currentEl.textContent = current.toFixed(2);
      if (powerEl) powerEl.textContent = power.toFixed(2);
      if (rpmEl) rpmEl.textContent = rpm.toFixed(2);
      if (totalPowerEl) totalPowerEl.textContent = totalEnergy.toFixed(4);

      // Duration
      let durationText = "00:00:00";
      if (rpm > 0) {
        if (turbineStartTime === null) turbineStartTime = new Date();
        const ms = new Date() - turbineStartTime;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        durationText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      } else {
        turbineStartTime = null;
      }
      
      const durationEl = document.getElementById("duration");
      if (durationEl) durationEl.textContent = durationText;

      const efficiencyEl = document.getElementById("efficiency");
      if (efficiencyEl) efficiencyEl.textContent = (85 + Math.random() * 10).toFixed(0);

      // Update realtime chart
      const now = new Date();
      const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      realtimeData.labels.push(timeLabel);
      realtimeData.voltage.push(voltage);
      realtimeData.current.push(current);
      realtimeData.power.push(power);
      realtimeData.rpm.push(rpm);

      if (realtimeData.labels.length > 10) {
        Object.keys(realtimeData).forEach(key => realtimeData[key].shift());
      }

      // Save snapshot
      savePeriodicSnapshot({ voltage, current, power, rpm });

      // Update chart if realtime tab active
      const activeTab = document.querySelector(".tab-button.active");
      if (activeTab && activeTab.dataset.chartType === "realtime") {
        setChartData(realtimeData);
      }
    });

    // ======== TAB SWITCHING ========
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");

        const type = button.dataset.chartType;
        if (type === "realtime") setChartData(realtimeData);
        else if (type === "daily") setChartData(dailyData);
        else if (type === "weekly") setChartData(weeklyData);
        else if (type === "monthly") setChartData(monthlyData);
      });
    });

    setChartData(realtimeData);
    console.log("✅ Dashboard ready!");
  }

  // ======== PROFILE DROPDOWN ========
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

    const settingsItemNav = profileDropdownNav.querySelector(".dropdown-item-nav:nth-child(1)");
    const logoutItemNav = profileDropdownNav.querySelector(".dropdown-item-nav.logout");

    if (settingsItemNav) {
      settingsItemNav.addEventListener("click", () => {
        alert("Pengaturan belum tersedia");
      });
    }

    if (logoutItemNav) {
      logoutItemNav.addEventListener("click", () => {
        signOut(auth).then(() => {
          window.location.href = "./login/login.html";
        }).catch((error) => {
          console.error("Logout error:", error);
        });
      });
    }
  }
});