import { db } from "./auth/firebase-init.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { auth } from "./auth/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initAiAssistant } from "./ai_assistant/ai.js";

// === Saat halaman siap ===
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Page loaded, initializing...");
  
  const userAvatarNav = document.getElementById("userAvatarNav");
  const userNameNav = document.getElementById("userNameNav");

  // ======== CONNECTION INDICATOR ========
  const indicator = document.getElementById("connectionIndicator");
  const indicatorText = document.getElementById("indicatorText");
  const indicatorDot = document.getElementById("indicatorDot");

  const connectionRef = ref(db, ".info/connected");
  onValue(connectionRef, (snapshot) => {
    const connected = snapshot.val();
    console.log("🔌 Firebase Connection Status:", connected ? "ONLINE ✅" : "OFFLINE ❌");
    
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

  // === LOGIN CHECK ===
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ User logged in:", user.email);
      const name = user.displayName || user.email.split("@")[0];
      const initial = name.charAt(0).toUpperCase();
      
      if (userAvatarNav) userAvatarNav.textContent = initial;
      if (userNameNav) userNameNav.textContent = name;

      // Tunggu sebentar untuk memastikan DOM siap
      setTimeout(() => {
        startDashboard(); // Mulai logika dasbor
        initAiAssistant(initial); // Mulai logika AI Assistant
      }, 500);
    } else {
      console.log("❌ No user logged in, redirecting to login...");
      window.location.href = "./login/login.html";
    }
  });

  // === LOGIKA DASHBOARD ===
  function startDashboard() {
    console.log("📊 Starting Dashboard...");
    
    // Cek apakah semua elemen DOM ada
    const requiredElements = ['voltage', 'current', 'power', 'rpm', 'totalPower', 'duration', 'efficiency', 'realtimeChart', 'dataTableBody'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
      console.error("❌ Missing DOM elements:", missingElements);
      return;
    }
    
    console.log("✅ All DOM elements found");
    
    let realtimeData = { labels: [], voltage: [], current: [], power: [], rpm: [] };
    let dailyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
    let weeklyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
    let monthlyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
    let turbineStartTime = null;
    let lastProcessedDay = null;
    let lastProcessedWeek = null;
    let lastProcessedMonth = null;

    // Fungsi untuk mendapatkan timestamp awal hari ini
    function getStartOfDay(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    // Fungsi untuk memeriksa apakah dua tanggal berbeda hari
    function isDifferentDay(date1, date2) {
      return date1.getDate() !== date2.getDate() ||
             date1.getMonth() !== date2.getMonth() ||
             date1.getFullYear() !== date2.getFullYear();
    }

    // Fungsi untuk memeriksa apakah dua tanggal berbeda minggu
    function isDifferentWeek(date1, date2) {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 7;
    }

    // Fungsi untuk memeriksa apakah dua tanggal berbeda bulan
    function isDifferentMonth(date1, date2) {
      return date1.getMonth() !== date2.getMonth() ||
             date1.getFullYear() !== date2.getFullYear();
    }

    // Fungsi untuk memproses data harian
    function processDailyData(currentData) {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const todayStart = getStartOfDay(now);
      
      // Cari indeks data hari ini
      const todayIndex = dailyData.timestamps.findIndex(ts => {
        const date = new Date(ts);
        return date.getDate() === now.getDate() && 
               date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear();
      });
      
      // Hitung rata-rata semua data hari ini
      const todayRealtimeData = {
        voltage: [...(todayIndex >= 0 ? [dailyData.voltage[todayIndex]] : []), currentData.voltage[0]],
        current: [...(todayIndex >= 0 ? [dailyData.current[todayIndex]] : []), currentData.current[0]],
        power: [...(todayIndex >= 0 ? [dailyData.power[todayIndex]] : []), currentData.power[0]],
        rpm: [...(todayIndex >= 0 ? [dailyData.rpm[todayIndex]] : []), currentData.rpm[0]]
      };
      
      const avgVoltage = todayRealtimeData.voltage.reduce((a, b) => a + b, 0) / todayRealtimeData.voltage.length;
      const avgCurrent = todayRealtimeData.current.reduce((a, b) => a + b, 0) / todayRealtimeData.current.length;
      const avgPower = todayRealtimeData.power.reduce((a, b) => a + b, 0) / todayRealtimeData.power.length;
      const avgRpm = todayRealtimeData.rpm.reduce((a, b) => a + b, 0) / todayRealtimeData.rpm.length;
      
      if (todayIndex >= 0) {
        // Update data hari ini
        dailyData.voltage[todayIndex] = parseFloat(avgVoltage.toFixed(2));
        dailyData.current[todayIndex] = parseFloat(avgCurrent.toFixed(2));
        dailyData.power[todayIndex] = parseFloat(avgPower.toFixed(2));
        dailyData.rpm[todayIndex] = parseFloat(avgRpm.toFixed(2));
      } else {
        // Tambah data hari baru
        dailyData.labels.push(now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
        dailyData.voltage.push(parseFloat(avgVoltage.toFixed(2)));
        dailyData.current.push(parseFloat(avgCurrent.toFixed(2)));
        dailyData.power.push(parseFloat(avgPower.toFixed(2)));
        dailyData.rpm.push(parseFloat(avgRpm.toFixed(2)));
        dailyData.timestamps.push(now.getTime());
      }
      
      // Simpan timestamp hari terakhir diproses
      lastProcessedDay = now.getTime();

      // Hapus data lama jika lebih dari 7 hari
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      const recentData = dailyData.timestamps.map((ts, i) => ({
        ts,
        index: i
      })).filter(item => item.ts >= sevenDaysAgo);

      // Perbarui data harian dengan hanya data 7 hari terakhir
      if (recentData.length < dailyData.timestamps.length) {
        const newData = {
          labels: [],
          voltage: [],
          current: [],
          power: [],
          rpm: [],
          timestamps: []
        };

        recentData.forEach(item => {
          newData.labels.push(dailyData.labels[item.index]);
          newData.voltage.push(dailyData.voltage[item.index]);
          newData.current.push(dailyData.current[item.index]);
          newData.power.push(dailyData.power[item.index]);
          newData.rpm.push(dailyData.rpm[item.index]);
          newData.timestamps.push(dailyData.timestamps[item.index]);
        });

        dailyData = newData;
      }

      // Proses data mingguan jika sudah 7 hari
      if (dailyData.timestamps.length >= 7) {
        processWeeklyData();
      }
    }

    // Fungsi untuk memproses data mingguan
    function processWeeklyData() {
      if (dailyData.timestamps.length < 7) return;

      const now = new Date();
      const lastWeekData = {
        voltage: dailyData.voltage.slice(-7),
        current: dailyData.current.slice(-7),
        power: dailyData.power.slice(-7),
        rpm: dailyData.rpm.slice(-7)
      };

      const avgVoltage = lastWeekData.voltage.reduce((a, b) => a + b, 0) / 7;
      const avgCurrent = lastWeekData.current.reduce((a, b) => a + b, 0) / 7;
      const avgPower = lastWeekData.power.reduce((a, b) => a + b, 0) / 7;
      const avgRpm = lastWeekData.rpm.reduce((a, b) => a + b, 0) / 7;

      weeklyData.labels.push(now.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }));
      weeklyData.voltage.push(parseFloat(avgVoltage.toFixed(2)));
      weeklyData.current.push(parseFloat(avgCurrent.toFixed(2)));
      weeklyData.power.push(parseFloat(avgPower.toFixed(2)));
      weeklyData.rpm.push(parseFloat(avgRpm.toFixed(2)));
      weeklyData.timestamps.push(now.getTime());

      // Hapus data lama jika lebih dari 4 minggu
      const fourWeeksAgo = now.getTime() - (28 * 24 * 60 * 60 * 1000);
      const recentWeeklyData = weeklyData.timestamps.map((ts, i) => ({
        ts,
        index: i
      })).filter(item => item.ts >= fourWeeksAgo);

      if (recentWeeklyData.length < weeklyData.timestamps.length) {
        const newData = {
          labels: [],
          voltage: [],
          current: [],
          power: [],
          rpm: [],
          timestamps: []
        };

        recentWeeklyData.forEach(item => {
          newData.labels.push(weeklyData.labels[item.index]);
          newData.voltage.push(weeklyData.voltage[item.index]);
          newData.current.push(weeklyData.current[item.index]);
          newData.power.push(weeklyData.power[item.index]);
          newData.rpm.push(weeklyData.rpm[item.index]);
          newData.timestamps.push(weeklyData.timestamps[item.index]);
        });

        weeklyData = newData;
      }

      // Proses data bulanan jika sudah 4 minggu
      if (weeklyData.timestamps.length >= 4) {
        processMonthlyData();
      }
    }

    // Fungsi untuk memproses data bulanan
    function processMonthlyData() {
      if (weeklyData.timestamps.length < 4) return;

      const now = new Date();
      const lastMonthData = {
        voltage: weeklyData.voltage.slice(-4),
        current: weeklyData.current.slice(-4),
        power: weeklyData.power.slice(-4),
        rpm: weeklyData.rpm.slice(-4)
      };

      const avgVoltage = lastMonthData.voltage.reduce((a, b) => a + b, 0) / 4;
      const avgCurrent = lastMonthData.current.reduce((a, b) => a + b, 0) / 4;
      const avgPower = lastMonthData.power.reduce((a, b) => a + b, 0) / 4;
      const avgRpm = lastMonthData.rpm.reduce((a, b) => a + b, 0) / 4;

      monthlyData.labels.push(now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }));
      monthlyData.voltage.push(parseFloat(avgVoltage.toFixed(2)));
      monthlyData.current.push(parseFloat(avgCurrent.toFixed(2)));
      monthlyData.power.push(parseFloat(avgPower.toFixed(2)));
      monthlyData.rpm.push(parseFloat(avgRpm.toFixed(2)));
      monthlyData.timestamps.push(now.getTime());

      // Hapus data lama jika lebih dari 12 bulan
      const oneYearAgo = now.getTime() - (365 * 24 * 60 * 60 * 1000);
      const recentMonthlyData = monthlyData.timestamps.map((ts, i) => ({
        ts,
        index: i
      })).filter(item => item.ts >= oneYearAgo);

      if (recentMonthlyData.length < monthlyData.timestamps.length) {
        const newData = {
          labels: [],
          voltage: [],
          current: [],
          power: [],
          rpm: [],
          timestamps: []
        };

        recentMonthlyData.forEach(item => {
          newData.labels.push(monthlyData.labels[item.index]);
          newData.voltage.push(monthlyData.voltage[item.index]);
          newData.current.push(monthlyData.current[item.index]);
          newData.power.push(monthlyData.power[item.index]);
          newData.rpm.push(monthlyData.rpm[item.index]);
          newData.timestamps.push(monthlyData.timestamps[item.index]);
        });

        monthlyData = newData;
      }
    }

    // === INITIALIZE CHART ===
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

    console.log("✅ Chart initialized");

    function setChartData(source) {
      if (!source || !source.labels || source.labels.length === 0) {
        // Jika tidak ada data, tampilkan pesan
        chart.data.labels = ['Menunggu data...'];
        chart.data.datasets = [
          { label: "Tegangan (V)", data: [0], borderColor: "#e53e3e", tension: 0.4, fill: false },
          { label: "Arus (A)", data: [0], borderColor: "#3182ce", tension: 0.4, fill: false },
          { label: "Daya (W)", data: [0], borderColor: "#38a169", tension: 0.4, fill: false },
          { label: "RPM", data: [0], borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4, fill: false },
        ];
      } else {
        // Tampilkan data yang ada
        chart.data.labels = source.labels;
        chart.data.datasets = [
          { label: "Tegangan (V)", data: source.voltage || [], borderColor: "#e53e3e", tension: 0.4, fill: false },
          { label: "Arus (A)", data: source.current || [], borderColor: "#3182ce", tension: 0.4, fill: false },
          { label: "Daya (W)", data: source.power || [], borderColor: "#38a169", tension: 0.4, fill: false },
          { label: "RPM", data: source.rpm || [], borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4, fill: false },
        ];
      }

      // Update chart
      chart.update();

      // Update tabel data
      updateDataTable();
    }

    // === UPDATE DATA TABLE FUNCTION ===
    function updateDataTable() {
      const tableBody = document.getElementById('dataTableBody');
      const activeTab = document.querySelector(".tab-button.active");

      if (!activeTab || !tableBody) return;

      const chartType = activeTab.dataset.chartType;
      let dataSource;

      if (chartType === "realtime") {
        dataSource = realtimeData;
      } else if (chartType === "daily") {
        dataSource = dailyData;
      } else if (chartType === "weekly") {
        dataSource = weeklyData;
      } else if (chartType === "monthly") {
        dataSource = monthlyData;
      }

      // Clear existing rows
      tableBody.innerHTML = '';

      // Get the latest 5 data points
      const dataLength = dataSource.labels.length;
      const startIndex = Math.max(0, dataLength - 5);

      // If no data, show empty state
      if (dataLength === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="value-voltage">-</td>
          <td class="value-current">-</td>
          <td class="value-power">-</td>
          <td class="value-rpm">-</td>
        `;
        tableBody.appendChild(row);
        return;
      }

      // Populate table with latest data
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

    // === REALTIME DATABASE ===
    const pltmhRef = ref(db, "PLTMH");
    const historyRef = ref(db, "history");

    // Fungsi untuk memuat data histori saat pertama kali aplikasi dimuat
    function loadHistoryData() {
      console.log("📚 Loading history data...");
      
      onValue(historyRef, (snapshot) => {
        if (!snapshot.exists()) {
          console.log("📚 No history data found - Starting fresh");
          return;
        }

        const history = snapshot.val();
        const now = new Date();
        const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);

        console.log("📚 History data loaded:", Object.keys(history).length, "entries");

        // Reset data
        dailyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
        weeklyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };
        monthlyData = { labels: [], voltage: [], current: [], power: [], rpm: [], timestamps: [] };

        // Proses data histori
        Object.entries(history).forEach(([timestamp, data]) => {
          const ts = parseInt(timestamp);
          const date = new Date(ts);

          // Tambahkan ke data harian jika dalam 24 jam terakhir
          if (ts >= oneDayAgo) {
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const dayStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

            // Cek apakah data untuk jam ini sudah ada
            const existingIndex = dailyData.labels.findIndex((label, i) =>
              dailyData.timestamps[i] >= getStartOfDay(date) &&
              dailyData.timestamps[i] < getStartOfDay(date) + (24 * 60 * 60 * 1000)
            );

            if (existingIndex === -1) {
              dailyData.labels.push(dayStr);
              dailyData.voltage.push(parseFloat(data.voltage || 0));
              dailyData.current.push(parseFloat(data.current || 0));
              dailyData.power.push(parseFloat(data.power || 0));
              dailyData.rpm.push(parseFloat(data.rpm || 0));
              dailyData.timestamps.push(ts);
            }
          }
        });

        // Set last processed time
        if (dailyData.timestamps.length > 0) {
          lastProcessedDay = Math.max(...dailyData.timestamps);
        }

        console.log("📚 Daily data processed:", dailyData.labels.length, "entries");

        // Update chart jika tab daily aktif
        const activeTab = document.querySelector(".tab-button.active");
        if (activeTab && activeTab.dataset.chartType === "daily") {
          setChartData(dailyData);
        }
      }, (error) => {
        console.error("❌ Error loading history:", error);
      });
    }

    // Panggil fungsi untuk memuat data histori
    loadHistoryData();

    // Fungsi untuk menyimpan data ke Firebase
    function saveToHistory(data) {
      const timestamp = new Date().getTime();
      const historyRef = ref(db, `history/${timestamp}`);

      // Simpan data ke Firebase
      set(historyRef, {
        voltage: parseFloat(data.voltage || 0).toFixed(2),
        current: parseFloat(data.current || 0).toFixed(2),
        power: parseFloat(data.power || 0).toFixed(2),
        rpm: parseFloat(data.rpm || 0).toFixed(2),
        timestamp: timestamp
      }).catch((error) => {
        console.error("❌ Error saving history:", error);
      });
    }

    // === LISTEN UNTUK PERUBAHAN DATA REALTIME ===
    console.log("👂 Setting up PLTMH listener...");
    console.log("📍 Database path: PLTMH");
    
    onValue(pltmhRef, (snapshot) => {
      console.log("📡 Data snapshot received");
      console.log("🔍 Snapshot exists:", snapshot.exists());
      
      if (!snapshot.exists()) {
        console.warn("⚠️ PLTMH data does not exist in Firebase!");
        console.log("💡 Troubleshooting:");
        console.log("1. Buka Firebase Console: https://console.firebase.google.com/");
        console.log("2. Pilih project: hydrovoltiger-e2d28");
        console.log("3. Buka Realtime Database");
        console.log("4. Pastikan ada node 'PLTMH' dengan struktur:");
        console.log(`{
  "PLTMH": {
    "Tegangan_V": 220,
    "Arus_mA": 5,
    "Daya_mW": 1100,
    "RPM_Turbin": 1500,
    "Total_Energi_mWh": 100
  }
}`);
        
        // Tampilkan data dummy untuk development
        console.log("🔧 Using dummy data for development");
        return;
      }
      
      const data = snapshot.val();
      console.log("📦 Raw Firebase data:", data);
      console.log("📋 Available keys:", Object.keys(data));

      // Parse data dengan validasi
      const voltage = parseFloat(data.Tegangan_V || data.tegangan || data.voltage || 0);
      const current = parseFloat(data.Arus_mA || data.arus || data.current || 0);
      const power = parseFloat(data.Daya_mW || data.daya || data.power || 0);
      const rpm = parseFloat(data.RPM_Turbin || data.rpm || data.RPM || 0);
      const totalEnergy = parseFloat(data.Total_Energi_mWh || data.totalEnergy || 0);

      console.log("✅ Parsed values:", { voltage, current, power, rpm, totalEnergy });

      // Validasi data
      if (isNaN(voltage) || isNaN(current) || isNaN(power) || isNaN(rpm)) {
        console.error("❌ Invalid data received - some values are NaN");
        return;
      }

      // Simpan data ke histori
      saveToHistory({
        voltage: voltage,
        current: current,
        power: power,
        rpm: rpm
      });

      // Update card di dashboard
      const voltageEl = document.getElementById("voltage");
      const currentEl = document.getElementById("current");
      const powerEl = document.getElementById("power");
      const rpmEl = document.getElementById("rpm");
      const totalPowerEl = document.getElementById("totalPower");

      console.log("🎯 Updating DOM elements...");
      
      if (voltageEl) {
        voltageEl.textContent = voltage.toFixed(2);
        console.log("✅ Voltage updated:", voltage.toFixed(2));
      } else {
        console.error("❌ Voltage element not found");
      }
      
      if (currentEl) {
        currentEl.textContent = current.toFixed(2);
        console.log("✅ Current updated:", current.toFixed(2));
      } else {
        console.error("❌ Current element not found");
      }
      
      if (powerEl) {
        powerEl.textContent = power.toFixed(2);
        console.log("✅ Power updated:", power.toFixed(2));
      } else {
        console.error("❌ Power element not found");
      }
      
      if (rpmEl) {
        rpmEl.textContent = rpm.toFixed(2);
        console.log("✅ RPM updated:", rpm.toFixed(2));
      } else {
        console.error("❌ RPM element not found");
      }
      
      if (totalPowerEl) {
        totalPowerEl.textContent = totalEnergy.toFixed(4);
        console.log("✅ Total power updated:", totalEnergy.toFixed(4));
      } else {
        console.error("❌ Total power element not found");
      }

      // Duration calculation
      let durationText = "00:00:00";
      if (rpm > 0) {
        if (turbineStartTime === null) {
          turbineStartTime = new Date();
        }
        const durationMs = new Date() - turbineStartTime;
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        durationText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        turbineStartTime = null;
      }
      
      const durationEl = document.getElementById("duration");
      if (durationEl) durationEl.textContent = durationText;

      const efficiencyEl = document.getElementById("efficiency");
      if (efficiencyEl) efficiencyEl.textContent = (85 + Math.random() * 10).toFixed(0);

      // Tambah ke chart data realtime
      const now = new Date();
      const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      realtimeData.labels.push(timeLabel);
      realtimeData.voltage.push(voltage);
      realtimeData.current.push(current);
      realtimeData.power.push(power);
      realtimeData.rpm.push(rpm);

      console.log("📊 Realtime data updated, total points:", realtimeData.labels.length);

      // Keep only last 10 data points untuk realtime
      if (realtimeData.labels.length > 10) {
        Object.keys(realtimeData).forEach((key) => realtimeData[key].shift());
      }

      // Proses data untuk harian, mingguan, dan bulanan
      processDailyData({
        voltage: [voltage],
        current: [current],
        power: [power],
        rpm: [rpm]
      });

      // Update chart and table if realtime tab is active
      const activeTab = document.querySelector(".tab-button.active");
      if (activeTab && activeTab.dataset.chartType === "realtime") {
        setChartData(realtimeData);
        updateDataTable();
        console.log("✅ Chart and table updated");
      }
      
      console.log("✅ Data processing complete");
      
    }, (error) => {
      console.error("❌ Firebase PLTMH Error:", error);
      console.error("📋 Error details:");
      console.error("  - Code:", error.code);
      console.error("  - Message:", error.message);
      
      if (error.code === "PERMISSION_DENIED") {
        console.error("🚫 PERMISSION DENIED!");
        console.log("💡 Solutions:");
        console.log("1. Check Firebase Rules in Console");
        console.log("2. Make sure you're authenticated");
        console.log("3. Current user:", auth.currentUser?.email || "NOT LOGGED IN");
        console.log("4. Try this Firebase rule:");
        console.log(`{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}`);
      }
    });

    // === Ganti Tab ===
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        console.log("🔄 Switching tab to:", button.dataset.chartType);
        
        document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        if (button.dataset.chartType === "realtime") {
          setChartData(realtimeData);
        } else if (button.dataset.chartType === "daily") {
          setChartData(dailyData);
        } else if (button.dataset.chartType === "weekly") {
          setChartData(weeklyData);
        } else if (button.dataset.chartType === "monthly") {
          setChartData(monthlyData);
        }
      });
    });

    // Set awal
    setChartData(realtimeData);
    updateDataTable();
    
    console.log("✅ Dashboard initialized successfully");
  }

  // === DROPDOWN PROFILE SIDEBAR ===
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
        const toast = document.createElement("div");
        toast.className = "toast-message";
        toast.textContent = "Pengaturan belum tersedia";
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add("show"), 100);
        setTimeout(() => {
          toast.classList.remove("show");
          setTimeout(() => toast.remove(), 300);
        }, 2000);
      });
    }

    if (logoutItemNav) {
      logoutItemNav.addEventListener("click", () => {
        console.log("🚪 Logging out...");
        
        const toast = document.createElement("div");
        toast.className = "toast-message";
        toast.textContent = "Memproses logout...";
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add("show"), 100);

        signOut(auth)
          .then(() => {
            console.log("✅ Logout successful");
            toast.textContent = "Logout berhasil!";
            setTimeout(() => {
              window.location.href = "./login/login.html";
            }, 700);
          })
          .catch((error) => {
            console.error("❌ Logout error:", error);
            toast.textContent = "Terjadi kesalahan saat logout. Silahkan coba lagi.";
            setTimeout(() => {
              toast.classList.remove("show");
              setTimeout(() => toast.remove(), 300);
            }, 2000);
          });
      });
    }
  }
});