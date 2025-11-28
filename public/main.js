import { db } from "./auth/firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { auth } from "./auth/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initAiAssistant } from "./ai_assistant/ai.js";

// === Saat halaman siap ===
document.addEventListener("DOMContentLoaded", () => {
  const userAvatarNav = document.getElementById("userAvatarNav");
  const userNameNav = document.getElementById("userNameNav");

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
      
      if (userAvatarNav) userAvatarNav.textContent = initial;
      if (userNameNav) userNameNav.textContent = name;

      startDashboard(); // Mulai logika dasbor
      initAiAssistant(initial); // Mulai logika AI Assistant
    } else {
      window.location.href = "./login/login.html";
    }
  });

  // === LOGIKA DASHBOARD ===
  function startDashboard() {
    let realtimeData = { labels: [], voltage: [], current: [], power: [], rpm: [] };
    let turbineStartTime = null;

    const dailyData = {
      labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
      voltage: [12, 12.5, 13, 12.8, 12.7, 12.4],
      current: [2.5, 2.7, 3.2, 3.1, 2.9, 2.6],
      power: [30, 34, 41, 39, 36, 32],
      rpm: [420, 440, 480, 470, 460, 430]
    };

    const weeklyData = {
      labels: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
      voltage: [12.4, 12.6, 12.8, 12.7, 12.9, 12.5, 12.3],
      current: [2.8, 3.0, 3.1, 2.9, 3.2, 2.7, 2.6],
      power: [33, 37, 39, 36, 41, 32, 30],
      rpm: [430, 450, 470, 455, 480, 440, 420]
    };

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
      chart.data.labels = source.labels;
      chart.data.datasets = [
        { label: "Tegangan (V)", data: source.voltage, borderColor: "#e53e3e", tension: 0.4 },
        { label: "Arus (A)", data: source.current, borderColor: "#3182ce", tension: 0.4 },
        { label: "Daya (W)", data: source.power, borderColor: "#38a169", tension: 0.4 },
        { label: "RPM", data: source.rpm, borderColor: "#d69e2e", yAxisID: "y1", tension: 0.4 },
      ];
      chart.update();
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

    onValue(pltmhRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();

      const voltage = data.Tegangan_V || 0;
      const current = data.Arus_mA || 0;
      const power = data.Daya_mW || 0;
      const rpm = data.RPM_Turbin || 0;
      const totalEnergy = data.Total_Energi_mWh || 0;

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

      // Tambah ke chart data
      const timeLabel = new Date().toLocaleTimeString();
      realtimeData.labels.push(timeLabel);
      realtimeData.voltage.push(voltage);
      realtimeData.current.push(current);
      realtimeData.power.push(power);
      realtimeData.rpm.push(rpm);

      // Keep only last 10 data points
      if (realtimeData.labels.length > 10) {
        Object.keys(realtimeData).forEach((key) => realtimeData[key].shift());
      }

      // Update chart and table if realtime tab is active
      const activeTab = document.querySelector(".tab-button.active");
      if (activeTab && activeTab.dataset.chartType === "realtime") {
        setChartData(realtimeData);
        updateDataTable(); // Update table with new data
      }
    });

    // === Ganti Tab ===
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const chartTitle = document.getElementById("chartTitle");

        if (btn.dataset.chartType === "realtime") {
          chartTitle.textContent = "Grafik Monitoring Real-time";
          setChartData(realtimeData);
          updateDataTable(); // Update table when switching to realtime
        } else if (btn.dataset.chartType === "daily") {
          chartTitle.textContent = "Grafik Monitoring Harian";
          setChartData(dailyData);
          updateDataTable(); // Update table when switching to daily
        } else if (btn.dataset.chartType === "weekly") {
          chartTitle.textContent = "Grafik Monitoring Mingguan";
          setChartData(weeklyData);
          updateDataTable(); // Update table when switching to weekly
        }
      });
    });

    // Set awal
    setChartData(realtimeData);
    updateDataTable(); // Initialize table on load
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
    }
  }
});