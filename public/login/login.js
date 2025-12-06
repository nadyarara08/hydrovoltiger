// ---------------------
// IMPORT FIREBASE & CONFIG
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

// Import konfigurasi Firebase
import { firebaseConfig } from '../config.js';

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
const eyeIcon = togglePasswordBtn.querySelector('ion-icon');

togglePasswordBtn.addEventListener('click', () => {
  passwordVisible = !passwordVisible;
  
  if (passwordVisible) {
    passwordField.type = 'text';
    eyeIcon.setAttribute('name', 'eye-off-outline');
  } else {
    passwordField.type = 'password';
    eyeIcon.setAttribute('name', 'eye-outline');
  }
});

// ---------------------
// HELPER FUNCTIONS
// ---------------------
function showToast(message, type = 'error', duration = 3000) {
  const oldToast = document.querySelector('.toast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, duration);

  return toast;
}

function showLoading() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p style="color: #2d3748; font-weight: 600;">Processing...</p>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
}

function handleSuccessfulLogin(user) {
  hideLoading();
  showToast('Login successful!', 'success');
  
  localStorage.setItem("loggedIn", "true");
  localStorage.setItem("userEmail", user.email);
  
  // Redirect after a short delay
  setTimeout(() => {
    window.location.href = '../main.html';
  }, 1000);
}

// ---------------------
// FORM VALIDATION
// ---------------------
function validateForm(email, password) {
  if (!email.trim()) {
    showToast('Email is required');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Invalid email format');
    return false;
  }

  if (!password) {
    showToast('Password is required');
    return false;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters');
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
    handleSuccessfulLogin(userCredential.user);
  } catch (error) {
    hideLoading();
    let errorMessage = 'An error occurred during login';
    let showGoogleLoginButton = false;

    switch (error.code) {
      case 'auth/user-not-found': 
        errorMessage = 'Email is not registered.'; 
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage = 'Incorrect password or account was created with Google.';
        showGoogleLoginButton = true;
        break;
      case 'auth/invalid-email': 
        errorMessage = 'Invalid email format.'; 
        break;
      case 'auth/too-many-requests': 
        errorMessage = 'Too many login attempts. Please try again later.'; 
        break;
      case 'auth/network-request-failed': 
        errorMessage = 'Internet connection problem. Please check your connection.'; 
        break;
      default:
        console.error('Login error:', error);
    }

    if (showGoogleLoginButton) {
      const toast = showToast(`
        <div>${errorMessage}</div>
        <button id="switchToGoogle" class="google-signin-btn">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/>
            <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"/>
            <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"/>
            <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"/>
          </svg>
          Sign in with Google instead
        </button>
      `, 'error', 10000);

      // Add event listener to the Google Sign-In button
      setTimeout(() => {
        const googleBtn = document.getElementById('switchToGoogle');
        if (googleBtn) {
          googleBtn.addEventListener('click', async () => {
            toast.remove();
            try {
              await handleGoogleSignIn();
            } catch (err) {
              console.error('Google sign in error:', err);
            }
          });
        }
      }, 100);
    } else {
      showToast(errorMessage, 'error');
    }
  }
});

// ---------------------
// GOOGLE SIGN-IN HANDLER
// ---------------------
async function handleGoogleSignIn() {
  const loading = showLoading();
  
  try {
    // Check if popups are blocked
    const popup = window.open('', '_blank');
    if (popup === null || popup.closed || typeof popup.closed === 'undefined') {
      throw new Error('popup-blocked');
    }
    popup.close();

    const result = await signInWithPopup(auth, googleProvider);
    handleSuccessfulLogin(result.user);
  } catch (error) {
    hideLoading();
    let errorMessage = 'Google login error occurred';

    switch (error.code || error.message) {
      case 'auth/popup-closed-by-user':
      case 'cancelled-popup-request':
        errorMessage = 'Login was cancelled. Please try again.';
        break;
      case 'auth/popup-blocked':
      case 'popup-blocked':
        errorMessage = `
          <div>Popup was blocked. Please allow popups for this site.</div>
          <div style="margin-top: 8px; font-size: 0.9em;">
            <strong>To enable popups:</strong>
            <ol style="text-align: left; padding-left: 20px; margin: 8px 0 0 0;">
              <li>Click the lock/padlock icon in the address bar</li>
              <li>Find "Pop-ups and redirects" in the permissions list</li>
              <li>Change it to "Allow"</li>
              <li>Try signing in again</li>
            </ol>
          </div>
        `;
        showToast(errorMessage, 'error', 10000);
        return;
      case 'auth/network-request-failed': 
        errorMessage = 'Internet connection problem. Please check your connection.'; 
        break;
      default:
        console.error('Google login error:', error);
    }

    showToast(errorMessage, 'error');
  }
}

// ---------------------
// GOOGLE LOGIN BUTTON
// ---------------------
googleLoginBtn.addEventListener('click', handleGoogleSignIn);

// ---------------------
// ENTER TO LOGIN
// ---------------------
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginBtn.click();
  }
});