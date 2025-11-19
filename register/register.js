import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
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

// DOM Elements
const registerForm = document.getElementById('registerForm');
const nameField = document.getElementById('nameField');
const emailField = document.getElementById('emailField');
const passwordField = document.getElementById('passwordField');
const togglePasswordBtn = document.getElementById('togglePassword');
const googleRegisterBtn = document.getElementById('googleRegisterBtn');

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
function validateForm(name, email, password) {
  if (!name.trim()) {
    showToast('Nama lengkap harus diisi');
    return false;
  }
  
  if (name.trim().length < 3) {
    showToast('Nama lengkap minimal 3 karakter');
    return false;
  }
  
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

// Handle Form Submit (Email/Password Register)
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = nameField.value;
  const email = emailField.value;
  const password = passwordField.value;
  
  // Validate form
  if (!validateForm(name, email, password)) {
    return;
  }
  
  const loading = showLoading();
  
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update user profile with name
    await updateProfile(userCredential.user, {
      displayName: name
    });
    
    hideLoading(loading);
    showToast('Registrasi berhasil! Mengalihkan...', 'success');
    
    setTimeout(() => {
      window.location.href = '/agnivolt.html';
    }, 1000);
    
  } catch (error) {
    hideLoading(loading);
    
    // Handle specific Firebase errors
    let errorMessage = 'Terjadi kesalahan saat registrasi';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'Email sudah terdaftar. Silakan gunakan email lain atau login.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Format email tidak valid';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Koneksi internet bermasalah. Coba lagi.';
        break;
      default:
        errorMessage = error.message;
    }
    
    showToast(errorMessage);
    console.error('Register error:', error);
  }
});

// Handle Google Register
googleRegisterBtn.addEventListener('click', async () => {
  const loading = showLoading();
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    hideLoading(loading);
    showToast('Registrasi dengan Google berhasil!', 'success');
    
    setTimeout(() => {
      window.location.href = '/agnivolt.html';
    }, 1000);
    
  } catch (error) {
    hideLoading(loading);
    
    // Handle specific Google auth errors
    let errorMessage = 'Terjadi kesalahan saat registrasi dengan Google';
    
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Popup ditutup. Silakan coba lagi.';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Registrasi dibatalkan';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Koneksi internet bermasalah. Coba lagi.';
        break;
      case 'auth/account-exists-with-different-credential':
        errorMessage = 'Akun sudah terdaftar dengan metode lain';
        break;
      default:
        errorMessage = error.message;
    }
    
    showToast(errorMessage);
    console.error('Google register error:', error);
  }
});

// Prevent form submission on Enter key in input fields (optional)
[nameField, emailField, passwordField].forEach(field => {
  field.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      registerForm.dispatchEvent(new Event('submit'));
    }
  });
});