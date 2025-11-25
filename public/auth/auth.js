import { auth } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

export function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User logged in:", user.email);
      if (window.location.pathname.includes("login.html") || window.location.pathname.includes("register.html")) {
        window.location.href = "main.html";
      }
    } else {
      console.log("No user logged in");
      if (window.location.pathname.includes("main.html")) {
        window.location.href = "login.html";
      }
    }
  });
}

export function logout() {
  signOut(auth)
    .then(() => {
      console.log("User logged out");
      window.location.href = "login.html";
    })
    .catch((err) => {
      console.error("Logout error:", err.message);
    });
}