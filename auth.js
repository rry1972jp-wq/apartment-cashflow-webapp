import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const screen = document.getElementById("authScreen");
const shell = document.getElementById("appShell");
const form = document.getElementById("loginForm");
const button = document.getElementById("loginBtn");
const error = document.getElementById("loginError");
let appScript;

function showError(message) { error.textContent = message; }
function showLogin() {
  shell.hidden = true;
  screen.hidden = false;
  button.disabled = false;
  button.textContent = "ログイン";
}

if (!["apiKey", "authDomain", "projectId", "appId"].every((key) => firebaseConfig[key])) {
  showError("Firebase のウェブアプリ設定が必要です。firebase-config.js を設定してください。");
  button.textContent = "設定が必要です";
} else {
  try {
    const auth = getAuth(initializeApp(firebaseConfig));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError("");
      button.disabled = true;
      button.textContent = "ログイン中…";
      try {
        await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value.trim(), document.getElementById("loginPassword").value);
      } catch (cause) {
        showError(cause.code === "auth/invalid-credential" ? "メールアドレスまたはパスワードを確認してください。" : "ログインできませんでした。設定と通信環境を確認してください。");
        button.disabled = false;
        button.textContent = "ログイン";
      }
    });
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      shell.hidden = true;
      await signOut(auth);
      // Existing app.js keeps the current record in memory. Reset it on sign out.
      location.reload();
    });
    onAuthStateChanged(auth, (user) => {
      if (!user) { showLogin(); return; }
      if (appScript) { shell.hidden = false; screen.hidden = true; return; }
      appScript = document.createElement("script");
      appScript.src = "./app.js?v=20260928-1";
      appScript.onload = () => { shell.hidden = false; screen.hidden = true; };
      appScript.onerror = () => showError("アプリの読み込みに失敗しました。再読み込みしてください。");
      document.body.append(appScript);
    }, () => showError("認証状態を確認できませんでした。再読み込みしてください。"));
  } catch {
    showError("Firebase の設定を確認してください。");
  }
}
