import { auth } from "../firebase-init.js";
import { 
  onAuthStateChanged, 
  deleteUser, 
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const profileName = document.getElementById("userName");
const profileEmail = document.getElementById("userEmail");
const profileAvatar = document.getElementById("avatarLarge");
const logoutBtn = document.getElementById("deleteAccountBtn");
const backDashboardBtn = document.getElementById("backDashboardBtn");

const colors = ["#f44336", "#e91e63", "#9c27b0", "#3f51b5", "#2196f3", "#009688", "#4caf50", "#ff9800", "#795548"];

function getColorFromName(name) {
  if (!name) return colors[0];
  let index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// === TAMPILKAN DATA USER ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    const name = user.displayName || "Pengguna";
    const email = user.email;
    const initial = name.charAt(0).toUpperCase();
    const color = getColorFromName(name);

    profileName.textContent = name;
    profileEmail.textContent = email;
    profileAvatar.textContent = initial;
    profileAvatar.style.background = color;
    
  } else {
    window.location.href = "../register/register.html"; 
  }
});

// === HAPUS AKUN ===
logoutBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const yakin = confirm("Apakah anda yakin ingin menghapus akun ini?");
  if (!yakin) return;

  try {
    const providerId = user.providerData[0]?.providerId;

    if (providerId === "google.com") {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
    } else {
      const password = prompt("Masukkan password untuk konfirmasi hapus akun:");
      if (!password) return alert("Password diperlukan untuk hapus akun.");
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }

    await deleteUser(user);
    alert("Akun berhasil dihapus!");
    window.location.href = "../register/register.html";

  } catch (err) {
    alert("Gagal hapus akun: " + err.message);
  }
});

// === BUTTON KEMBALI KE DASHBOARD ===
backDashboardBtn.addEventListener("click", () => {
  window.location.href = "../main.html"; 
});
