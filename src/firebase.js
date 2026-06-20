// Firebase 連線設定
// ─────────────────────────────────────────────
// ⚠️ 請把下面 firebaseConfig 換成「你自己」Firebase 專案的設定。
//    取得位置:Firebase Console → 專案設定(齒輪) → 一般 → 你的應用程式 → SDK 設定與配置。
//
// 備註:網頁版 Firebase 的 apiKey 本來就是公開的(它不是密碼,只是專案識別),
//       直接寫在這裡是官方做法。真正的安全靠的是 Firestore 安全規則(firestore.rules)。
//       所以「不要」改用 .env.local —— 用 .env.local 會讓 GitHub Actions 雲端打包時讀不到設定、網站壞掉。

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAY7WoCplhR3_h5nDdFcbM7lDwyXXOGYeQ",
  authDomain: "babweb-d8f36.firebaseapp.com",
  projectId: "babweb-d8f36",
  storageBucket: "babweb-d8f36.firebasestorage.app",
  messagingSenderId: "893047758344",
  appId: "1:893047758344:web:feeb3649403cb341cd7bbd",
  measurementId: "G-8HQ6T4L9LQ"
};

const app = initializeApp(firebaseConfig)

// 登入功能(Email/密碼)
export const auth = getAuth(app)
// 資料庫(Firestore)
export const db = getFirestore(app)
