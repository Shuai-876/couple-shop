# 情侶代幣商城 💕

一個情侶互動的代幣商城手機網頁。

- **你(管理員)**:發代幣給女友、上架商品、管理商品、看統計。
- **女友(顧客)**:用代幣購買商品、看餘額與購買歷史。

技術:React 18 + Vite + Firebase(Auth + Firestore),部署在 GitHub Pages,**完全免費、不需要後端伺服器、你電腦關機也能用**。圖片壓縮後直接存進 Firestore(不需付費的 Storage)。

---

## 一、建立 Firebase 專案

1. 到 <https://console.firebase.google.com/> 用 Google 帳號登入,點「新增專案」,取個名字(例如 `couple-shop`),一路下一步建立(Google Analytics 可關掉)。

2. **啟用登入功能**:左側選單 → 「Authentication」→「開始使用」→ 選「電子郵件/密碼」→ 啟用 → 儲存。

3. **建立資料庫**:左側選單 → 「Firestore Database」→「建立資料庫」→ 選「正式版模式(production mode)」→ 選一個離你近的地區(例如 `asia-east1`)→ 啟用。

---

## 二、建立你和女友的帳號

### 1. 建兩個登入帳號(Authentication)
左側「Authentication」→「Users」分頁 →「新增使用者」,各建一個:
- 你的 Email + 密碼（管理員）
- 女友的 Email + 密碼（顧客）

每個建好後,點進去複製它的 **使用者 UID**(等一下要用)。

### 2. 建兩筆 users 文件(Firestore)
左側「Firestore Database」→「資料」分頁:

1. 點「開始集合」,集合 ID 填 `users`。
2. **文件 ID 填「你的 UID」**(不是自動產生!貼上剛剛複製的 UID),新增三個欄位:
   - `name`(字串）= 你的名字
   - `role`(字串)= `admin`
   - `email`(字串)= 你的 Email
3. 再在 `users` 集合「新增文件」,**文件 ID 填「女友的 UID」**:
   - `name`(字串)= 女友名字
   - `role`(字串)= `customer`
   - `email`(字串)= 女友 Email

> 之後在管理頁第一次發代幣時,系統會自動幫女友建立 `tokens` 文件,你不用手動建。

### 3. 貼上安全規則
左側「Firestore Database」→「規則」分頁,把本專案 `firestore.rules` 的內容整個貼上去 →「發布」。

---

## 三、填入你的 Firebase 設定

1. Firebase Console → 左上齒輪「專案設定」→「一般」分頁 → 最下方「你的應用程式」。
2. 若還沒有網頁應用程式,點 `</>`(Web)圖示新增一個,取個暱稱即可。
3. 會看到一段 `firebaseConfig = { ... }`,把裡面的值複製。
4. 打開本專案 `src/firebase.js`,把 `firebaseConfig` 的 placeholder 換成你的值。

---

## 四、本地執行(在自己電腦上測試)

需要先安裝 [Node.js](https://nodejs.org/)(建議 20 以上)。在專案資料夾打開終端機:

```bash
npm install     # 第一次:安裝需要的套件
npm run dev      # 啟動本地網站,會給你一個網址(通常 http://localhost:5173)
```

用瀏覽器打開那個網址,用你或女友的帳號登入測試。

---

## 五、部署到 GitHub Pages(讓網站永遠在線上)

1. **改 repo 名設定**:打開 `vite.config.js`,把 `base: '/couple-shop/'` 改成 `'/你的repo名/'`(前後都要有斜線)。

2. **建 GitHub repo**:在 GitHub 建一個新的 repo(名字要跟上面一致),把整個專案 push 上去:
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的帳號/你的repo名.git
   git push -u origin main
   ```

3. **開啟 Pages**:到 GitHub repo →「Settings」→ 左側「Pages」→「Build and deployment」的 **Source 選「GitHub Actions」**。

4. 之後每次 `git push` 到 main,GitHub 會自動打包並上線。等 Actions 跑完(repo 的「Actions」分頁可看進度),網站網址會是:
   ```
   https://你的帳號.github.io/你的repo名/
   ```

把這個網址傳給女友,她在手機上就能用了 💗

---

## 常見問題

- **上線後白畫面**:多半是 `vite.config.js` 的 `base` 沒設成正確的 repo 名。
- **重新整理子頁 404**:本專案已用 `HashRouter` 避免此問題,網址會帶 `#`,屬正常。
- **登入後沒反應/進不去**:檢查 Firestore 裡有沒有對應 UID 的 `users` 文件,且 `role` 拼字正確(`admin` / `customer`)。
- **API Key 公開會不會危險?** 不會。網頁版 Firebase 的 apiKey 本來就是公開識別碼,真正的安全靠 `firestore.rules`。
