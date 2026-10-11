# EE Tech Studio 官方網站

單頁形象網站，純靜態（HTML / CSS / JS），**不需要 build**。

## 檔案結構

```
ee-tech-studio/
├── index.html        ← 內容都在這（改文字、團隊、作品、技術棧、表單）
├── favicon.svg       ← 分頁圖示
├── css/style.css     ← 顏色 / 字體 / 尺寸都在最上面的 :root
├── js/main.js        ← 捲動動畫 + 聯絡表單送出（Lenis + GSAP，走 CDN）
├── js/anime-fx.js    ← anime.js：標題逐字、插圖描線、標籤彈出、數字計數
├── js/motion-fx.js   ← Motion（motion.dev）：進場、捲動進度條、作品圖展開、逐字亮起、卡片傾斜、按鈕磁吸
├── js/three-fx.js    ← Three.js 3D 精密機械（行星齒輪減速機）：滑鼠靠近拆成爆炸圖 + 零件標註、離開組回去、可拖曳轉動；手機自動拆裝。
│                        頁面載完才載入；關閉動效 / 省流量 / 不支援 WebGL 時不顯示；排查時看 <html data-three="…">
├── js/playground.js  ← 實驗室三個小遊戲（純 JS，無函式庫）
└── README.md
```

## 本機預覽

任一種方式：

```bash
# 有 Python
python -m http.server 5500
# 或有 Node
npx serve .
```

然後開 `http://localhost:5500`。（直接雙擊 index.html 也能開，但部分瀏覽器對 `file://` 會擋 CDN。）

## 佈署

把**整個資料夾**丟到任一免費靜態主機即可：

- **Netlify**：拖資料夾到 https://app.netlify.com/drop
- **Cloudflare Pages**：Create → Upload assets → 選資料夾
- **GitHub Pages**（目前用這個）：推到 GitHub 的 `main`，Pages 會自動更新
- **Vercel / Surge** 也都可以

沒有路由設定要處理（單頁 + 錨點）。

## 常見修改

| 想改什麼 | 改哪裡 |
|---|---|
| 標語 / 服務文案 | `index.html` 對應區塊 |
| 團隊成員（換成真人照片姓名） | `index.html` 的 `<!-- ===== TEAM ===== -->` |
| 作品案例 | `index.html` 的 `<!-- ===== WORK ===== -->`（`.wcard`） |
| 主色 / 背景色 / 字體 | `css/style.css` 最上面的 `:root` |
| Email / IG | `index.html` 搜尋 `ee.techww` |
| 動畫速度 / 開關 | `js/main.js` |
| 技術棧標籤 | `index.html` 的 `<!-- ===== 技術棧 ===== -->`（`.stack__tag`） |
| 實驗室小遊戲 | `js/playground.js` |
| 聯絡表單欄位 / 選項 | `index.html` 的 `<form class="cform">` |

## 聯絡表單（FormSubmit）

網站是純靜態（GitHub Pages），表單透過 **FormSubmit**（formsubmit.co，免費、不用註冊）直接寄到 `ee.techww@gmail.com`。

1. **第一次啟用**：網站上線後自己送出一次表單，FormSubmit 會寄一封「Activate Form」信到 ee.techww@gmail.com，點信裡的連結開通。開通前送出的那筆不會轉寄。
2. 之後每筆詢問都會變成一封表格格式的信，主旨是「[網站詢問] 類型－稱呼」。
3. 收件信箱在 `js/main.js` 的 `TO`，和 `index.html` 表單的 `action`（沒開 JS 時的備援）。
4. 表單內容會經過 FormSubmit 的伺服器轉寄。

## 說明

- 動畫函式庫（GSAP、Lenis、anime.js 4.5、Motion 13.4、Three.js 0.186）走 CDN。進場動畫每次捲回來都會重播。**萬一 CDN 載不到，網站會自動降級**成無動畫版，內容照常完整顯示。
- 支援深色、RWD、`prefers-reduced-motion`（使用者若關閉動效會自動停用）。
