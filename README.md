# EE Tech Studio 官方網站

單頁形象網站，純靜態（HTML / CSS / JS），**不需要 build**。

## 檔案結構

```
ee-tech-studio/
├── index.html        ← 內容都在這（改文字、團隊、作品、技術棧、表單）
├── favicon.svg       ← 分頁圖示
├── css/style.css     ← 顏色 / 字體 / 尺寸都在最上面的 :root
├── js/main.js        ← 捲動動畫 + 聯絡表單送出（Lenis + GSAP，走 CDN）
├── js/anime-fx.js    ← anime.js 加分效果：標題逐字、插圖描線、標籤彈出、按鈕磁吸
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

## 聯絡表單（mailto）

網站放在 GitHub Pages（純靜態、沒有後端），所以表單用 **mailto**：訪客按「用 Email 寄出」後，會打開他自己的郵件程式，收件人 `ee.techww@gmail.com`、主旨和內容（稱呼、聯絡方式、需求、預算、補充）都已填好，他按寄出才會真的送出。

- 收件信箱在 `js/main.js` 的 `TO`，以及 `index.html` 表單的 `action`（沒開 JS 時的備援）。
- 訪客的裝置沒有設定郵件程式時不會寄出，頁面會提示直接寄信到信箱。

## 說明

- 動畫函式庫（GSAP、Lenis、anime.js 4.5）走 CDN。**萬一 CDN 載不到，網站會自動降級**成無動畫版，內容照常完整顯示。
- 支援深色、RWD、`prefers-reduced-motion`（使用者若關閉動效會自動停用）。
