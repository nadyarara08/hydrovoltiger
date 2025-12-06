import { db, auth } from "../auth/firebase-init.js";
import { ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// AUTO ACTIVE NAV
const path = window.location.pathname.toLowerCase();
document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(item => {
  if (path.includes(item.getAttribute("href").replace("../", "").toLowerCase())) {
    item.classList.add("active");
  }
});

// ==================== GEOLOCATION FUNCTION ====================
function requestUserLocation(user) {
  if (!navigator.geolocation) {
    console.warn("Geolocation is not supported by this browser.");
    return;
  }

  // Check if user has provided location before
  const userDeviceRef = ref(db, `Devices/user_${user.uid}`);
  
  onValue(userDeviceRef, (snapshot) => {
    if (!snapshot.exists() || !snapshot.val().lat || !snapshot.val().lng) {
      // If no location data exists, request permission
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Save user location data to Firebase
          const userDeviceData = {
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            lat: latitude,
            lng: longitude,
            location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            status: "online",
            lastUpdate: new Date().toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short"
            }),
            userId: user.uid,
            type: "user_device"
          };

          set(userDeviceRef, userDeviceData)
            .then(() => {
              console.log("✅ User location saved to Firebase");
            })
            .catch((error) => {
              console.error('❌ Failed to update device status:', error);
            });
        },
        (error) => {
          console.warn("⚠️ User denied location access or an error occurred:", error.message);
          
          // Save device without location
          const userDeviceData = {
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            lat: null,
            lng: null,
            location: "Location not available",
            status: "online",
            lastUpdate: new Date().toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short"
            }),
            userId: user.uid,
            type: "user_device"
          };

          set(userDeviceRef, userDeviceData)
            .catch((err) => console.error("❌ Error saving device:", err));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      // If location exists, only update status and lastUpdate
      update(userDeviceRef, {
        status: "online",
        lastUpdate: new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short"
        })
      });
    }
  }, { onlyOnce: true }); // onlyOnce to prevent loop
}

// ==================== UPDATE LOCATION PERIODICALLY ====================
function startLocationTracking(user) {
  // Update lokasi setiap 5 menit (300000 ms)
  setInterval(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userDeviceRef = ref(db, `Devices/user_${user.uid}`);
          
          update(userDeviceRef, {
            lat: latitude,
            lng: longitude,
            location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            status: "online",
            lastUpdate: new Date().toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short"
            })
          });
        },
        (error) => {
          console.warn("⚠️ Failed to update location:", error.message);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000
        }
      );
    }
  }, 300000); // 5 minutes
}

// ==================== SET USER OFFLINE ON LEAVE ====================
function setUserOffline(userId) {
  const userDeviceRef = ref(db, `Devices/user_${userId}`);
  update(userDeviceRef, {
    status: "offline",
    lastUpdate: new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    })
  });
}

// USER INFO
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  document.getElementById("userNameNav").textContent = name;
  document.getElementById("userAvatarNav").textContent = name.charAt(0).toUpperCase();

  // ✅ Minta izin lokasi saat user login
  requestUserLocation(user);
  
  // ✅ Mulai tracking lokasi periodik
  startLocationTracking(user);

  // ✅ Set offline ketika user menutup tab/browser
  window.addEventListener("beforeunload", () => {
    setUserOffline(user.uid);
  });

  // ✅ Set offline ketika user tidak aktif (opsional)
  let inactivityTimer;
  const resetInactivityTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      setUserOffline(user.uid);
    }, 600000); // 10 menit tidak aktif
  };

  document.addEventListener("mousemove", resetInactivityTimer);
  document.addEventListener("keypress", resetInactivityTimer);
  resetInactivityTimer();
});

