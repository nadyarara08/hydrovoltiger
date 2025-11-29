import { db } from "./auth/firebase-init.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { auth } from "./auth/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initAiAssistant } from "./ai_assistant/ai.js";

// === Saat halaman siap ===
document.addEventListener("DOMContentLoaded", () => {
  const miniAvatar = document.querySelector(".user-avatar-header");
  const userNameEl = document.querySelector(".user-name");

  // ======== CONNECTION INDICATOR ========
  const indicator = document.getElementById("connectionIndicator");
  const indicatorText = document.getElementById("indicatorText");
  const indicatorDot = document.getElementById("indicatorDot");

  const connectionRef = ref(db, ".info/connected");
  onValue(connectionRef, (snapshot) => {
    const connected = snapshot.val();
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
      const name = user.displayName || user.email.split("@")[0];
      const initial = name.charAt(0).toUpperCase();
      miniAvatar.textContent = initial;
      userNameEl.textContent = name;

      miniAvatar.style.visibility = "visible";
      userNameEl.style.visibility = "visible";

      startDashboard(); // Mulai logika dasbor
      initAiAssistant(initial); // Mulai logika AI Assistant
    } else {
      window.location.href = "./login/login.html";
    }
  });

  // === LOGIKA DASHBOARD ===
  function startDashboard() {
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

    const ctx = document.getElementById("realtimeChart").getContext("2d");
    const chart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { title: { display: true, text: "V / A / W" } },
          y1: { position: "right", title: { display: true, text: "RPM" }, grid: { drawOnChartArea: false } },
        },
        plugins: { legend: { display: true, position: "top" } },
      },
    });

    function setChartData(source) {
      if (!source || !source.labels || source.labels.length === 0) {
        // Jika tidak ada data, tampilkan pesan
        chart.data.labels = ['Tidak ada data'];
        chart.data.datasets = [
          { label: "Tegangan (V)", data: [0], borderColor: "#e53e3e", tension: 0.4 },
          { label: "Arus (A)", data: [0], borderColor: "#3182ce", tension: 0.4 },
          { label: "Daya (W)", data: [0], borderColor: "#38a169", tension: 0.4 },
          { label: "RPM", data: [0], borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4 },
        ];
      } else {
        // Tampilkan data yang ada
        chart.data.labels = source.labels;
        chart.data.datasets = [
          { label: "Tegangan (V)", data: source.voltage || [], borderColor: "#e53e3e", tension: 0.4 },
          { label: "Arus (A)", data: source.current || [], borderColor: "#3182ce", tension: 0.4 },
          { label: "Daya (W)", data: source.power || [], borderColor: "#38a169", tension: 0.4 },
          { label: "RPM", data: source.rpm || [], borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4 },
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
      onValue(historyRef, (snapshot) => {
        if (!snapshot.exists()) return;

        const history = snapshot.val();
        const now = new Date();
        const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);

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

        // Update chart jika tab daily aktif
        const activeTab = document.querySelector(".tab-button.active");
        if (activeTab && activeTab.dataset.chartType === "daily") {
          setChartData(dailyData);
        }
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
      });
    }

    // Listen untuk perubahan data realtime
    onValue(pltmhRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();

      const voltage = parseFloat(data.Tegangan_V || 0);
      const current = parseFloat(data.Arus_mA || 0);
      const power = parseFloat(data.Daya_mW || 0);
      const rpm = parseFloat(data.RPM_Turbin || 0);
      const totalEnergy = parseFloat(data.Total_Energi_mWh || 0);

      // Simpan data ke histori
      saveToHistory({
        voltage: voltage,
        current: current,
        power: power,
        rpm: rpm
      });

      // Update card di dashboard
      document.getElementById("voltage").textContent = voltage.toFixed(2);
      document.getElementById("current").textContent = current.toFixed(2);
      document.getElementById("power").textContent = power.toFixed(2);
      document.getElementById("rpm").textContent = rpm.toFixed(2);
      document.getElementById("totalPower").textContent = totalEnergy.toFixed(4);

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
      document.getElementById("duration").textContent = durationText;

      document.getElementById("efficiency").textContent = (85 + Math.random() * 10).toFixed(0);

      // Tambah ke chart data realtime
      const now = new Date();
      const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      realtimeData.labels.push(timeLabel);
      realtimeData.voltage.push(voltage);
      realtimeData.current.push(current);
      realtimeData.power.push(power);
      realtimeData.rpm.push(rpm);

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
        updateDataTable(); // Update table with new data
      }
    });

    // === Ganti Tab ===
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        if (button.dataset.chartType === "realtime") {
          setChartData(realtimeData);
        } else if (button.dataset.chartType === "daily") {
          setChartData(dailyData);
        } else if (button.dataset.chartType === "weekly") {
          setChartData(weeklyData);
          updateDataTable(); // Update table when switching to weekly
        }
      });
    });

    // Set awal
    setChartData(realtimeData);
    updateDataTable(); // Initialize table on load
  }

  // === DROPDOWN PROFILE ===
  const userInfoButton = document.getElementById("userInfoButton");
  const profileDropdown = document.getElementById("profileDropdown");
  const dropdownIcon = document.getElementById("dropdownIcon");

  userInfoButton.addEventListener("click", () => {
    profileDropdown.classList.toggle("show");
    dropdownIcon.classList.toggle("rotated");
  });

  document.addEventListener("click", (e) => {
    if (!userInfoButton.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.classList.remove("show");
      dropdownIcon.classList.remove("rotated");
    }
  });

  // === AKSI TOMBOL DROPDOWN ===
  const profileItem = profileDropdown.querySelector(".dropdown-item:nth-child(1)");
  const settingsItem = profileDropdown.querySelector(".dropdown-item:nth-child(2)");
  const logoutItem = profileDropdown.querySelector(".dropdown-item.logout");

  profileItem.addEventListener("click", () => {
    window.location.href = "./profile/profile.html";
  });

  settingsItem.addEventListener("click", () => {
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

  logoutItem.addEventListener("click", () => {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = "Memproses logout...";
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add("show"), 100);

    signOut(auth)
      .then(() => {
        toast.textContent = "Logout berhasil!";
        setTimeout(() => {
          window.location.href = "./login/login.html";
        }, 700);
      })
      .catch((error) => {
        console.error("Gagal logout:", error);
        toast.textContent = "Terjadi kesalahan saat logout. Silahkan coba lagi.";
        setTimeout(() => {
          toast.classList.remove("show");
          setTimeout(() => toast.remove(), 300);
        }, 2000);
      });
  });
});