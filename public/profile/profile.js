import { auth } from "../auth/firebase-init.js";
import { 
  onAuthStateChanged, 
  deleteUser, 
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Profile elements
const profileName = document.getElementById("userName");
const profileEmail = document.getElementById("userEmail");
const profileAvatar = document.getElementById("avatarLarge");
const joinDateEl = document.getElementById("joinDate");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const notificationToggle = document.getElementById("notificationToggle");
const securityBtn = document.getElementById("securityBtn");

// Sidebar elements
const userAvatarNav = document.getElementById("userAvatarNav");
const userNameNav = document.getElementById("userNameNav");
const userInfoButton = document.getElementById("userInfoButton");
const profileDropdownNav = document.getElementById("profileDropdownNav");
const logoutButton = document.getElementById("logoutButton");

const colors = [
  "#f44336", "#e91e63", "#9c27b0", "#3f51b5", 
  "#2196f3", "#009688", "#4caf50", "#ff9800", "#795548"
];

function getColorFromName(name) {
  if (!name) return colors[0];
  let index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('id-ID', options);
}

// === TAMPILKAN DATA USER ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    const name = user.displayName || "Pengguna";
    const email = user.email;
    const initial = name.charAt(0).toUpperCase();
    const color = getColorFromName(name);
    const joinDate = user.metadata.creationTime;

    // Update profile card
    profileName.textContent = name;
    profileEmail.textContent = email;
    profileAvatar.textContent = initial;
    profileAvatar.style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)})`;
    joinDateEl.textContent = formatDate(joinDate);

    // Update sidebar
    userNameNav.textContent = name;
    userAvatarNav.textContent = initial;
    userAvatarNav.style.background = `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)})`;
    
  } else {
    window.location.href = "../register/register.html"; 
  }
});

// Helper function to adjust color brightness
function adjustColor(color, amount) {
  const clamp = (val) => Math.min(Math.max(val, 0), 255);
  const num = parseInt(color.replace("#", ""), 16);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00FF) + amount);
  const b = clamp((num & 0x0000FF) + amount);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// === DROPDOWN TOGGLE ===
userInfoButton?.addEventListener("click", (e) => {
  e.stopPropagation();
  profileDropdownNav.classList.toggle("show");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!userInfoButton?.contains(e.target)) {
    profileDropdownNav?.classList.remove("show");
  }
});

// === LOGOUT FUNCTIONALITY ===
logoutButton?.addEventListener("click", async () => {
  const confirm = window.confirm("Apakah Anda yakin ingin keluar?");
  if (!confirm) return;

  try {
    await signOut(auth);
    window.location.href = "../register/register.html";
  } catch (error) {
    alert("Gagal logout: " + error.message);
  }
});

// === NOTIFICATION TOGGLE ===
notificationToggle?.addEventListener("change", (e) => {
  const enabled = e.target.checked;
  // Save to localStorage or Firebase
  localStorage.setItem("notificationsEnabled", enabled);
  
  // Show toast notification
  showToast(enabled ? "Notifikasi diaktifkan" : "Notifikasi dinonaktifkan");
});

// Load notification preference
const notifPref = localStorage.getItem("notificationsEnabled");
if (notifPref !== null) {
  notificationToggle.checked = notifPref === "true";
}

// === SECURITY BUTTON ===
securityBtn?.addEventListener("click", () => {
  showToast("Fitur keamanan akan segera hadir!");
});

// === HAPUS AKUN ===
deleteAccountBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const yakin = confirm(
    "⚠️ PERINGATAN: Tindakan ini akan menghapus akun Anda secara permanen!\n\n" +
    "Semua data Anda akan hilang dan tidak dapat dipulihkan.\n\n" +
    "Apakah Anda yakin ingin melanjutkan?"
  );
  
  if (!yakin) return;

  const confirmText = prompt(
    'Ketik "HAPUS AKUN SAYA" (tanpa tanda kutip) untuk mengkonfirmasi:'
  );
  
  if (confirmText !== "HAPUS AKUN SAYA") {
    alert("Konfirmasi tidak sesuai. Penghapusan akun dibatalkan.");
    return;
  }

  try {
    const providerId = user.providerData[0]?.providerId;

    if (providerId === "google.com") {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
    } else {
      const password = prompt("Masukkan password Anda untuk konfirmasi akhir:");
      if (!password) {
        alert("Password diperlukan untuk menghapus akun.");
        return;
      }
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }

    await deleteUser(user);
    alert("Akun Anda telah berhasil dihapus!");
    window.location.href = "../register/register.html";

  } catch (err) {
    console.error("Error deleting account:", err);
    alert("Gagal menghapus akun: " + err.message);
  }
});

// === TOAST NOTIFICATION ===
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-message show";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add toast CSS if not already in stylesheet
if (!document.querySelector('style[data-toast]')) {
  const style = document.createElement('style');
  style.setAttribute('data-toast', 'true');
  style.textContent = `
    .toast-message {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #123440, #1a4d5e);
      color: white;
      padding: 15px 25px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(18, 52, 64, 0.3);
      font-size: 0.9rem;
      font-weight: 500;
      z-index: 10000;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease;
    }
    
    .toast-message.show {
      opacity: 1;
      transform: translateX(0);
    }
    
    @media (max-width: 768px) {
      .toast-message {
        top: 10px;
        right: 10px;
        left: 10px;
        padding: 12px 20px;
        font-size: 0.85rem;
      }
    }
  `;
  document.head.appendChild(style);
}