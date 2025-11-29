import { db, auth } from "../auth/firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// AUTO ACTIVE NAV
const path = window.location.pathname.toLowerCase();
document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(item => {
  if (path.includes(item.getAttribute("href").replace("../", "").toLowerCase())) {
    item.classList.add("active");
  }
});

// USER INFO
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  document.getElementById("userNameNav").textContent = name;
  document.getElementById("userAvatarNav").textContent = name.charAt(0).toUpperCase();
});

// DROPDOWN TOGGLE
document.getElementById("userInfoButton").addEventListener("click", () => {
  const dropdown = document.getElementById("profileDropdownNav");
  dropdown.classList.toggle("show");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const userInfo = document.getElementById("userInfoButton");
  const dropdown = document.getElementById("profileDropdownNav");
  
  if (!userInfo.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

// LOGOUT
document.getElementById("logoutButton").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "../login/login.html";
  });
});

// ==================== MAP INIT ====================
const map = L.map("deviceMap").setView([-2.5, 118], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let deviceMarkers = {};

// ==================== LOAD DEVICES FROM FIREBASE ====================
const deviceListEl = document.getElementById("deviceList");
const deviceRef = ref(db, "Devices");

// Show loading state
deviceListEl.innerHTML = "<p style='text-align:center; padding:20px; color:#5a7882;'>Loading devices...</p>";

onValue(deviceRef, snapshot => {
  deviceListEl.innerHTML = "";

  if (!snapshot.exists()) {
    deviceListEl.innerHTML = "<p style='text-align:center; padding:20px; color:#5a7882;'>Tidak ada device terdaftar.</p>";
    return;
  }

  const devices = snapshot.val();
  let deviceCount = 0;

  Object.keys(devices).forEach(id => {
    const d = devices[id];
    const isOnline = d.status === "online";
    deviceCount++;

    // ========== 1. Tampilkan ke Kartu Device ==========
    deviceListEl.innerHTML += `
      <div class="device-card">
        <h3>${d.name || "Unnamed Device"}</h3>

        <div class="device-status ${isOnline ? "online" : "offline"}">
          <span class="status-dot"></span>
          <span>${isOnline ? "Online" : "Offline"}</span>
        </div>

        <div class="device-info">
          <div class="info-item">
            <span>ID Device:</span>
            <strong>${id}</strong>
          </div>
          <div class="info-item">
            <span>Lokasi:</span>
            <strong>${d.location || "-"}</strong>
          </div>
          <div class="info-item">
            <span>Last Update:</span>
            <strong>${d.lastUpdate || "-"}</strong>
          </div>
        </div>

        <button class="btn-detail" onclick="alert('Detail device: ${d.name}')">Lihat Detail</button>
      </div>
    `;

    // ========== 2. Tampilkan Marker di MAP ==========
    if (d.lat && d.lng) {
      const lat = parseFloat(d.lat);
      const lng = parseFloat(d.lng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        if (!deviceMarkers[id]) {
          deviceMarkers[id] = L.marker([lat, lng]).addTo(map)
            .bindPopup(`
              <div style="text-align:center;">
                <b>${d.name || "Device"}</b><br>
                <small>ID: ${id}</small><br>
                <small>${d.location || "Unknown location"}</small><br>
                <span style="color:${isOnline ? '#38a169' : '#e53e3e'}">
                  ${isOnline ? '● Online' : '● Offline'}
                </span>
              </div>
            `);
        } else {
          deviceMarkers[id].setLatLng([lat, lng]);
          deviceMarkers[id].setPopupContent(`
            <div style="text-align:center;">
              <b>${d.name || "Device"}</b><br>
              <small>ID: ${id}</small><br>
              <small>${d.location || "Unknown location"}</small><br>
              <span style="color:${isOnline ? '#38a169' : '#e53e3e'}">
                ${isOnline ? '● Online' : '● Offline'}
              </span>
            </div>
          `);
        }
      }
    }
  });

  // Adjust map view to fit all markers
  if (deviceCount > 0 && Object.keys(deviceMarkers).length > 0) {
    const group = L.featureGroup(Object.values(deviceMarkers));
    map.fitBounds(group.getBounds().pad(0.1));
  }

  console.log(`✅ ${deviceCount} device(s) loaded from Firebase`);
}, error => {
  console.error("❌ Error loading devices:", error);
  
  let errorMessage = "Error loading devices.";
  
  if (error.code === "PERMISSION_DENIED") {
    errorMessage = "❌ Permission Denied: Silakan cek Firebase Realtime Database Rules.\n\nBuka Firebase Console → Realtime Database → Rules, lalu set:\n\n{\n  \"rules\": {\n    \".read\": \"auth != null\",\n    \".write\": \"auth != null\"\n  }\n}";
  }
  
  deviceListEl.innerHTML = `
    <div style="text-align:center; padding:40px 20px;">
      <div style="background: rgba(255,107,107,0.1); border: 1px solid #ff6b6b; border-radius: 12px; padding: 20px; max-width: 600px; margin: 0 auto;">
        <p style="color:#e53e3e; font-size:1rem; white-space: pre-line; margin: 0;">${errorMessage}</p>
      </div>
    </div>
  `;
});