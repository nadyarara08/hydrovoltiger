// === Firebase Init ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

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

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Export service yang dipakai
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);