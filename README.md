# EE Tech Studio 官方網站

單頁形象網站，純靜態（HTML / CSS / JS），**不需要 build**。

## 檔案結構

```
ee-tech-studio/
├── index.html        ← 內容都在這（改文字、團隊、作品、技術棧、表單）
├── favicon.svg       ← 分頁圖示
├── css/style.css     ← 顏色 / 字體 / 尺寸都在最上面的 :root
├── js/main.js        ← 捲動動畫 + 聯絡表單送出（Lenis + GSAP，走 CDN）
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
- **Vercel / Surge / GitHub Pages** 也都可以

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

## 聯絡表單（Netlify Forms）

表單走 **Netlify Forms**，不需要後端。佈署到 Netlify 後：

1. 進站台 → **Forms** 分頁，會看到名為 `contact` 的表單（要有人送出過一次才會出現）。
2. **Forms → Settings → Form notifications → Add notification → Email**，填你的信箱，之後每筆詢問都會寄信通知。
3. 本機預覽時送出會失敗（沒有 Netlify 後端），屬正常；佈署後才會動。

## 說明

- 動畫函式庫（GSAP、Lenis）走 CDN。**萬一 CDN 載不到，網站會自動降級**成無動畫版，內容照常完整顯示。
- 支援深色、RWD、`prefers-reduced-motion`（使用者若關閉動效會自動停用）。
