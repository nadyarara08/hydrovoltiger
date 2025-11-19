// === Firebase Init ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAd2nEHRXjgpjEfF-dtb6vZ7m2oRokf-eU",
  authDomain: "hydrovoltigerr.firebaseapp.com",
  projectId: "hydrovoltigerr",
  storageBucket: "hydrovoltigerr.firebasestorage.app",
  messagingSenderId: "248835069452",
  appId: "1:248835069452:web:aec77b8f70984adbaec029",
  measurementId: "G-12J71EHPC8"
};
// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Export service yang dipakai
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);