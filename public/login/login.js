// ---------------------
// IMPORT FIREBASE
// ---------------------
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';


// ---------------------
// FIREBASE CONFIG
// ---------------------
const firebaseConfig = {
  apiKey: "AIzaSyDUqA_nkE4Uj14hwEWjonN6HxU26ZxI_Bk",
  authDomain: "hydrovoltiger-e2d28.firebaseapp.com",
  databaseURL: "https://hydrovoltiger-e2d28-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hydrovoltiger-e2d28",
  storageBucket: "hydrovoltiger-e2d28.firebasestorage.app",
  messagingSenderId: "239145470302",
  appId: "1:239145470302:web:ff477c8d2c3837ee2967cf",
  measurementId: "G-R6VN3R282W"
};


// ---------------------
// INITIALIZE FIREBASE
// ---------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Keep user logged in
setPersistence(auth, browserLocalPersistence);


// ---------------------
// DOM ELEMENTS
// ---------------------
const emailField = document.getElementById('emailField');
const passwordField = document.getElementById('passwordField');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');


// ---------------------
// TOGGLE PASSWORD
// ---------------------
let passwordVisible = false;
togglePasswordBtn.addEventListener('click', () => {
  passwordVisible = !passwordVisible;
  
  if (passwordVisible) {
    passwordField.type = 'text';
    togglePasswordBtn.innerHTML = '👁️‍🗨️';
  } else {
    passwordField.type = 'password';
    togglePasswordBtn.innerHTML = '👁️';
  }
});


// ---------------------
// TOAST
// ---------------------
function showToast(message, type = 'error') {
  const old = document.querySelector('.toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}


// ---------------------
// LOADING OVERLAY
// ---------------------
function showLoading() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p style="color: #2d3748; font-weight: 600;">Memproses...</p>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function hideLoading(overlay) {
  if (overlay) overlay.remove();
}


// ---------------------
// FORM VALIDATION
// ---------------------
function validateForm(email, password) {
  if (!email.trim()) {
    showToast('Email harus diisi');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Format email tidak valid');
    return false;
  }

  if (!password) {
    showToast('Password harus diisi');
    return false;
  }

  if (password.length < 6) {
    showToast('Password minimal 6 karakter');
    return false;
  }

  return true;
}


// ---------------------
// EMAIL / PASSWORD LOGIN
// ---------------------
loginBtn.addEventListener('click', async () => {
  const email = emailField.value;
  const password = passwordField.value;

  if (!validateForm(email, password)) return;

  const loading = showLoading();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    hideLoading(loading);
    showToast('Login berhasil! Mengalihkan...', 'success');

    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("userEmail", userCredential.user.email);

    setTimeout(() => window.location.href = '/main.html', 1000);

  } catch (error) {
    hideLoading(loading);

    let errorMessage = 'Terjadi kesalahan saat login';

    switch (error.code) {
      case 'auth/user-not-found': errorMessage = 'Email tidak terdaftar.'; break;
      case 'auth/wrong-password': errorMessage = 'Password salah.'; break;
      case 'auth/invalid-email': errorMessage = 'Email tidak valid.'; break;
      case 'auth/too-many-requests': errorMessage = 'Terlalu banyak percobaan login.'; break;
      case 'auth/network-request-failed': errorMessage = 'Koneksi internet bermasalah.'; break;
    }

    showToast(errorMessage);
    console.error('Login error:', error);
  }
});


// ---------------------
// GOOGLE LOGIN
// ---------------------
googleLoginBtn.addEventListener('click', async () => {
  const loading = showLoading();

  try {
    const result = await signInWithPopup(auth, googleProvider);

    hideLoading(loading);
    showToast('Login dengan Google berhasil!', 'success');

    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("userEmail", result.user.email);

    setTimeout(() => window.location.href = '/main.html', 1000);

  } catch (error) {
    hideLoading(loading);

    let errorMessage = 'Terjadi kesalahan login Google';

    switch (error.code) {
      case 'auth/popup-closed-by-user': errorMessage = 'Popup ditutup.'; break;
      case 'auth/popup-blocked': errorMessage = 'Popup diblokir browser.'; break;
      case 'auth/network-request-failed': errorMessage = 'Koneksi internet bermasalah.'; break;
    }

    showToast(errorMessage);
    console.error('Google login error:', error);
  }
});


// ---------------------
// ENTER TO LOGIN
// ---------------------
emailField.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

passwordField.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