// DROPDOWN TOGGLE
document.getElementById("userInfoButton").addEventListener("click", () => {
  const dropdown = document.getElementById("ProfileDropdownNav");
  dropdown.classList.toggle("show");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const userInfo = document.getElementById("userInfoButton");
  const dropdown = document.getElementById("ProfileDropdownNav");
  
  if (!userInfo.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

// LOGOUT FUNCTION - Now handled in Profile.js
const handleLogout = () => {
  const user = auth.currentUser;
  if (user) {
    setUserOffline(user.uid);
  }
  
  signOut(auth).then(() => {
    window.location.href = "../login/login.html";
  });
};

// Desktop logout button (in sidebar dropdown)
document.getElementById("logoutButton")?.addEventListener("click", handleLogout);

// ==================== MAP INIT ====================
const map = L.map("deviceMap").setView([-2.5, 118], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ========== ADD MAP LEGEND ==========
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function(map) {
  const div = L.DomUtil.create('div', 'map-legend');
  div.innerHTML = `
    <h4>Legend</h4>
    <div class="legend-item">
      <div class="legend-dot" style="background: #fbbf24;"></div>
      <span>Your Location</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background: #38a169;"></div>
      <span>Device Online</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background: #e53e3e;"></div>
      <span>Device Offline</span>
    </div>
  `;
  return div;
};

legend.addTo(map);

let deviceMarkers = {};

// ==================== LOAD DEVICES FROM FIREBASE ====================
const deviceListEl = document.getElementById("deviceList");
const deviceRef = ref(db, "Devices");

// Show loading state
deviceListEl.innerHTML = "<p style='text-align:center; padding:20px; color:#5a7882;'>Loading devices...</p>";

onValue(deviceRef, snapshot => {
  deviceListEl.innerHTML = "";

  if (!snapshot.exists()) {
    deviceListEl.innerHTML = "<p style='text-align:center; padding:20px; color:#5a7882;'>No registered devices.</p>";
    return;
  }

  const devices = snapshot.val();
  let deviceCount = 0;

  Object.keys(devices).forEach(id => {
    const d = devices[id];
    const isOnline = d.status === "online";
    deviceCount++;

    // Tentukan icon berdasarkan tipe device
    const deviceIcon = d.type === "user_device" ? "person-outline" : "hardware-chip-outline";
    const deviceTypeLabel = d.type === "user_device" ? "User Device" : "IoT Device";

    // ========== 1. Tampilkan ke Kartu Device ==========
    deviceListEl.innerHTML += `
      <div class="device-card">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <ion-icon name="${deviceIcon}" style="font-size: 24px; color: var(--accent-primary);"></ion-icon>
          <h3 style="margin: 0;">${d.name || "Unnamed Device"}</h3>
        </div>
        
        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 12px;">
          ${deviceTypeLabel}
        </div>

        <div class="device-status ${isOnline ? "online" : "offline"}">
          <span class="status-dot"></span>
          <span>${isOnline ? "Online" : "Offline"}</span>
        </div>

        <div class="device-info">
          <div class="info-item">
            <span>ID Device:</span>
            <strong>${id}</strong>
          </div>
          ${d.email ? `
          <div class="info-item">
            <span>Email:</span>
            <strong>${d.email}</strong>
          </div>
          ` : ''}
          <div class="info-item">
            <span>Location:</span>
            <strong>${d.location || "-"}</strong>
          </div>
          <div class="info-item">
            <span>Last Update:</span>
            <strong>${d.lastUpdate || "-"}</strong>
          </div>
        </div>

        <button class="btn-detail" onclick="alert('Detail device: ${d.name}\\nStatus: ${isOnline ? 'Online' : 'Offline'}\\nLocation: ${d.location || '-'}')">View Details</button>
      </div>
    `;

    // ========== 2. Tampilkan Marker di MAP ==========
    if (d.lat && d.lng) {
      const lat = parseFloat(d.lat);
      const lng = parseFloat(d.lng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        // Dapatkan user ID yang sedang login
        const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
        const isCurrentUser = d.userId && d.userId === currentUserId;
        
        // Pilih warna marker berdasarkan tipe dan status
        let markerColor;
        if (isCurrentUser) {
          // User yang sedang login = KUNING
          markerColor = '#fbbf24';
        } else if (d.type === "user_device") {
          // User lain = HIJAU (online) atau MERAH (offline)
          markerColor = isOnline ? '#38a169' : '#e53e3e';
        } else {
          // IoT Device = HIJAU (online) atau MERAH (offline)
          markerColor = isOnline ? '#38a169' : '#e53e3e';
        }

        if (!deviceMarkers[id]) {
          // Custom icon berdasarkan tipe
          const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          deviceMarkers[id] = L.marker([lat, lng], { icon: customIcon }).addTo(map)
            .bindPopup(`
              <div style="text-align:center; min-width: 150px;">
                <b>${d.name || "Device"}</b><br>
                ${isCurrentUser ? '<small style="color: #fbbf24; font-weight: 600;">🟡 Your Location</small><br>' : ''}
                <small style="color: #64748b;">${deviceTypeLabel}</small><br>
                <small>ID: ${id}</small><br>
                ${d.email ? `<small>📧 ${d.email}</small><br>` : ''}
                <small>📍 ${d.location || "Unknown location"}</small><br>
                <span style="color:${isOnline ? '#38a169' : '#e53e3e'}; font-weight: 600;">
                  ${isOnline ? '● Online' : '● Offline'}
                </span>
              </div>
            `);
        } else {
          // Update marker yang sudah ada
          const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          deviceMarkers[id].setIcon(customIcon);
          deviceMarkers[id].setLatLng([lat, lng]);
          deviceMarkers[id].setPopupContent(`
            <div style="text-align:center; min-width: 150px;">
              <b>${d.name || "Device"}</b><br>
              ${isCurrentUser ? '<small style="color: #fbbf24; font-weight: 600;">🟡 Your Location</small><br>' : ''}
              <small style="color: #64748b;">${deviceTypeLabel}</small><br>
              <small>ID: ${id}</small><br>
              ${d.email ? `<small>📧 ${d.email}</small><br>` : ''}
              <small>📍 ${d.location || "Unknown location"}</small><br>
              <span style="color:${isOnline ? '#38a169' : '#e53e3e'}; font-weight: 600;">
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
  
  let errorMessage = 'Failed to load device data.';
  
  if (error.code === "PERMISSION_DENIED") {
    errorMessage = "❌ Permission Denied: Please check Firebase Realtime Database Rules.\n\nOpen Firebase Console → Realtime Database → Rules, then set:\n\n{\n  \"rules\": {\n    \".read\": \"auth != null\",\n    \".write\": \"auth != null\"\n  }\n}";
  }
  
  deviceListEl.innerHTML = `
    <div style="text-align:center; padding:40px 20px;">
      <div style="background: rgba(255,107,107,0.1); border: 1px solid #ff6b6b; border-radius: 12px; padding: 20px; max-width: 600px; margin: 0 auto;">
        <p style="color:#e53e3e; font-size:1rem; white-space: pre-line; margin: 0;">${errorMessage}</p>
      </div>
    </div>
  `;
});