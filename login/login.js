// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHvLP731nG0J4emMOrZRhI3wOFfFF7gck", 
  authDomain: "agnivolt-c61a6.firebaseapp.com", 
  databaseURL: "https://agnivolt-c61a6-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "agnivolt-c61a6", 
  storageBucket: "agnivolt-c61a6.appspot.com", 
  messagingSenderId: "453833599474", 
  appId: "1:453833599474:web:bc3e76ca1deeea0969a36b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Set persistence to keep user logged in
setPersistence(auth, browserLocalPersistence);

// DOM Elements
const emailField = document.getElementById('emailField');
const passwordField = document.getElementById('passwordField');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');

// Toggle Password Visibility
let passwordVisible = false;
togglePasswordBtn.addEventListener('click', () => {
  passwordVisible = !passwordVisible;
  
  if (passwordVisible) {
    passwordField.type = 'text';
    togglePasswordBtn.innerHTML = '👁️‍🗨️'; // Mata dengan garis
  } else {
    passwordField.type = 'password';
    togglePasswordBtn.innerHTML = '👁️'; // Mata normal
  }
});

// Show Toast Notification
function showToast(message, type = 'error') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Show Loading Overlay
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

// Remove Loading Overlay
function hideLoading(overlay) {
  if (overlay) {
    overlay.remove();
  }
}

// Form Validation
function validateForm(email, password) {
  if (!email.trim()) {
    showToast('Email harus diisi');
    return false;
  }
  
  // Email validation
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

// Handle Login with Email/Password
loginBtn.addEventListener('click', async () => {
  const email = emailField.value;
  const password = passwordField.value;
  
  // Validate form
  if (!validateForm(email, password)) {
    return;
  }
  
  const loading = showLoading();
  
  try {
    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    hideLoading(loading);
    showToast('Login berhasil! Mengalihkan...', 'success');

    // Simpan status login dan info user
    localStorage.setItem("registered", "true");
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("userEmail", userCredential.user.email);
    
    setTimeout(() => {
      window.location.href = '/agnivolt.html';
    }, 1000);
    
  } catch (error) {
    hideLoading(loading);
    
    // Handle specific Firebase errors
    let errorMessage = 'Terjadi kesalahan saat login';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Email tidak terdaftar. Silakan daftar terlebih dahulu.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Password salah. Silakan coba lagi.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Format email tidak valid';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Akun ini telah dinonaktifkan';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Terlalu banyak percobaan login. Coba lagi nanti.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Koneksi internet bermasalah. Coba lagi.';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Email atau password salah';
        break;
      default:
        errorMessage = error.message;
    }
    
    showToast(errorMessage);
    console.error('Login error:', error);
  }
});

// Handle Google Login
googleLoginBtn.addEventListener('click', async () => {
  const loading = showLoading();
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    hideLoading(loading);
    showToast('Login dengan Google berhasil!', 'success');

    // Simpan status login dan info user
    localStorage.setItem("registered", "true");
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("userEmail", userCredential.user.email);
    
    setTimeout(() => {
      window.location.href = '/agnivolt.html';
    }, 1000);
    
  } catch (error) {
    hideLoading(loading);
    
    // Handle specific Google auth errors
    let errorMessage = 'Terjadi kesalahan saat login dengan Google';
    
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Popup ditutup. Silakan coba lagi.';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Login dibatalkan';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Koneksi internet bermasalah. Coba lagi.';
        break;
      case 'auth/account-exists-with-different-credential':
        errorMessage = 'Akun sudah terdaftar dengan metode lain';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'Popup diblokir oleh browser. Izinkan popup untuk login dengan Google.';
        break;
      default:
        errorMessage = error.message;
    }
    
    showToast(errorMessage);
    console.error('Google login error:', error);
  }
});

// Allow Enter key to submit login
emailField.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loginBtn.click();
  }
});

passwordField.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loginBtn.click();
  }
});

// Check if user is already logged in
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User already logged in:', user.email);
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    // Auto redirect kalau udah login
    window.location.href = '/agnivolt.html';
  }
});