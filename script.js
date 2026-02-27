import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import { getAuth, GoogleAuthProvider, signInWithPopup,
onAuthStateChanged, signOut } from 
"https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAKEwR483coxO4u_v5wadTK0vZ9PvVUioU",
  authDomain: "inventory-management-f3ea9.firebaseapp.com",
  projectId: "inventory-management-f3ea9",
  storageBucket: "inventory-management-f3ea9.firebasestorage.app",
  messagingSenderId: "812103080140",
  appId: "1:812103080140:web:83918712ffbf0343bf8a69",
  measurementId: "G-RQJCGB3FCR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {

  const loginBtn = document.getElementById("googleLogin");
  const logoutBtn = document.getElementById("logoutBtn");

  /* LOGIN */
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      await signInWithPopup(auth, provider);
      window.location.href = "dashboard.html";
    });
  }

  /* LOGOUT */
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  }

});

/* AUTH CHECK */
onAuthStateChanged(auth, (user) => {

  if (window.location.pathname.includes("dashboard")) {

    if (!user) {
      window.location.href = "index.html";
    } else {
      const userName = document.getElementById("userName");
      if (userName) userName.innerText = user.displayName;
    }

  }

});
