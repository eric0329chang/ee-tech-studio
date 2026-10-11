# EE Tech Studio 官方網站

全螢幕敘事版（2026-10 改版）。純靜態，**不需要 build**，放在 GitHub Pages：
https://eric0329chang.github.io/ee-tech-studio/

## 檔案

```
index.html      ← 內容都在這：開場、服務、作品、合作流程、團隊與技術、聯絡表單
css/style.css   ← 顏色 / 字體 / 間距都在最上面的 :root
js/main.js      ← 開場倒數、平滑捲動、捲動敘事（服務 / 作品 / 流程）、選單、聯絡表單、3D 機械在每一章的位置
js/machine.js   ← 3D 精密機械（伺服致動器），Three.js；捲動時由 main.js 告訴它要拆開多少、擺在哪
favicon.svg
```

## 章節

| 章 | 內容 | 捲動時 |
|---|---|---|
| 00 開場 | 主標、簡介、按鈕 | 3D 機械在右側慢慢轉 |
| 01 服務 | 4 個服務 | 畫面黏住，每捲一段換一個服務；3D 機械一步步拆成爆炸圖 |
| 02 作品 | 3 件作品 | 畫面黏住，作品橫向滑過（手機改成直排） |
| 03 合作流程 | 5 個步驟 | 進度線跟著捲動走，步驟逐一亮起（手機直排） |
| 04 團隊與技術 | 4 個角色 + 技術跑馬燈 | — |
| 05 聯絡 | 表單 + Email / IG | 3D 機械組回去，淡淡地在背景 |

進場動畫離開畫面會重設，捲回來會重播。

## 用到的函式庫（都走 CDN）

- GSAP 3.15（ScrollTrigger、SplitText）：捲動敘事、文字進場
- Lenis 1.3：平滑捲動
- Three.js 0.186：3D（網址在 index.html 的 importmap）

GSAP 載不到、或使用者在系統設定裡關閉動畫效果時，網站會變成一般的長頁面，內容全部看得到。
3D 在關閉動效、省流量模式、不支援 WebGL 時不顯示；要查 3D 狀態可以在開發者工具看 `<html data-three="…">`。

## 更新網站時

1. 改完推到 GitHub 的 `main`，Pages 一兩分鐘內會更新。
2. `index.html` 裡 CSS / JS 網址後面都有 `?v=版本號`。改了 css 或 js 之後，把這些 `?v=` 一起換成新的數字（例如當下的日期時間），訪客的瀏覽器才會抓新檔案，不會卡在快取的舊版。

## 本機預覽

```bash
python -m http.server 5500
```

然後開 `http://localhost:5500`。

## 聯絡表單（FormSubmit）

表單透過 FormSubmit（formsubmit.co，免費、不用註冊）直接寄到 `ee.techww@gmail.com`。

1. **第一次啟用**：上線後自己送出一次表單，到 ee.techww@gmail.com 點 FormSubmit 寄來的「Activate Form」連結。開通前送出的那筆不會轉寄。
2. 之後每筆詢問都會是一封表格格式的信，主旨「[網站詢問] 類型－稱呼」。
3. 收件信箱在 `js/main.js` 的 `TO` 和 `index.html` 表單的 `action`。

## 舊版

改版前的版本留在 git 標籤 `v1-before-redesign`。
